import { useEffect, useRef, useState } from 'react';

import { useTheme } from '../../context/ThemeContext.jsx';
import cn from '../../utils/cn.js';

const prefersReducedMotionMedia = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts up to `value` once, with an ease-out curve.
 * Reduced-motion users (OS setting or the in-app preference) get the final
 * number immediately - the information matters, the animation does not.
 */
export const AnimatedNumber = ({
  value = 0,
  duration = 900,
  format = (input) => Math.round(input).toLocaleString(),
  className,
}) => {
  const { reducedMotion } = useTheme();
  const skipAnimation = reducedMotion || prefersReducedMotionMedia();

  /**
   * `animated` only exists while a tween is running. When motion is suppressed
   * the final value is derived directly, so no state is written during render
   * or inside an effect body.
   */
  const [animated, setAnimated] = useState(0);
  const frameRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (skipAnimation) return undefined;

    const from = fromRef.current;
    const target = Number(value) || 0;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;

      setAnimated(from + (target - from) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, skipAnimation]);

  const display = skipAnimation ? Number(value) || 0 : animated;

  return <span className={cn('tabular-nums', className)}>{format(display)}</span>;
};

export default AnimatedNumber;
