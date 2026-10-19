import { useEffect, useMemo, useState } from 'react';

const SECOND = 1000;

/**
 * Live countdown to a UTC instant, rendered in the viewer's local timezone.
 * Ticks once per second and stops itself once the target has passed.
 */
export const useCountdown = (target) => {
  const targetTime = useMemo(() => new Date(target).getTime(), [target]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(targetTime)) return undefined;

    // `now` is already seeded by the state initialiser; the interval is the only
    // thing that needs to move it, so nothing is set during the effect body.
    const timer = setInterval(() => setNow(Date.now()), SECOND);
    return () => clearInterval(timer);
  }, [targetTime]);

  if (Number.isNaN(targetTime)) {
    return { isValid: false, hasPassed: false, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, label: '' };
  }

  const totalMs = Math.max(0, targetTime - now);
  const totalSeconds = Math.floor(totalMs / SECOND);

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (input) => String(input).padStart(2, '0');

  const label =
    totalMs === 0
      ? 'Started'
      : days > 0
        ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
        : hours > 0
          ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
          : `${pad(minutes)}:${pad(seconds)}`;

  return {
    isValid: true,
    hasPassed: totalMs === 0,
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    label,
  };
};

export default useCountdown;
