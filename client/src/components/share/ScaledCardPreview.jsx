import { useEffect, useRef, useState } from 'react';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/**
 * Shows the fixed-size share card scaled to the available width.
 *
 * The inner node keeps its true 1200x630 layout box, so html-to-image still
 * exports at full resolution: CSS transforms do not affect offsetWidth, which
 * is what the capture uses for sizing.
 */
export const ScaledCardPreview = ({ children, className }) => {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const measure = () => {
      const width = element.clientWidth;
      if (width > 0) setScale(Math.min(1, width / CARD_WIDTH));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: CARD_HEIGHT * scale, overflow: 'hidden' }}
    >
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScaledCardPreview;
