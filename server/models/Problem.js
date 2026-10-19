import mongoose from 'mongoose';

import { ALL_TOPIC_KEYS } from '../config/taxonomy.js';
import { PLATFORM_LIST } from '../config/constants.js';

const problemSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORM_LIST, required: true },

    /** Codeforces: "1547B". LeetCode: the question slug. */
    externalId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },

    /** Exactly what the platform returned. */
    rawTags: { type: [String], default: [] },
    /** Normalised through config/taxonomy.js. */
    canonicalTopics: {
      type: [{ type: String, enum: ALL_TOPIC_KEYS }],
      default: [],
    },

    /** Codeforces numeric rating. Null when the platform does not expose one. */
    rating: { type: Number, default: null, min: 0 },
    /** LeetCode style difficulty. Derived for Codeforces from the rating band. */
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', null], default: null },

    /** Codeforces solvedCount / LeetCode total accepted - a popularity proxy. */
    solvedCount: { type: Number, default: 0, min: 0 },
    /** LeetCode acceptance rate (0-100) when available. */
    acceptanceRate: { type: Number, default: null },
    isPremium: { type: Boolean, default: false },

    contestId: { type: Number, default: null },
    /** Problem index inside its contest: "A", "B1", ... */
    index: { type: String, default: '' },
    /** Parsed from the contest name: 1..4 for Codeforces divisions. */
    division: { type: Number, default: null, min: 1, max: 4 },
    contestName: { type: String, default: '' },
    contestStartTime: { type: Date, default: null },

    sourceFetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

/** Identity of a problem inside a platform. */
problemSchema.index({ platform: 1, externalId: 1 }, { unique: true });

/** Main browse path: filter by topic, then by rating. */
problemSchema.index({ canonicalTopics: 1, rating: 1 });
problemSchema.index({ platform: 1, canonicalTopics: 1, rating: 1 });
problemSchema.index({ platform: 1, rating: 1 });
problemSchema.index({ solvedCount: -1 });
problemSchema.index({ contestId: -1 });
problemSchema.index({ rawTags: 1 });

/** Search by problem name or id. */
problemSchema.index({ name: 'text', externalId: 'text' }, { name: 'problem_search_idx' });

problemSchema.methods.toBrowseJSON = function toBrowseJSON() {
  return {
    id: this._id.toString(),
    platform: this.platform,
    externalId: this.externalId,
    name: this.name,
    url: this.url,
    rawTags: this.rawTags,
    canonicalTopics: this.canonicalTopics,
    rating: this.rating,
    difficulty: this.difficulty,
    solvedCount: this.solvedCount,
    acceptanceRate: this.acceptanceRate,
    isPremium: this.isPremium,
    contestId: this.contestId,
    index: this.index,
    division: this.division,
    contestName: this.contestName,
  };
};

export const Problem = mongoose.models.Problem ?? mongoose.model('Problem', problemSchema);

export default Problem;
