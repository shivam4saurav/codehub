import mongoose from 'mongoose';

import { PLATFORM_LIST } from '../config/constants.js';

/**
 * The durable half of the stale-while-error strategy.
 *
 * Every *validated* third-party profile response is written here. When a live
 * fetch fails (timeout, 4xx/5xx, changed response shape) the API serves the
 * last good snapshot and marks the response `stale: true` instead of erroring.
 * Invalid payloads are rejected upstream, so a broken response can never
 * overwrite a good snapshot.
 */
const profileSnapshotSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORM_LIST, required: true },
    handle: { type: String, required: true, trim: true },
    normalizedHandle: { type: String, required: true, lowercase: true, trim: true },

    /**
     * Which dataset this snapshot holds. One handle has several independent
     * snapshots (profile stats vs submission history), and they must not
     * overwrite each other.
     */
    kind: {
      type: String,
      enum: ['profile', 'activity', 'contest-history'],
      required: true,
      default: 'profile',
    },

    /** Normalised profile payload - shape defined per adapter. */
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    /** Which adapter produced it, e.g. "codeforces:profile". */
    source: { type: String, required: true },
    fetchedAt: { type: Date, required: true, default: Date.now },

    /** How many times this snapshot has been served as a fallback. */
    servedStaleCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

profileSnapshotSchema.index({ platform: 1, normalizedHandle: 1, kind: 1 }, { unique: true });
profileSnapshotSchema.index({ fetchedAt: -1 });

export const ProfileSnapshot =
  mongoose.models.ProfileSnapshot ?? mongoose.model('ProfileSnapshot', profileSnapshotSchema);

export default ProfileSnapshot;
