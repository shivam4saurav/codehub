import * as RadixTooltip from '@radix-ui/react-tooltip';

import cn from '../../utils/cn.js';

/**
 * Tooltip for supporting detail only - never the sole carrier of information,
 * since tooltips are unavailable on touch devices.
 */
export const Tooltip = ({ content, children, side = 'top', align = 'center', className }) => {
  if (!content) return children;

  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-50 max-w-xs rounded-lg border border-edge-strong/80 bg-surface-overlay/95 px-3 py-2',
            'text-xs leading-relaxed text-content-secondary shadow-card backdrop-blur-xl',
            'data-[state=delayed-open]:animate-fade-up',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-surface-overlay" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
};

export default Tooltip;
