import mongoose from 'mongoose';

import { PLATFORM_LIST } from '../config/constants.js';

/**
 * Raw platform tags that did not match the canonical taxonomy.
 * These rows are the to-do list for extending config/taxonomy.js.
 */
const unmappedTagSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORM_LIST, required: true },
    rawTag: { type: String, required: true, trim: true },
    occurrences: { type: Number, default: 0 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

unmappedTagSchema.index({ platform: 1, rawTag: 1 }, { unique: true });
unmappedTagSchema.index({ occurrences: -1 });

export const UnmappedTag =
  mongoose.models.UnmappedTag ?? mongoose.model('UnmappedTag', unmappedTagSchema);

export default UnmappedTag;
