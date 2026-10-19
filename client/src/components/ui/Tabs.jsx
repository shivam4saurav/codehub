import * as RadixTabs from '@radix-ui/react-tabs';

import cn from '../../utils/cn.js';

export const Tabs = ({ value, onValueChange, defaultValue, children, className }) => (
  <RadixTabs.Root
    value={value}
    onValueChange={onValueChange}
    defaultValue={defaultValue}
    className={className}
  >
    {children}
  </RadixTabs.Root>
);

export const TabsList = ({ children, className, ariaLabel }) => (
  <RadixTabs.List
    aria-label={ariaLabel}
    className={cn(
      'inline-flex items-center gap-1 rounded-lg border border-edge bg-surface-inset p-1',
      className,
    )}
  >
    {children}
  </RadixTabs.List>
);

export const TabsTrigger = ({ value, children, icon: Icon, className }) => (
  <RadixTabs.Trigger
    value={value}
    className={cn(
      'focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
      'text-content-secondary transition duration-150 hover:text-content-primary',
      'data-[state=active]:bg-surface-raised data-[state=active]:text-content-primary data-[state=active]:shadow-sm',
      className,
    )}
  >
    {Icon ? <Icon size={14} aria-hidden="true" /> : null}
    {children}
  </RadixTabs.Trigger>
);

export const TabsContent = ({ value, children, className }) => (
  <RadixTabs.Content value={value} className={cn('mt-4 focus-visible:outline-none', className)}>
    {children}
  </RadixTabs.Content>
);

export default Tabs;
