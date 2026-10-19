import { BellRing, CalendarPlus, Check, Download, Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { contestIcsUrl } from '../../api/contests.api.js';
import { formatDateTime, localTimezone } from '../../utils/format.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';

const OFFSETS = [
  { key: '1d', label: '1 day before', hint: 'Time to plan your sleep schedule' },
  { key: '1h', label: '1 hour before', hint: 'Warm up and set up your template' },
  { key: '15m', label: '15 minutes before', hint: 'Final call' },
];

/** The dialog body, mounted only while a contest is selected. */
const ReminderOptions = ({
  contest,
  existingReminders,
  onCreate,
  onCancel,
  deliveryChannel,
  userEmail,
}) => {
  const [pending, setPending] = useState(null);

  /**
   * "Has this lead time already passed?" is answered once, when the dialog
   * opens. Reading the clock during every render would make the component
   * impure, and the answer cannot meaningfully change while it is open.
   */
  const [openedAt] = useState(() => Date.now());

  const byOffset = new Map(
    existingReminders
      .filter((reminder) => ['scheduled', 'sent'].includes(reminder.status))
      .map((reminder) => [reminder.offsetKey, reminder]),
  );

  const startsAt = new Date(contest.startTime).getTime();

  const handleCreate = async (offsetKey) => {
    setPending(offsetKey);
    try {
      await onCreate({ contestId: contest.id, offsetKey });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="mb-4 rounded-xl border border-edge/70 bg-surface-inset/50 p-3 text-xs text-content-secondary">
        <p>
          Starts <span className="font-medium text-content-primary">{formatDateTime(contest.startTime)}</span>{' '}
          ({localTimezone()})
        </p>
        {deliveryChannel === 'console-fallback' ? (
          <p className="mt-1 text-state-warning">
            SMTP is not configured on this server, so reminder emails are logged instead of sent.
          </p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1">
            <Mail size={11} aria-hidden="true" />
            Delivered to {userEmail}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {OFFSETS.map((offset) => {
          const existing = byOffset.get(offset.key);
          const leadMs = { '1d': 86_400_000, '1h': 3_600_000, '15m': 900_000 }[offset.key];
          const tooLate = startsAt - leadMs <= openedAt;

          return (
            <li
              key={offset.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-edge/70 p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-content-primary">
                  {offset.label}
                  {existing?.status === 'sent' ? (
                    <Badge variant="success" size="xs">
                      Sent
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-content-muted">
                  {tooLate && !existing ? 'That moment has already passed' : offset.hint}
                </p>
              </div>

              {existing ? (
                existing.status === 'sent' ? (
                  <Badge variant="neutral" size="sm" icon={Check}>
                    Done
                  </Badge>
                ) : (
                  <Button
                    variant="danger"
                    size="xs"
                    icon={Trash2}
                    onClick={() => onCancel(existing.id)}
                  >
                    Cancel
                  </Button>
                )
              ) : (
                <Button
                  size="xs"
                  icon={BellRing}
                  disabled={tooLate}
                  loading={pending === offset.key}
                  onClick={() => handleCreate(offset.key)}
                >
                  Set
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-edge/70 pt-4">
        <p className="mb-2 text-xs font-medium text-content-secondary">
          Or add it straight to your calendar
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            as="a"
            href={contest.googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
            icon={CalendarPlus}
          >
            Google Calendar
          </Button>

          <Button
            as="a"
            href={contestIcsUrl(contest.id)}
            variant="secondary"
            size="sm"
            icon={Download}
          >
            Download .ics
          </Button>
        </div>
      </div>
    </>
  );
};

/**
 * Reminder management for one contest: email reminders at three lead times,
 * plus the two calendar options that need no backend delivery at all.
 */
export const ReminderDialog = ({
  contest,
  open,
  onOpenChange,
  existingReminders = [],
  onCreate,
  onCancel,
  deliveryChannel,
  userEmail,
}) => (
  <Modal
    open={open}
    onOpenChange={onOpenChange}
    title="Remind me"
    description={contest?.name}
    size="md"
  >
    {contest ? (
      // Remounting per contest keeps "opened at" and pending state honest.
      <ReminderOptions
        key={contest.id}
        contest={contest}
        existingReminders={existingReminders}
        onCreate={onCreate}
        onCancel={onCancel}
        deliveryChannel={deliveryChannel}
        userEmail={userEmail}
      />
    ) : null}
  </Modal>
);

export default ReminderDialog;
