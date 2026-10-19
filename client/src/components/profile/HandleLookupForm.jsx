import { useState } from 'react';

import { PLATFORMS, PLATFORM_KEYS } from '../../utils/platform.js';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

/**
 * Guest entry point for the dashboard: type usernames, get a dashboard.
 * No account needed, which is what makes the project demoable in ten seconds.
 */
export const HandleLookupForm = ({ initialHandles = {}, onSubmit, isLoading }) => {
  const [handles, setHandles] = useState({
    codeforces: initialHandles.codeforces ?? '',
    leetcode: initialHandles.leetcode ?? '',
    codechef: initialHandles.codechef ?? '',
  });

  const hasAny = Object.values(handles).some((value) => value.trim() !== '');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (hasAny) onSubmit(handles);
      }}
      className="glass p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {PLATFORM_KEYS.map((key) => (
          <Input
            key={key}
            label={PLATFORMS[key].label}
            value={handles[key]}
            onChange={(event) => setHandles({ ...handles, [key]: event.target.value })}
            placeholder="username"
            className="font-mono placeholder:font-sans"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-content-muted">At least one. Nothing is saved.</p>
        <Button type="submit" disabled={!hasAny} loading={isLoading}>
          Show dashboard
        </Button>
      </div>
    </form>
  );
};

export default HandleLookupForm;
