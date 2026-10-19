import * as RadixCheckbox from '@radix-ui/react-checkbox';
import * as RadixSwitch from '@radix-ui/react-switch';
import { Check } from 'lucide-react';
import { useId } from 'react';

import cn from '../../utils/cn.js';

/** Radix switch with a label row. Keyboard and screen-reader ready. */
export const Switch = ({ checked, onCheckedChange, label, description, disabled, className }) => {
  const id = useId();

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {label ? (
        <div className="min-w-0">
          <label htmlFor={id} className="block text-sm font-medium text-content-primary">
            {label}
          </label>
          {description ? (
            <p className="mt-0.5 text-xs text-content-secondary">{description}</p>
          ) : null}
        </div>
      ) : null}

      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'focus-ring relative h-6 w-11 shrink-0 rounded-full border transition duration-200',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'border-brand-600 bg-brand-600'
            : 'border-edge bg-surface-inset hover:border-edge-strong',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block h-4 w-4 translate-x-1 rounded-full bg-white shadow transition-transform duration-200 ease-spring',
            'data-[state=checked]:translate-x-6',
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
};

export const Checkbox = ({ checked, onCheckedChange, label, disabled, className }) => {
  const id = useId();

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'focus-ring grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition',
          checked ? 'border-brand-600 bg-brand-600' : 'border-edge-strong bg-surface-raised',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator>
          <Check size={12} className="text-white" strokeWidth={3} aria-hidden="true" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      {label ? (
        <label htmlFor={id} className="cursor-pointer select-none text-sm text-content-secondary">
          {label}
        </label>
      ) : null}
    </div>
  );
};

export default Switch;
