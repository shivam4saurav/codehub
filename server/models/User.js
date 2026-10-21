import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { CARD_THEMES } from '../config/constants.js';

const BCRYPT_ROUNDS = 12;

/** One active refresh token per device/session. Stored hashed, never raw. */
const refreshSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -'],
    },
    usernameLower: { type: String, required: true, lowercase: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },

    /**
     * Optional for accounts created through Google, which never have one.
     * Mongoose skips required validation for unselected paths on existing
     * documents, so saving a doc loaded without the hash still works.
     */
    passwordHash: {
      type: String,
      select: false,
      required: function passwordRequiredWithoutOAuth() {
        return !this.googleId;
      },
    },

    /**
     * Mirrors "does this account have a password?" without loading the hash.
     * Only auth.service.js writes it, and both signup paths set it explicitly.
     *
     * Deliberately no `default`: Mongoose applies defaults when hydrating a
     * document, so `default: false` would make accounts written before this
     * field existed look password-less. Leaving it undefined lets
     * canUsePassword() fall back to the googleId rule instead.
     */
    hasPassword: { type: Boolean },

    /** Google's stable account id (the OIDC "sub"), null for password-only users. */
    googleId: { type: String, default: null },

    displayName: { type: String, trim: true, maxlength: 60, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 240, default: '' },

    preferences: {
      theme: { type: String, enum: ['dark', 'light', 'system'], default: 'light' },
      reducedMotion: { type: Boolean, default: false },
      emailReminders: { type: Boolean, default: true },
    },

    /**
     * Public sharing is OFF by default - /u/:username and the share card stay
     * private until the user opts in from Settings.
     */
    publicProfile: {
      enabled: { type: Boolean, default: false },
      cardTheme: { type: String, enum: CARD_THEMES, default: 'dark-neon' },
      showEmail: { type: Boolean, default: false },
    },

    refreshSessions: { type: [refreshSessionSchema], default: [], select: false },

    /** Drives the manual refresh cooldown on the dashboard. */
    lastProfileRefreshAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ usernameLower: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
/**
 * One CodeHub account per Google account. This has to be a *partial* index
 * rather than a sparse one: `googleId` defaults to null, so every document has
 * the field, and a sparse unique index would reject the second password-only
 * user. Indexing only string values leaves the nulls alone.
 */
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } },
);

// Mongoose 9 document middleware is promise/sync based - declaring a `next`
// parameter here would never be called.
userSchema.pre('validate', function normaliseUsername() {
  if (this.username) this.usernameLower = this.username.toLowerCase();
});

userSchema.statics.hashPassword = function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
};

userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plainPassword, this.passwordHash);
};

/**
 * Whether this account can sign in with a password.
 *
 * `hasPassword` is the authoritative mirror, but documents written before that
 * field existed simply do not have it. Those accounts always have a password:
 * the schema only permits a missing passwordHash when googleId is set. Deriving
 * the fallback here means a missed backfill cannot produce a broken UI.
 */
userSchema.methods.canUsePassword = function canUsePassword() {
  if (typeof this.hasPassword === 'boolean') return this.hasPassword;
  return !this.googleId;
};

/** Safe representation for API responses - never leaks hashes or sessions. */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    displayName: this.displayName || this.username,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    preferences: {
      theme: this.preferences?.theme ?? 'light',
      reducedMotion: this.preferences?.reducedMotion ?? false,
      emailReminders: this.preferences?.emailReminders ?? true,
    },
    publicProfile: {
      enabled: this.publicProfile?.enabled ?? false,
      cardTheme: this.publicProfile?.cardTheme ?? 'dark-neon',
      showEmail: this.publicProfile?.showEmail ?? false,
    },
    /**
     * Which ways this account can sign in. Settings uses it to offer "set a
     * password" to Google-only users instead of a change form they cannot use.
     */
    authMethods: {
      password: this.canUsePassword(),
      google: Boolean(this.googleId),
    },
    lastProfileRefreshAt: this.lastProfileRefreshAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);

export default User;
