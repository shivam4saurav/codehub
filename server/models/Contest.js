import mongoose from 'mongoose';

import { PLATFORM_LIST } from '../config/constants.js';

/**
 * Cached contest metadata from Codeforces + clist.by.
 * Doubles as the snapshot layer for the calendar: if every live source fails,
 * the API serves these documents and flags the response as stale.
 * All times are stored in UTC; the client renders in the user's timezone.
 */
const contestSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORM_LIST, required: true },
    /** Stable id from the source (Codeforces contest id, clist event id). */
    externalId: { type: String, required: true },

    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationSeconds: { type: Number, required: true, min: 0 },

    /** before | coding | finished - normalised across sources. */
    phase: {
      type: String,
      enum: ['before', 'coding', 'finished'],
      default: 'before',
    },

    /** Which adapter produced this row, for /api/health and stale badges. */
    source: { type: String, required: true },
    fetchedAt: { type: Date, default: Date.now },

    /** Codeforces division parsed from the name, when present. */
    division: { type: Number, default: null, min: 1, max: 4 },
  },
  { timestamps: true },
);

contestSchema.index({ platform: 1, externalId: 1 }, { unique: true });
contestSchema.index({ startTime: 1 });
contestSchema.index({ platform: 1, startTime: 1 });

contestSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    platform: this.platform,
    externalId: this.externalId,
    name: this.name,
    url: this.url,
    startTime: this.startTime,
    endTime: this.endTime,
    durationSeconds: this.durationSeconds,
    phase: this.phase,
    division: this.division,
    source: this.source,
    fetchedAt: this.fetchedAt,
  };
};

export const Contest = mongoose.models.Contest ?? mongoose.model('Contest', contestSchema);

export default Contest;
