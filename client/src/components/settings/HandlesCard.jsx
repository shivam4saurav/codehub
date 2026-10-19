import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CircleAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { fetchHandles, linkHandle, unlinkHandle } from '../../api/handles.api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PLATFORMS, PLATFORM_KEYS } from '../../utils/platform.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card.jsx';
import Input from '../ui/Input.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * Platform handle linking.
 *
 * A handle is saved even when the platform is unreachable (verified: false) -
 * a LeetCode outage should not stop someone finishing setup. The badge tells
 * the truth about which state a handle is in.
 */
export const HandlesCard = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: handles = [], isLoading } = useQuery({
    queryKey: ['handles'],
    queryFn: fetchHandles,
    staleTime: 60_000,
  });

  /**
   * Only edits live in state. The displayed value falls back to the saved
   * handle, so there is nothing to synchronise when the query resolves.
   */
  const [drafts, setDrafts] = useState({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['handles'] });
    queryClient.invalidateQueries({ queryKey: ['problems'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['recommendations'] });
  };

  const linkMutation = useMutation({
    mutationFn: linkHandle,
    onSuccess: (data) => {
      invalidate();
      if (data.verified) toast.success('Handle linked', data.message);
      else toast.warning('Handle saved', data.message);
    },
    onError: (error) => toast.error('Could not link handle', error.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkHandle,
    onSuccess: (data) => {
      invalidate();
      setDrafts((current) => ({ ...current, [data.platform]: '' }));
      toast.success('Handle removed');
    },
    onError: (error) => toast.error('Could not remove handle', error.message),
  });

  const byPlatform = Object.fromEntries(handles.map((row) => [row.platform, row]));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            Platform usernames
          </CardTitle>
          <CardDescription>
            Add your username for each platform you use. This powers your dashboard, the
            solved ticks on the Problems page, and Practice next suggestions.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="space-y-4">
        {PLATFORM_KEYS.map((platformKey) => {
          const platform = PLATFORMS[platformKey];
          const saved = byPlatform[platformKey];
          const draft = drafts[platformKey] ?? saved?.handle ?? '';
          const isDirty = draft.trim() !== '' && draft.trim() !== saved?.handle;

          return (
            <div
              key={platformKey}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-edge bg-surface-inset/60 p-3"
            >
              <div className="min-w-[12rem] flex-1">
                <Input
                  label={platform.label}
                  value={draft}
                  onChange={(event) =>
                    setDrafts({ ...drafts, [platformKey]: event.target.value })
                  }
                  placeholder={`Your ${platform.label} username`}
                  disabled={isLoading}
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center gap-2 pb-0.5">
                {saved ? (
                  saved.verified ? (
                    <Tooltip content="Verified against the platform">
                      <Badge variant="success" icon={BadgeCheck}>
                        Verified
                      </Badge>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Saved, but the platform did not confirm it yet">
                      <Badge variant="warning" icon={CircleAlert}>
                        Unverified
                      </Badge>
                    </Tooltip>
                  )
                ) : null}

                <Button
                  size="sm"
                  variant={isDirty ? 'primary' : 'secondary'}
                  disabled={!isDirty}
                  loading={linkMutation.isPending && linkMutation.variables?.platform === platformKey}
                  onClick={() =>
                    linkMutation.mutate({ platform: platformKey, handle: draft.trim() })
                  }
                >
                  {saved ? 'Update' : 'Save'}
                </Button>

                {saved ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${platform.label} handle`}
                    loading={unlinkMutation.isPending && unlinkMutation.variables === platformKey}
                    onClick={() => unlinkMutation.mutate(platformKey)}
                  >
                    <Trash2 size={15} className="text-state-danger" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>

              {saved ? (
                <a
                  href={platform.profileUrl(saved.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring w-full rounded text-xs text-content-muted underline-offset-2 hover:text-content-secondary hover:underline"
                >
                  Open {saved.handle} on {platform.label}
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default HandlesCard;
