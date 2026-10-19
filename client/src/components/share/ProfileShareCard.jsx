import { forwardRef } from 'react';

import { formatNumber } from '../../utils/format.js';
import { PLATFORMS } from '../../utils/platform.js';

/**
 * The share card, rendered in the DOM.
 *
 * Two renderers exist on purpose:
 *  - this component, captured client-side with html-to-image for the PNG
 *    download (always available, uses the fonts already loaded in the page);
 *  - the server-side satori version, which social crawlers need because they
 *    never execute JavaScript.
 *
 * Both share the same four themes so the download matches the link preview.
 */

// Keys are stored on user documents and never change; only labels and colours do.
export const CARD_THEMES = [
  { key: 'minimal-light', label: 'Paper' },
  { key: 'dark-neon', label: 'Ink' },
  { key: 'glass', label: 'Graphite' },
  { key: 'gradient', label: 'Green' },
];

/** Keep in sync with THEMES in server/services/shareCard.service.js. */
const THEME_STYLES = {
  'dark-neon': {
    background: '#161513',
    text: '#eceae4',
    muted: '#a8a399',
    accent: '#62c98c',
    accent2: '#a0e4bd',
    chip: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
  },
  glass: {
    background: '#25282c',
    text: '#f2f2f0',
    muted: '#b4b8bd',
    accent: '#f2f2f0',
    accent2: '#9fd8b8',
    chip: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.16)',
  },
  'minimal-light': {
    background: '#f7f6f2',
    text: '#1c1b18',
    muted: '#78736a',
    accent: '#1f7f4b',
    accent2: '#176e45',
    chip: '#ffffff',
    border: '#e2dfd6',
  },
  gradient: {
    background: '#1f7f4b',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
    accent: '#ffffff',
    accent2: '#d3f2df',
    chip: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.28)',
  },
};

/** Last 12 weeks, oldest column first. */
const heatmapColumns = (heatmap = {}) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: 12 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const offset = (11 - weekIndex) * 7 + (6 - dayIndex);
      const date = new Date(today.getTime() - offset * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      return { key, count: Number(heatmap[key] ?? 0) };
    }),
  );
};

export const ProfileShareCard = forwardRef(({ card, theme = 'dark-neon', scale = 1 }, ref) => {
  const palette = THEME_STYLES[theme] ?? THEME_STYLES['dark-neon'];
  const columns = heatmapColumns(card?.heatmap);

  const platformEntries = Object.entries(card?.handles ?? {});

  return (
    <div
      ref={ref}
      // Fixed 1200x630 so the capture matches the server-rendered OG image.
      style={{
        width: 1200,
        height: 630,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'top left',
        background: palette.background,
        color: palette.text,
        padding: '56px 64px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: palette.chip,
              border: `2px solid ${palette.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontWeight: 600,
              color: palette.accent,
            }}
          >
            {(card?.displayName || card?.username || '?').slice(0, 1).toUpperCase()}
          </div>

          <div>
            <p style={{ margin: 0, fontSize: 46, fontWeight: 600, lineHeight: 1.05 }}>
              {card?.displayName || card?.username}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 22, color: palette.muted }}>
              @{card?.username}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 600, color: palette.accent }}>CodeHub</p>
          <p style={{ margin: '6px 0 0', fontSize: 15, color: palette.muted }}>
            unified CP dashboard
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {platformEntries.length === 0 ? (
          <p style={{ margin: 0, fontSize: 18, color: palette.muted }}>No handles linked yet</p>
        ) : (
          platformEntries.map(([platform, handle]) => {
            const rating = card?.ratings?.[platform] ?? null;

            return (
              <div
                key={platform}
                style={{
                  padding: '12px 18px',
                  borderRadius: 14,
                  background: palette.chip,
                  border: `1px solid ${palette.border}`,
                  minWidth: 180,
                }}
              >
                <p style={{ margin: 0, fontSize: 15, color: palette.muted }}>
                  {PLATFORMS[platform]?.label ?? platform}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 600 }}>{handle}</p>
                <p style={{ margin: '2px 0 0', fontSize: 16, color: palette.accent2 }}>
                  {rating
                    ? `${rating}${
                        platform === 'codechef' && card?.ratings?.codechefStars
                          ? ` · ${card.ratings.codechefStars}★`
                          : ''
                      }`
                    : 'unrated'}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 48 }}>
          {[
            { label: 'solved', value: card?.totalSolved ?? 0, color: palette.accent },
            { label: 'contests', value: card?.contests ?? 0 },
            { label: 'day streak', value: card?.streak ?? 0 },
          ].map((stat) => (
            <div key={stat.label}>
              <p
                style={{
                  margin: 0,
                  fontSize: 40,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  color: stat.color ?? palette.text,
                }}
              >
                {formatNumber(stat.value)}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 16,
                  color: palette.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: palette.muted }}>last 12 weeks</p>
          <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
            {columns.map((column, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {column.map((cell) => (
                  <div
                    key={cell.key}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: cell.count === 0 ? palette.muted : palette.accent2,
                      opacity: cell.count === 0 ? 0.12 : cell.count < 2 ? 0.4 : cell.count < 5 ? 0.7 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderTop: `1px solid ${palette.border}`,
          paddingTop: 22,
        }}
      >
        {(card?.topTopics ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 18, color: palette.muted }}>
            Solve problems to fill this row
          </p>
        ) : (
          card.topTopics.slice(0, 4).map((topic) => (
            <div
              key={topic.topicKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 999,
                background: palette.chip,
                border: `1px solid ${palette.border}`,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: topic.accent ?? palette.accent,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 17 }}>
                {topic.name} · {topic.solved}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

ProfileShareCard.displayName = 'ProfileShareCard';

export default ProfileShareCard;
