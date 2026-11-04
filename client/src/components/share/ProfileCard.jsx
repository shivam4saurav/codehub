import { BadgeCheck } from 'lucide-react';
import { forwardRef } from 'react';
import cn from '../../utils/cn.js';
import { formatNumber } from '../../utils/format.js';
import { PLATFORMS } from '../../utils/platform.js';

const topicTag = (topic) => `#${(topic.short || topic.name).toLowerCase().replace(/\s+/g, '-')}`;

export const ProfileCard = forwardRef(
  (
    {
      displayName,
      username,
      totalSolved = 0,
      activeDays = 0,
      handles = {},
      topics = [],
      linkPlatforms = true,
      className,
    },
    ref,
  ) => {
    const name = displayName || username;
    const platformEntries = Object.entries(handles).filter(([key, handle]) => PLATFORMS[key] && handle);
    return (
      <div
        ref={ref}
        className={cn(
          'w-80 rounded-[1.75rem] border border-edge bg-surface-raised p-3 text-left shadow-overlay',
          className,
        )}
      >
        <div className="flex items-baseline justify-between px-2 pb-3 pt-1">
          <p className="text-sm font-bold leading-none text-content-primary">
            Code<span className="text-brand-300">Hub</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-content-muted">Card</p>
        </div>

        <div className="relative overflow-hidden rounded-[1.25rem] border border-edge bg-surface-inset/60 px-3 pb-3 pt-6">
          {/* Faint rings behind the avatar. */}
          <div
            className="pointer-events-none absolute left-1/2 top-[-4.5rem] h-64 w-64 -translate-x-1/2 rounded-full border border-edge/70"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[-1.5rem] h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(249_115_22/0.14),transparent_70%)]"
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <span
                className="grid h-24 w-24 place-items-center rounded-full bg-brand-gradient text-4xl font-bold text-white ring-4 ring-brand-500/25 ring-offset-2 ring-offset-surface-raised"
                aria-hidden="true"
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface-raised bg-brand-600 font-mono text-[11px] font-semibold text-white"
                aria-hidden="true"
              >
                ch
              </span>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-lg font-bold text-content-primary">
              {name}
              <BadgeCheck size={17} className="text-state-success" aria-label="Linked platforms verified" />
            </p>
            <span className="mt-1.5 rounded-full bg-brand-500/15 px-3 py-0.5 text-xs font-medium text-brand-300">
              @{username}
            </span>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-edge bg-surface-raised px-2 py-3 text-center">
              <p className="text-[11px] font-medium text-brand-300">Questions solved</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-content-primary tabular">
                {formatNumber(totalSolved)}
              </p>
            </div>
            <div className="rounded-xl border border-edge bg-surface-raised px-2 py-3 text-center">
              <p className="text-[11px] font-medium text-state-success">Active days</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-content-primary tabular">
                {formatNumber(activeDays)}
              </p>
            </div>
          </div>

          {platformEntries.length > 0 ? (
            <div className="relative mt-2 rounded-xl border border-edge bg-surface-raised px-3 py-3 text-center">
              <p className="text-[11px] font-medium text-content-secondary">You can find me on…</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {platformEntries.map(([key, handle]) => {
                  const platform = PLATFORMS[key];
                  const chip = (
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg font-mono text-[11px] font-bold text-white"
                      style={{ background: platform.accent }}
                    >
                      {platform.short}
                    </span>
                  );
                  return linkPlatforms ? (
                    <a
                      key={key}
                      href={platform.profileUrl(handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${platform.label}: ${handle}`}
                      aria-label={`${platform.label} profile: ${handle}`}
                      className="focus-ring rounded-lg transition-transform hover:-translate-y-0.5"
                    >
                      {chip}
                    </a>
                  ) : (
                    <span key={key} title={`${platform.label}: ${handle}`}>
                      {chip}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {topics.length > 0 ? (
            <div className="relative mt-2 flex flex-wrap justify-center gap-1.5 rounded-xl border border-edge bg-surface-raised px-2 py-2.5">
              {topics.slice(0, 6).map((topic) => (
                <span
                  key={topic.topicKey}
                  className="rounded-md bg-surface-inset px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-content-secondary"
                >
                  {topicTag(topic)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

ProfileCard.displayName = 'ProfileCard';
export default ProfileCard;
