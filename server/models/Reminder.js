import mongoose from 'mongoose';

import { PLATFORM_LIST, REMINDER_STATUS } from '../config/constants.js';

/**
 * A single scheduled notification for one contest.
 *
 * Double-send protection: the cron worker never "reads then writes". It calls
 * findOneAndUpdate({ status: scheduled, dueAt <= now } -> { status: claimed }),
 * so only the worker that wins the atomic update owns the send. A crash after
 * claiming leaves the row in `claimed`, which the recovery sweep can requeue.
 */
const reminderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },

    /**
     * Denormalised contest fields so a reminder email is still correct even if
     * the cached contest document is refreshed or pruned.
     */
    contest: {
      platform: { type: String, enum: PLATFORM_LIST, required: true },
      externalId: { type: String, required: true },
      name: { type: String, required: true },
      url: { type: String, required: true },
      startTime: { type: Date, required: true },
    },

    /** 1d | 1h | 15m */
    offsetKey: { type: String, enum: ['1d', '1h', '15m'], required: true },
    /** UTC instant the reminder should fire. */
    dueAt: { type: Date, required: true },

    channel: { type: String, enum: ['email'], default: 'email' },
    email: { type: String, required: true },

    status: {
      type: String,
      enum: Object.values(REMINDER_STATUS),
      default: REMINDER_STATUS.SCHEDULED,
    },

    claimedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
  },
  { timestamps: true },
);

/** The cron query: due + scheduled. */
reminderSchema.index({ status: 1, dueAt: 1 });
reminderSchema.index({ dueAt: 1 });

/** One reminder per user, contest and offset. */
reminderSchema.index({ userId: 1, contestId: 1, offsetKey: 1 }, { unique: true });

reminderSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    contestId: this.contestId?.toString(),
    contest: {
      platform: this.contest.platform,
      externalId: this.contest.externalId,
      name: this.contest.name,
      url: this.contest.url,
      startTime: this.contest.startTime,
    },
    offsetKey: this.offsetKey,
    dueAt: this.dueAt,
    channel: this.channel,
    status: this.status,
    sentAt: this.sentAt,
    createdAt: this.createdAt,
  };
};

export const Reminder = mongoose.models.Reminder ?? mongoose.model('Reminder', reminderSchema);

export default Reminder;
