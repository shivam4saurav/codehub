import { format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns';

export const formatNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';

export const formatCompact = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
};

/** Contest times are stored in UTC and always rendered in the local zone. */
export const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'd MMM yyyy, HH:mm');
};

export const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'HH:mm');
};

export const formatDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE d MMM');
};

export const formatRelative = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDistanceToNowStrict(date)} ago`;
};

export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

/** The viewer's IANA timezone, shown next to contest times. */
export const localTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'local time';
  }
};

export const pluralise = (count, singular, plural = `${singular}s`) =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;

export default formatNumber;
