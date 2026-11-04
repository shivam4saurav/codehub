import { ArrowUpRight, BadgeCheck, MapPin, School } from 'lucide-react';
import { Link } from 'react-router-dom';
import cn from '../../utils/cn.js';
import { PLATFORMS } from '../../utils/platform.js';
import RatingChart from '../profile/RatingChart.jsx';
import ProfileCard from '../share/ProfileCard.jsx';
import { SAMPLE, SAMPLE_HEATMAP, SAMPLE_PUBLIC_PROFILE, SAMPLE_RATING_HISTORY } from './sampleProfile.js';

/**
 * A product preview for the guest landing page, built from real UI pieces
 * with made-up data. It is labelled as an example so nobody mistakes it for
 * a real user. The dashboard links to /example and the card to /example/card.
 */

const DIFFICULTY_TOTAL = SAMPLE.difficulty.reduce((sum, part) => sum + part.value, 0);
/** Each segment's share of the ring and where it starts (cumulative share before it). */
const DIFFICULTY_SEGMENTS = SAMPLE.difficulty.map((part, index) => ({
  ...part,
  share: part.value / DIFFICULTY_TOTAL,
  start:
    SAMPLE.difficulty.slice(0, index).reduce((sum, prev) => sum + prev.value, 0) / DIFFICULTY_TOTAL,
}));

const LEVEL_CLASS = [
  'bg-surface-inset',
  'bg-brand-500/25',
  'bg-brand-500/45',
  'bg-brand-500/70',
  'bg-brand-500',
];

const Tile = ({ className, children }) => (
  <div className={cn('rounded-xl border border-edge bg-surface-raised p-3.5', className)}>{children}</div>
);

const StatTile = ({ label, value }) => (
  <Tile className="flex flex-col items-center justify-center text-center">
    <p className="text-[11px] font-medium text-content-muted">{label}</p>
    <p className="mt-1 text-2xl font-bold tracking-tight text-content-primary tabular">
      {value.toLocaleString()}
    </p>
  </Tile>
);

const Avatar = ({ size = 'lg' }) => (
  <span
    className={cn(
      'grid place-items-center rounded-full bg-brand-gradient font-bold text-white ring-4 ring-brand-500/15',
      size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-xl',
    )}
    aria-hidden="true"
  >
    {SAMPLE.name.slice(0, 1)}
  </span>
);

/** Easy / Medium / Hard as one segmented ring. */
const DifficultyDonut = () => {
  const size = 88;
  const thickness = 10;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--surface-inset))"
            strokeWidth={thickness}
          />
          {DIFFICULTY_SEGMENTS.map((part) => (
            <circle
                key={part.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={part.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, part.share * circumference - 3)} ${circumference}`}
                strokeDashoffset={-part.start * circumference}
              />
          ))}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-lg font-bold text-content-primary tabular">
          {DIFFICULTY_TOTAL}
        </span>
      </div>
      <ul className="flex-1 space-y-1.5 text-xs">
        {SAMPLE.difficulty.map((part) => (
          <li
            key={part.label}
            className="flex items-center justify-between rounded-lg bg-surface-inset px-2.5 py-1"
          >
            <span className="flex items-center gap-1.5 font-medium" style={{ color: part.color }}>
              {part.label}
            </span>
            <span className="font-mono text-content-primary">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const MiniHeatmap = ({ weeks }) => (
  <Tile className="col-span-2 min-w-0">
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
      <span className="text-content-secondary">
        <span className="font-semibold text-content-primary">1,284</span> submissions in the past 6
        months
      </span>
      <span className="text-content-muted">
        Max streak <span className="font-semibold text-content-primary">{SAMPLE.maxStreak}</span>
        {' · '}
        Current <span className="font-semibold text-content-primary">{SAMPLE.currentStreak}</span>
      </span>
    </div>
    <div className="flex gap-[3px] overflow-hidden" aria-hidden="true">
      {weeks.map((column, weekIndex) => (
        <div key={weekIndex} className="flex flex-1 flex-col gap-[3px]">
          {column.map((level, dayIndex) => (
            <span key={dayIndex} className={cn('aspect-square w-full rounded-[3px]', LEVEL_CLASS[level])} />
          ))}
        </div>
      ))}
    </div>
  </Tile>
);

const ProfileColumn = () => (
  <aside className="hidden flex-col rounded-xl border border-edge bg-surface-raised p-4 md:flex">
    <div className="flex flex-col items-center text-center">
      <Avatar />
      <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-content-primary">
        {SAMPLE.name}
        <BadgeCheck size={14} className="text-brand-500" aria-hidden="true" />
      </p>
      <p className="text-xs text-brand-300">@{SAMPLE.username}</p>
      <p className="mt-2 text-[11px] leading-snug text-content-muted">{SAMPLE.bio}</p>
    </div>
    <div className="mt-4 space-y-1.5 border-t border-edge pt-3 text-[11px] text-content-secondary">
      <p className="flex items-center gap-1.5">
        <MapPin size={12} aria-hidden="true" /> {SAMPLE.location}
      </p>
      <p className="flex items-center gap-1.5">
        <School size={12} aria-hidden="true" /> {SAMPLE.school}
      </p>
    </div>
    <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
      Platforms
    </p>
    <ul className="mt-2 space-y-1.5">
      {SAMPLE.platforms.map((entry) => {
        const platform = PLATFORMS[entry.key];
        return (
          <li
            key={entry.key}
            className="flex items-center justify-between rounded-lg bg-surface-inset px-2.5 py-1.5 text-xs"
          >
            <span className="flex items-center gap-2 font-medium text-content-primary">
              <span className="h-2 w-2 rounded-full" style={{ background: platform.accent }} aria-hidden="true" />
              {platform.label}
            </span>
            <span className="font-mono text-content-secondary">{entry.solved}</span>
          </li>
        );
      })}
    </ul>
  </aside>
);

/** The portrait card floating over the dashboard's corner, linking to its own page. */
const FloatingCard = () => (
  <Link
    to="/example/card"
    aria-label="Open the example profile card"
    className="focus-ring group absolute -right-14 top-16 hidden rounded-[1.75rem] transition-transform duration-200 hover:-translate-y-1 xl:block"
  >
    {/* zoom keeps the card's real layout, just smaller (320px -> 240px). */}
    <div style={{ zoom: 0.75 }}>
      <ProfileCard
        displayName={SAMPLE_PUBLIC_PROFILE.owner.displayName}
        username={SAMPLE_PUBLIC_PROFILE.owner.username}
        totalSolved={SAMPLE.totalSolved}
        activeDays={SAMPLE.activeDays}
        handles={SAMPLE_PUBLIC_PROFILE.handles}
        topics={SAMPLE.topics.slice(0, 4)}
        linkPlatforms={false}
      />
    </div>
    <OpenHint label="Open card" />
  </Link>
);

/** Small pill that appears on hover so it is obvious the preview is clickable. */
const OpenHint = ({ label }) => (
  <span
    className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 translate-y-1 rounded-full bg-content-primary px-3 py-1 text-xs font-medium text-surface-raised opacity-0 shadow-overlay transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
    aria-hidden="true"
  >
    {label}
    <ArrowUpRight size={12} className="ml-1 inline" />
  </span>
);

export const HeroPreview = ({ className }) => {
  return (
    <figure className={cn('relative mx-auto w-full max-w-5xl', className)}>
      {/* Warm glow behind the window. */}
      <div
        className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-brand-gradient-soft blur-2xl"
        aria-hidden="true"
      />
      <Link
        to="/example"
        aria-label="Open the example profile"
        className="focus-ring group relative block overflow-hidden rounded-2xl border border-edge bg-surface-base shadow-overlay transition duration-200 hover:border-brand-500/40 hover:shadow-lift"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-edge bg-surface-raised px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="mx-auto rounded-md bg-surface-inset px-3 py-0.5 font-mono text-[11px] text-content-muted">
            codehub / example
          </span>
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
            Example
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-[13rem_minmax(0,1fr)] xl:pr-48">
          <ProfileColumn />
          <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Total solved" value={SAMPLE.totalSolved} />
            <StatTile label="Active days" value={SAMPLE.activeDays} />
            <MiniHeatmap weeks={SAMPLE_HEATMAP} />

            <Tile className="col-span-2">
              <div className="mb-1 flex items-baseline justify-between">
                <p className="text-xs font-semibold text-content-primary">Codeforces rating</p>
                <p className="font-mono text-xs text-brand-300">1487 · +307</p>
              </div>
              <RatingChart
                history={SAMPLE_RATING_HISTORY}
                height={150}
                label="Example Codeforces rating"
                interactive={false}
              />
            </Tile>

            <Tile className="col-span-2">
              <p className="mb-3 text-xs font-semibold text-content-primary">Problems solved</p>
              <DifficultyDonut />
              <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-inset px-2.5 py-1.5 text-xs">
                <span className="text-content-secondary">Contests</span>
                <span className="font-mono font-semibold text-content-primary">{SAMPLE.contests}</span>
              </div>
            </Tile>
          </div>
        </div>
        <OpenHint label="Open profile" />
      </Link>
      <FloatingCard />
      <figcaption className="sr-only">
        Example of a CodeHub dashboard with made-up data: {SAMPLE.totalSolved} problems solved,{' '}
        {SAMPLE.activeDays} active days and a Codeforces rating of 1487.
      </figcaption>
    </figure>
  );
};

export default HeroPreview;
