import mongoose from 'mongoose';

import { ALL_TOPIC_KEYS } from '../config/taxonomy.js';
import { PLATFORM_LIST } from '../config/constants.js';

/**
 * Audit trail of what the recommender suggested, so "Practice next" can avoid
 * repeating the same shuffle and the capstone report can show real history.
 */
const recommendationItemSchema = new mongoose.Schema(
  {
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem' },
    platform: { type: String, enum: PLATFORM_LIST, required: true },
    externalId: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, default: '' },
    rating: { type: Number, default: null },
    difficulty: { type: String, default: null },
    topicKey: { type: String, enum: ALL_TOPIC_KEYS, required: true },
    reason: { type: String, default: '' },
  },
  { _id: false },
);

const weakTopicSchema = new mongoose.Schema(
  {
    topicKey: { type: String, enum: ALL_TOPIC_KEYS, required: true },
    score: { type: Number, required: true },
    solved: { type: Number, default: 0 },
    averageRating: { type: Number, default: null },
    status: { type: String, enum: ['weak', 'never-attempted'], default: 'weak' },
  },
  { _id: false },
);

const recommendationHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generatedAt: { type: Date, default: Date.now },
    params: {
      count: { type: Number, default: 12 },
      difficultyOffset: { type: Number, default: null },
      topics: { type: [String], default: [] },
    },
    weakTopics: { type: [weakTopicSchema], default: [] },
    items: { type: [recommendationItemSchema], default: [] },
  },
  { timestamps: true },
);

recommendationHistorySchema.index({ userId: 1, generatedAt: -1 });

export const RecommendationHistory =
  mongoose.models.RecommendationHistory ??
  mongoose.model('RecommendationHistory', recommendationHistorySchema);

export default RecommendationHistory;
