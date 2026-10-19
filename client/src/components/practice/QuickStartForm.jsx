import { ArrowRight } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import cn from '../../utils/cn.js';
import Button from '../ui/Button.jsx';

/** Codeforces and LeetCode usernames: letters, digits, "_", "-" and ".". */
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{2,40}$/;

const PLATFORM_OPTIONS = [
  { value: 'codeforces', label: 'Codeforces' },
  { value: 'leetcode', label: 'LeetCode' },
];

/**
 * "Type a username, get problems." The guest entry point used on Home and on
 * Practice next. Nothing is saved: the username travels in the URL, which is
 * also what makes the result shareable.
 */
export const QuickStartForm = ({ className, submitLabel = 'Show my problems' }) => {
  const navigate = useNavigate();
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const [platform, setPlatform] = useState('codeforces');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = username.trim();

    if (!USERNAME_PATTERN.test(value)) {
      setError('Enter a valid username (letters, numbers, _ - or .).');
      return;
    }

    setError('');
    navigate(`/practice?${new URLSearchParams({ [platform]: value }).toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={cn('w-full', className)}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-content-primary">
        Your username
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div
          className={cn(
            'flex h-11 w-full min-w-0 shrink-0 items-stretch overflow-hidden rounded-lg border bg-surface-raised sm:w-auto sm:flex-1',
            'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 focus-within:ring-offset-surface-base',
            error ? 'border-state-danger/70' : 'border-edge-strong',
          )}
        >
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            aria-label="Platform"
            className="cursor-pointer border-r border-edge bg-surface-inset px-3 text-sm font-medium text-content-primary focus:outline-none"
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            id={inputId}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={platform === 'codeforces' ? 'Codeforces handle' : 'LeetCode username'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-content-primary placeholder:font-sans placeholder:text-content-muted focus:outline-none"
          />
        </div>

        <Button type="submit" size="lg" iconRight={ArrowRight} className="h-11 shrink-0">
          {submitLabel}
        </Button>
      </div>

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-state-danger">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-content-muted">No sign-up. Nothing is saved.</p>
      )}
    </form>
  );
};

export default QuickStartForm;
