import mongoose from 'mongoose';

/**
 * Per-source success/failure ledger backing GET /api/health.
 * Persisted so "last successful fetch" survives a server restart, which
 * matters when the API is redeployed right before a demo.
 */
const sourceHealthSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    lastLatencyMs: { type: Number, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    totalSuccesses: { type: Number, default: 0 },
    totalFailures: { type: Number, default: 0 },
  },
  { timestamps: true },
);

sourceHealthSchema.index({ source: 1 }, { unique: true });

export const SourceHealth =
  mongoose.models.SourceHealth ?? mongoose.model('SourceHealth', sourceHealthSchema);

export default SourceHealth;
