import { REMINDER_OFFSETS, REMINDER_STATUS } from '../config/constants.js';
import Reminder from '../models/Reminder.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { getContestById } from './contest.service.js';
import { sendContestReminder } from './email.service.js';

/**
 * Contest reminders.
 *
 * DOUBLE-SEND PROTECTION
 * ----------------------
 * The worker never reads a row and then writes it. It runs an atomic
 *   findOneAndUpdate({ status: 'scheduled', dueAt: { $lte: now } },
 *                    { $set: { status: 'claimed' } })
 * so exactly one worker can ever own a given reminder - even with several
 * server instances, or after a restart mid-send. Only the claimer sends, and it
 * then transitions the row to `sent` (or `failed`).
 *
 * A row stuck in `claimed` (process died between claim and send) is requeued by
 * `requeueStuckClaims` after a grace period, rather than being lost forever.
 */

export const offsetToMs = (offsetKey) => REMINDER_OFFSETS[offsetKey];

/** Create (or revive) a reminder for one contest and offset. */
export const createReminder = async ({ user, contestId, offsetKey }) => {
  const offsetMs = offsetToMs(offsetKey);
  if (!offsetMs) throw ApiError.badRequest('Unsupported reminder offset');

  const contest = await getContestById(contestId);
  if (!contest) throw ApiError.notFound('Contest not found');

  const dueAt = new Date(new Date(contest.startTime).getTime() - offsetMs);

  // A reminder for a moment that has already passed would fire instantly.
  if (dueAt.getTime() <= Date.now()) {
    throw ApiError.badRequest(
      `That contest starts too soon for a ${offsetKey} reminder. Try a shorter lead time.`,
      { code: 'REMINDER_TOO_LATE' },
    );
  }

  const document = await Reminder.findOneAndUpdate(
    { userId: user._id, contestId: contest._id, offsetKey },
    {
      $set: {
        dueAt,
        email: user.email,
        channel: 'email',
        // Re-arming a cancelled reminder resets its delivery state.
        status: REMINDER_STATUS.SCHEDULED,
        claimedAt: null,
        sentAt: null,
        cancelledAt: null,
        lastError: '',
        contest: {
          platform: contest.platform,
          externalId: contest.externalId,
          name: contest.name,
          url: contest.url,
          startTime: contest.startTime,
        },
      },
      $setOnInsert: { userId: user._id, contestId: contest._id, offsetKey, attempts: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return document;
};

export const listReminders = async (userId, { status, upcomingOnly = false } = {}) => {
  const filter = { userId };
  if (status) filter.status = status;
  if (upcomingOnly) filter['contest.startTime'] = { $gte: new Date() };

  const rows = await Reminder.find(filter).sort({ dueAt: 1 }).lean();

  return rows.map((row) => ({
    id: String(row._id),
    contestId: String(row.contestId),
    contest: row.contest,
    offsetKey: row.offsetKey,
    dueAt: row.dueAt,
    status: row.status,
    channel: row.channel,
    sentAt: row.sentAt ?? null,
    attempts: row.attempts ?? 0,
    lastError: row.lastError || undefined,
    createdAt: row.createdAt,
  }));
};

export const cancelReminder = async ({ userId, reminderId }) => {
  const reminder = await Reminder.findOneAndUpdate(
    // Anything already sent cannot be un-sent.
    { _id: reminderId, userId, status: { $in: [REMINDER_STATUS.SCHEDULED, REMINDER_STATUS.FAILED] } },
    { $set: { status: REMINDER_STATUS.CANCELLED, cancelledAt: new Date() } },
    { new: true },
  );

  if (!reminder) {
    const exists = await Reminder.exists({ _id: reminderId, userId });
    throw exists
      ? ApiError.badRequest('That reminder has already been sent or cancelled')
      : ApiError.notFound('Reminder not found');
  }

  return reminder;
};

/**
 * Atomically claim ONE due reminder. Returns null when nothing is due.
 * Injectable model so the claim semantics can be unit tested.
 */
export const claimNextDueReminder = async ({
  model = Reminder,
  now = new Date(),
  excludeIds = [],
} = {}) =>
  model.findOneAndUpdate(
    {
      status: REMINDER_STATUS.SCHEDULED,
      dueAt: { $lte: now },
      // Anything already attempted in this tick waits for the next one.
      ...(excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {}),
    },
    { $set: { status: REMINDER_STATUS.CLAIMED, claimedAt: now }, $inc: { attempts: 1 } },
    { new: true, sort: { dueAt: 1 } },
  );

/** Deliver one already-claimed reminder and record the outcome. */
export const deliverClaimedReminder = async (
  reminder,
  { model = Reminder, sender = sendContestReminder } = {},
) => {
  try {
    // Firing hours late is worse than not firing: the contest already started.
    const startTime = new Date(reminder.contest.startTime).getTime();
    if (startTime < Date.now()) {
      await model.updateOne(
        { _id: reminder._id },
        {
          $set: {
            status: REMINDER_STATUS.SKIPPED,
            lastError: 'Contest already started before the reminder could be sent',
          },
        },
      );
      return { sent: false, skipped: true };
    }

    await sender({
      to: reminder.email,
      contest: reminder.contest,
      offsetKey: reminder.offsetKey,
    });

    await model.updateOne(
      { _id: reminder._id },
      { $set: { status: REMINDER_STATUS.SENT, sentAt: new Date(), lastError: '' } },
    );

    return { sent: true };
  } catch (error) {
    const attempts = reminder.attempts ?? 1;
    // Give a transient SMTP failure two more chances before giving up.
    const giveUp = attempts >= 3;

    await model.updateOne(
      { _id: reminder._id },
      {
        $set: {
          status: giveUp ? REMINDER_STATUS.FAILED : REMINDER_STATUS.SCHEDULED,
          claimedAt: null,
          lastError: String(error.message ?? error).slice(0, 300),
        },
      },
    );

    logger.error('Reminder delivery failed', {
      reminderId: String(reminder._id),
      attempts,
      giveUp,
      error: error.message,
    });

    return { sent: false, retryScheduled: !giveUp };
  }
};

/**
 * Drain every due reminder. `maxPerRun` bounds one cron tick so a backlog
 * cannot block the event loop.
 */
export const processDueReminders = async ({
  model = Reminder,
  sender = sendContestReminder,
  maxPerRun = 25,
  now = new Date(),
} = {}) => {
  const summary = { claimed: 0, sent: 0, skipped: 0, failed: 0 };

  /**
   * A failed delivery returns the row to `scheduled` for a later retry. Without
   * this guard the same reminder would be re-claimed immediately inside this
   * very loop, burning all three attempts against an SMTP server that is
   * probably still down a millisecond later.
   */
  const attemptedThisRun = [];

  for (let index = 0; index < maxPerRun; index += 1) {
    const reminder = await claimNextDueReminder({ model, now, excludeIds: attemptedThisRun });
    if (!reminder) break;

    attemptedThisRun.push(reminder._id);
    summary.claimed += 1;

    const outcome = await deliverClaimedReminder(reminder, { model, sender });
    if (outcome.sent) summary.sent += 1;
    else if (outcome.skipped) summary.skipped += 1;
    else summary.failed += 1;
  }

  return summary;
};

/**
 * Recovery sweep: a process that died between claiming and sending leaves a row
 * in `claimed`. After a grace period it is safe to requeue.
 */
export const requeueStuckClaims = async ({ model = Reminder, graceMinutes = 10 } = {}) => {
  const cutoff = new Date(Date.now() - graceMinutes * 60_000);

  const result = await model.updateMany(
    { status: REMINDER_STATUS.CLAIMED, claimedAt: { $lte: cutoff }, attempts: { $lt: 3 } },
    { $set: { status: REMINDER_STATUS.SCHEDULED, claimedAt: null } },
  );

  const requeued = result.modifiedCount ?? 0;
  if (requeued > 0) logger.warn('Requeued stuck reminder claims', { requeued });

  return requeued;
};

export default { createReminder, listReminders, cancelReminder, processDueReminders };
