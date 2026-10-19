import { useMutation } from '@tanstack/react-query';
import { ExternalLink, Eye, Save } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { changePasswordRequest } from '../api/auth.api.js';
import { PageTransition, Reveal } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import HandlesCard from '../components/settings/HandlesCard.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import Input, { Select, Textarea } from '../components/ui/Input.jsx';
import { Switch } from '../components/ui/Toggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const CARD_THEMES = [
  { value: 'minimal-light', label: 'Paper' },
  { value: 'dark-neon', label: 'Ink' },
  { value: 'glass', label: 'Graphite' },
  { value: 'gradient', label: 'Green' },
];

/** Jump links at the top of the page, in the same order as the cards. */
const SETTINGS_SECTIONS = [
  { id: 'usernames', label: 'Platform usernames' },
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'sharing', label: 'Public profile' },
  { id: 'password', label: 'Password' },
];

/**
 * Profile details form. Mounted with a `key` tied to the user id so its initial
 * values come from a useState initialiser instead of an effect that mirrors the
 * server response into local state.
 */
const ProfileDetailsCard = ({ user, onSave, isSaving }) => {
  const toast = useToast();

  const [form, setForm] = useState({
    displayName: user?.displayName ?? '',
    bio: user?.bio ?? '',
    avatarUrl: user?.avatarUrl ?? '',
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await onSave(form);
      toast.success('Profile saved');
    } catch (error) {
      toast.error('Could not save profile', error.message);
    }
  };

  return (
    <Card as="form" id="profile" className="scroll-mt-24" onSubmit={handleSubmit}>
      <CardHeader>
        <div>
          <CardTitle>
            Profile
          </CardTitle>
          <CardDescription>
            Shown on your dashboard and, if enabled, your public card.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Display name"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          placeholder={user?.username}
          maxLength={60}
        />

        <Input
          label="Avatar URL"
          value={form.avatarUrl}
          onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })}
          placeholder="https://…"
          hint="Leave empty to use your initial"
        />

        <div className="sm:col-span-2">
          <Textarea
            label="Bio"
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            maxLength={240}
            rows={3}
            hint={`${form.bio.length}/240 characters`}
            placeholder="Third-year CSE student. Grinding graphs and DP."
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" icon={Save} loading={isSaving}>
          Save profile
        </Button>
      </div>
    </Card>
  );
};

export const SettingsPage = () => {
  const { user, updateProfile, updateProfileState } = useAuth();
  const { preference, setPreference, reducedMotion, setReducedMotion } = useTheme();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });

  const passwordMutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: (data) => {
      setPasswordForm({ currentPassword: '', newPassword: '' });
      toast.success('Password updated', data.message);
    },
    onError: (error) => toast.error('Could not update password', error.message),
  });

  const savePreference = async (patch) => {
    try {
      await updateProfile(patch);
    } catch (error) {
      toast.error('Could not save setting', error.message);
    }
  };

  const publicProfile = user?.publicProfile ?? { enabled: false, cardTheme: 'dark-neon' };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {searchParams.get('welcome') ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
            <div className="text-sm">
              <p className="font-medium text-content-primary">Your account is ready.</p>
              <p className="mt-0.5 text-content-secondary">
                Next step: add your platform usernames below. Then open{' '}
                <Link to="/profile" className="focus-ring rounded font-medium text-brand-300 hover:underline">
                  My dashboard
                </Link>{' '}
                to see everything in one place.
              </p>
            </div>
          </div>
        ) : null}

        <PageHeader
          title="Settings"
          description="Your platform usernames, profile details, theme, public sharing and password."
        >
          <nav aria-label="Settings sections" className="flex flex-wrap gap-1.5">
            {SETTINGS_SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="chip focus-ring">
                {section.label}
              </a>
            ))}
          </nav>
        </PageHeader>

        <div className="space-y-5">
          {/* --------------------------------------------------------- handles */}
          <Reveal>
            <div id="usernames" className="scroll-mt-24">
              <HandlesCard />
            </div>
          </Reveal>

          {/* --------------------------------------------------------- profile */}
          <Reveal>
            {/* Keyed on the user so a refetch re-seeds the inputs by remounting,
                rather than through a state-syncing effect. */}
            <ProfileDetailsCard
              key={user?.id ?? 'anonymous'}
              user={user}
              onSave={updateProfile}
              isSaving={updateProfileState.isPending}
            />
          </Reveal>

          {/* ------------------------------------------------------ appearance */}
          <Reveal>
            <Card id="appearance" className="scroll-mt-24">
              <CardHeader>
                <div>
                  <CardTitle>
                    Appearance & accessibility
                  </CardTitle>
                  <CardDescription>
                    Stored on this device, and on your account when signed in.
                  </CardDescription>
                </div>
              </CardHeader>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Theme"
                    value={preference}
                    onChange={(event) => {
                      setPreference(event.target.value);
                      savePreference({ preferences: { theme: event.target.value } });
                    }}
                  >
                    <option value="light">Light (default)</option>
                    <option value="dark">Dark</option>
                    <option value="system">Match system</option>
                  </Select>
                </div>

                <Switch
                  checked={reducedMotion}
                  onCheckedChange={(checked) => {
                    setReducedMotion(checked);
                    savePreference({ preferences: { reducedMotion: checked } });
                  }}
                  label="Reduce motion"
                  description="Turns off page transitions and the animated hero. Your OS setting is respected automatically too."
                />

                <Switch
                  checked={user?.preferences?.emailReminders ?? true}
                  onCheckedChange={(checked) =>
                    savePreference({ preferences: { emailReminders: checked } })
                  }
                  label="Contest reminder emails"
                  description="Master switch for reminder delivery. Individual reminders are managed on the Reminders page."
                />
              </div>
            </Card>
          </Reveal>

          {/* -------------------------------------------------- public profile */}
          <Reveal>
            <Card id="sharing" className="scroll-mt-24">
              <CardHeader>
                <div>
                  <CardTitle>
                    Public profile & share card
                  </CardTitle>
                  <CardDescription>
                    Off by default. Nothing is publicly visible until you turn this on.
                  </CardDescription>
                </div>

                <Badge variant={publicProfile.enabled ? 'success' : 'neutral'}>
                  {publicProfile.enabled ? 'Public' : 'Private'}
                </Badge>
              </CardHeader>

              <div className="space-y-5">
                <Switch
                  checked={publicProfile.enabled}
                  onCheckedChange={(checked) =>
                    savePreference({ publicProfile: { enabled: checked } })
                  }
                  label="Enable my public profile"
                  description="Publishes /u/your-username with your handles, ratings, solved counts and top topics."
                />

                {publicProfile.enabled ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/70 bg-surface-inset/50 p-3">
                      <Eye size={14} className="text-content-muted" aria-hidden="true" />
                      <code className="min-w-0 flex-1 truncate font-mono text-xs text-content-secondary">
                        {publicUrl}
                      </code>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(publicUrl);
                          toast.success('Link copied');
                        }}
                      >
                        Copy
                      </Button>

                      <Button
                        as={Link}
                        to={`/u/${user.username}`}
                        size="xs"
                        variant="ghost"
                        icon={ExternalLink}
                      >
                        View
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Card theme"
                        value={publicProfile.cardTheme}
                        onChange={(event) =>
                          savePreference({ publicProfile: { cardTheme: event.target.value } })
                        }
                      >
                        {CARD_THEMES.map((theme) => (
                          <option key={theme.value} value={theme.value}>
                            {theme.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Switch
                      checked={publicProfile.showEmail}
                      onCheckedChange={(checked) =>
                        savePreference({ publicProfile: { showEmail: checked } })
                      }
                      label="Show my email on the public profile"
                      description="Most people leave this off."
                    />
                  </>
                ) : null}
              </div>
            </Card>
          </Reveal>

          {/* -------------------------------------------------------- password */}
          <Reveal>
            <Card
              as="form"
              id="password"
              className="scroll-mt-24"
              onSubmit={(event) => {
                event.preventDefault();
                passwordMutation.mutate(passwordForm);
              }}
            >
              <CardHeader>
                <div>
                  <CardTitle>
                    Password
                  </CardTitle>
                  <CardDescription>
                    Changing your password signs you out of every device.
                  </CardDescription>
                </div>
              </CardHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm({ ...passwordForm, currentPassword: event.target.value })
                  }
                  required
                />

                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  hint="Min 8 characters, with a letter and a number"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm({ ...passwordForm, newPassword: event.target.value })
                  }
                  required
                />
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={passwordMutation.isPending}
                  disabled={!passwordForm.currentPassword || !passwordForm.newPassword}
                >
                  Update password
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  );
};

export default SettingsPage;
