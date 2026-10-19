import {
  cancelReminder,
  createReminder,
  listReminders,
} from '../services/reminder.service.js';
import { isEmailConfigured } from '../services/email.service.js';
import asyncHandler from '../utils/asyncHandler.js';

/** GET /api/reminders */
export const list = asyncHandler(async (req, res) => {
  const reminders = await listReminders(req.user._id, req.validated.query);

  res.json({
    reminders,
    delivery: {
      email: req.user.email,
      // Be honest about how mail will actually be delivered.
      channel: isEmailConfigured() ? 'smtp' : 'console-fallback',
      enabled: req.user.preferences?.emailReminders ?? true,
    },
  });
});

/** POST /api/reminders */
export const create = asyncHandler(async (req, res) => {
  const { contestId, offsetKey } = req.validated.body;

  const reminder = await createReminder({ user: req.user, contestId, offsetKey });

  res.status(201).json({
    reminder: reminder.toSafeJSON(),
    message: isEmailConfigured()
      ? `We will email ${req.user.email} before the contest.`
      : 'Reminder scheduled. SMTP is not configured, so delivery will be logged on the server.',
  });
});

/** DELETE /api/reminders/:reminderId */
export const remove = asyncHandler(async (req, res) => {
  const { reminderId } = req.validated.params;

  await cancelReminder({ userId: req.user._id, reminderId });

  res.json({ success: true });
});

export default { list, create, remove };
