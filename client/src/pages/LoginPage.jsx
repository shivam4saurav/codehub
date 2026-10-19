import { ArrowRight, AtSign, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { PageTransition } from '../components/common/Motion.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { safeRedirectPath } from '../utils/safeRedirect.js';

export const LoginPage = () => {
  const { login, loginState } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [formError, setFormError] = useState('');

  // Sanitised: ?next= is user-controlled, so only same-origin paths are honoured.
  const nextPath = safeRedirectPath(searchParams.get('next'), '/profile');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!form.identifier.trim() || !form.password) {
      setFormError('Enter your email/username and password.');
      return;
    }

    try {
      await login(form);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <PageTransition>
      <section className="mx-auto flex w-full max-w-md flex-col justify-center px-5 py-10 sm:px-6 sm:py-16">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-content-primary sm:text-3xl">
            Sign in to CodeHub
          </h1>
          <p className="mt-2 text-sm text-content-secondary">
            Get back to your dashboard, bookmarks and contest reminders.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass space-y-5 p-6" noValidate>
          <Input
            label="Email or username"
            name="identifier"
            icon={AtSign}
            autoComplete="username"
            placeholder="you@example.com"
            value={form.identifier}
            onChange={(event) => setForm({ ...form, identifier: event.target.value })}
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            icon={KeyRound}
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />

          {formError ? (
            <p role="alert" className="rounded-lg border border-state-danger/40 bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={loginState.isPending} iconRight={ArrowRight}>
            Sign in
          </Button>

          <p className="text-center text-sm text-content-secondary">
            New to CodeHub?{' '}
            <Link to="/register" className="focus-ring rounded font-medium text-brand-300 hover:text-brand-200">
              Create an account
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-content-muted">
          Don&apos;t want an account yet?{' '}
          <Link to="/profile" className="focus-ring rounded font-medium text-brand-300 hover:underline">
            Try the dashboard as a guest
          </Link>
        </p>
      </section>
    </PageTransition>
  );
};

export default LoginPage;
