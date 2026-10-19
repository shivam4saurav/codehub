import mongoose from 'mongoose';

import { MAX_HANDLE_LENGTH, PLATFORM_LIST } from '../config/constants.js';

const platformHandleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: PLATFORM_LIST, required: true },
    handle: { type: String, required: true, trim: true, maxlength: MAX_HANDLE_LENGTH },
    normalizedHandle: { type: String, required: true, lowercase: true, trim: true },

    /** Set once a live fetch confirmed the handle exists on that platform. */
    verified: { type: Boolean, default: false },
    lastVerifiedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
  },
  { timestamps: true },
);

/** One handle per platform per user. */
platformHandleSchema.index({ userId: 1, platform: 1 }, { unique: true });

/** A platform handle can only be claimed by a single CodeHub account. */
platformHandleSchema.index({ platform: 1, normalizedHandle: 1 }, { unique: true });

platformHandleSchema.pre('validate', function normalise() {
  if (this.handle) this.normalizedHandle = this.handle.trim().toLowerCase();
});

platformHandleSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    platform: this.platform,
    handle: this.handle,
    verified: this.verified,
    lastVerifiedAt: this.lastVerifiedAt,
    lastSyncedAt: this.lastSyncedAt,
  };
};

export const PlatformHandle =
  mongoose.models.PlatformHandle ?? mongoose.model('PlatformHandle', platformHandleSchema);

export default PlatformHandle;
