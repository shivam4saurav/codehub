import { ArrowRight, AtSign, Check, KeyRound, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageTransition } from '../components/common/Motion.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import cn from '../utils/cn.js';

/** Mirrors the server-side Zod rules so feedback is instant and consistent. */
const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { key: 'letter', label: 'Contains a letter', test: (value) => /[a-zA-Z]/.test(value) },
  { key: 'number', label: 'Contains a number', test: (value) => /[0-9]/.test(value) },
];

export const RegisterPage = () => {
  const { register, registerState } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const passwordChecks = useMemo(
    () => RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password],
  );

  const usernameError =
    form.username && !/^[a-zA-Z0-9_-]{3,30}$/.test(form.username)
      ? '3-30 characters: letters, numbers, _ or -'
      : '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (usernameError || passwordChecks.some((check) => !check.passed)) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    try {
      await register(form);
      navigate('/settings?welcome=1', { replace: true });
    } catch (error) {
      if (error.details?.length) {
        setFieldErrors(
          Object.fromEntries(
            error.details.map((detail) => [detail.field.replace('body.', ''), detail.message]),
          ),
        );
      }
      setFormError(error.message);
    }
  };

  return (
    <PageTransition>
      <section className="mx-auto flex w-full max-w-md flex-col justify-center px-5 py-10 sm:px-6 sm:py-16">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-content-primary sm:text-3xl">
            Create your free account
          </h1>
          <p className="mt-2 text-sm text-content-secondary">
            Save your platform usernames, bookmark problems and get contest reminders.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass space-y-5 p-6" noValidate>
          <Input
            label="Username"
            name="username"
            icon={UserRound}
            autoComplete="username"
            placeholder="ada_lovelace"
            hint="This becomes your public profile link: /u/username"
            value={form.username}
            error={fieldErrors.username || usernameError}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            required
          />

          <Input
            label="Email"
            name="email"
            type="email"
            icon={AtSign}
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            error={fieldErrors.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />

          <div>
            <Input
              label="Password"
              name="password"
              type="password"
              icon={KeyRound}
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.password}
              error={fieldErrors.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />

            <ul className="mt-3 space-y-1.5">
              {passwordChecks.map((check) => (
                <li
                  key={check.key}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition',
                    check.passed ? 'text-state-success' : 'text-content-muted',
                  )}
                >
                  <Check size={12} aria-hidden="true" className={check.passed ? '' : 'opacity-40'} />
                  {check.label}
                </li>
              ))}
            </ul>
          </div>

          {formError ? (
            <p role="alert" className="rounded-lg border border-state-danger/40 bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={registerState.isPending} iconRight={ArrowRight}>
            Create account
          </Button>

          <p className="text-center text-sm text-content-secondary">
            Already have an account?{' '}
            <Link to="/login" className="focus-ring rounded font-medium text-brand-300 hover:text-brand-200">
              Sign in
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-content-muted">
          Your profile is private by default. Nothing is public until you turn on sharing in
          Settings.
        </p>
      </section>
    </PageTransition>
  );
};

export default RegisterPage;
