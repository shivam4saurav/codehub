import crypto from 'node:crypto';

/**
 * Minimal RFC 5545 generator for a single contest event.
 * Hand-rolled on purpose: one event type, no timezone gymnastics (everything
 * is emitted as UTC), and no extra dependency to audit.
 */

/** RFC 5545 wants CRLF, escaped separators and 75-octet folded lines. */
const escapeText = (value = '') =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const foldLine = (line) => {
  if (line.length <= 75) return line;

  const chunks = [line.slice(0, 75)];
  let rest = line.slice(75);

  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }

  if (rest.length > 0) chunks.push(` ${rest}`);
  return chunks.join('\r\n');
};

/** 2026-09-25T14:30:00.000Z -> 20260925T143000Z */
export const toIcsStamp = (value) =>
  new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * @param {{
 *   name: string, url: string, startTime: Date|string, endTime: Date|string,
 *   platform?: string, description?: string, reminderMinutesBefore?: number|null,
 *   uid?: string,
 * }} contest
 */
export const buildContestIcs = (contest) => {
  const uid =
    contest.uid ??
    `${crypto.createHash('sha1').update(`${contest.platform}-${contest.name}-${contest.startTime}`).digest('hex')}@codehub`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CodeHub//Contest Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(contest.startTime)}`,
    `DTEND:${toIcsStamp(contest.endTime)}`,
    `SUMMARY:${escapeText(contest.name)}`,
    `DESCRIPTION:${escapeText(
      contest.description ??
        `${contest.platform ? `${contest.platform} contest. ` : ''}Added from CodeHub. ${contest.url ?? ''}`,
    )}`,
    ...(contest.url ? [`URL:${escapeText(contest.url)}`] : []),
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
  ];

  if (Number.isFinite(contest.reminderMinutesBefore) && contest.reminderMinutesBefore > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-PT${contest.reminderMinutesBefore}M`,
      `DESCRIPTION:${escapeText(`${contest.name} starts soon`)}`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
};

/** "Add to Google Calendar" deep link - no API key or OAuth needed. */
export const googleCalendarUrl = ({ name, url, startTime, endTime, platform }) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: name,
    dates: `${toIcsStamp(startTime)}/${toIcsStamp(endTime)}`,
    details: `${platform ? `${platform} contest. ` : ''}Added from CodeHub.${url ? `\n${url}` : ''}`,
    ...(url ? { location: url } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/** Safe filename for the .ics download. */
export const icsFilename = (name) =>
  `${String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'contest'}.ics`;

export default buildContestIcs;
