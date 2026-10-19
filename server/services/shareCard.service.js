import fs from 'node:fs';
import { createRequire } from 'node:module';

import { PLATFORM_LABELS } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Server-rendered share card (1200x630, the standard Open Graph size).
 *
 * Pipeline: satori turns a plain element tree into SVG, then @resvg/resvg-js
 * rasterises it to PNG. Social crawlers cannot run JavaScript, so this has to
 * happen on the server - a client-side canvas would never be seen by LinkedIn.
 *
 * Fonts are loaded explicitly from @fontsource/ibm-plex-sans: satori has no access to
 * system fonts, and a deploy target like Render may not ship any.
 *
 * Every step degrades: if satori or resvg is unavailable, the endpoint falls
 * back to a hand-written SVG so the share link never 500s.
 */

const WIDTH = 1200;
const HEIGHT = 630;

/** Same family as the web app, so the PNG and the page look like one product. */
const FONT_FAMILY = 'IBM Plex Sans';

const require = createRequire(import.meta.url);

let fontCache = null;

const loadFonts = () => {
  if (fontCache) return fontCache;

  try {
    // @fontsource ships .woff, which satori supports (it cannot read .woff2).
    const regular = require.resolve(
      '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff',
    );
    const semibold = require.resolve(
      '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff',
    );

    fontCache = [
      { name: FONT_FAMILY, data: fs.readFileSync(regular), weight: 400, style: 'normal' },
      { name: FONT_FAMILY, data: fs.readFileSync(semibold), weight: 600, style: 'normal' },
    ];
  } catch (error) {
    logger.warn('Share card fonts unavailable - falling back to plain SVG', {
      error: error.message,
    });
    fontCache = null;
  }

  return fontCache;
};

/**
 * Card palettes. Keys are stored on user documents, so they never change;
 * only the colours do. Keep in sync with client/src/components/share/ProfileShareCard.jsx.
 */
export const THEMES = {
  // Ink
  'dark-neon': {
    background: '#161513',
    panel: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.12)',
    text: '#eceae4',
    muted: '#a8a399',
    accent: '#62c98c',
    accent2: '#a0e4bd',
    chip: 'rgba(255,255,255,0.05)',
  },
  // Graphite
  glass: {
    background: '#25282c',
    panel: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.16)',
    text: '#f2f2f0',
    muted: '#b4b8bd',
    accent: '#f2f2f0',
    accent2: '#9fd8b8',
    chip: 'rgba(255,255,255,0.06)',
  },
  // Paper
  'minimal-light': {
    background: '#f7f6f2',
    panel: '#ffffff',
    border: '#e2dfd6',
    text: '#1c1b18',
    muted: '#78736a',
    accent: '#1f7f4b',
    accent2: '#176e45',
    chip: '#ffffff',
  },
  // Green
  gradient: {
    background: '#1f7f4b',
    panel: 'rgba(0,0,0,0.12)',
    border: 'rgba(255,255,255,0.28)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
    accent: '#ffffff',
    accent2: '#d3f2df',
    chip: 'rgba(255,255,255,0.12)',
  },
};

export const resolveTheme = (name) => THEMES[name] ?? THEMES['dark-neon'];

/* ------------------------------------------------- element tree (no JSX) */

const node = (type, style, children) => ({
  type,
  props: { style, ...(children === undefined ? {} : { children }) },
});

const text = (value, style) => node('div', style, String(value));

/** Last 12 weeks of activity as a compact 7xN grid. */
const miniHeatmap = (heatmap, theme) => {
  const days = 84;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const columns = [];

  for (let week = 11; week >= 0; week -= 1) {
    const cells = [];

    for (let day = 0; day < 7; day += 1) {
      const offset = week * 7 + (6 - day);
      const date = new Date(today.getTime() - offset * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      const count = Number(heatmap?.[key] ?? 0);

      const opacity = count === 0 ? 0.12 : count < 2 ? 0.4 : count < 5 ? 0.7 : 1;

      cells.push(
        node('div', {
          width: '10px',
          height: '10px',
          borderRadius: '2px',
          backgroundColor: count === 0 ? theme.muted : theme.accent2,
          opacity,
        }),
      );
    }

    columns.push(node('div', { display: 'flex', flexDirection: 'column', gap: '3px' }, cells));
  }

  return node('div', { display: 'flex', gap: '3px' }, columns.slice(-days / 7));
};

const statBlock = (label, value, theme, accent) =>
  node('div', { display: 'flex', flexDirection: 'column', gap: '2px' }, [
    text(value, {
      fontSize: '40px',
      fontWeight: 600,
      color: accent ?? theme.text,
      lineHeight: 1.1,
    }),
    text(label, {
      fontSize: '16px',
      color: theme.muted,
      textTransform: 'uppercase',
      letterSpacing: '1px',
    }),
  ]);

export const buildCardTree = (card) => {
  const theme = resolveTheme(card.theme);

  const ratingRows = Object.entries(card.handles ?? {}).map(([platform, handle]) => {
    const rating =
      platform === 'codeforces'
        ? card.ratings.codeforces
        : platform === 'leetcode'
          ? card.ratings.leetcode
          : card.ratings.codechef;

    return node(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '12px 18px',
        borderRadius: '14px',
        backgroundColor: theme.chip,
        border: `1px solid ${theme.border}`,
      },
      [
        text(PLATFORM_LABELS[platform] ?? platform, { fontSize: '15px', color: theme.muted }),
        text(handle, { fontSize: '20px', fontWeight: 600, color: theme.text }),
        text(
          rating
            ? `${rating}${platform === 'codechef' && card.ratings.codechefStars ? ` · ${card.ratings.codechefStars}★` : ''}`
            : 'unrated',
          { fontSize: '16px', color: theme.accent2 },
        ),
      ],
    );
  });

  const topicChips = (card.topTopics ?? []).slice(0, 4).map((topic) =>
    node(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '999px',
        backgroundColor: theme.chip,
        border: `1px solid ${theme.border}`,
      },
      [
        node('div', {
          width: '10px',
          height: '10px',
          borderRadius: '999px',
          backgroundColor: topic.accent ?? theme.accent,
        }),
        text(`${topic.name} · ${topic.solved}`, { fontSize: '17px', color: theme.text }),
      ],
    ),
  );

  return node(
    'div',
    {
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '56px 64px',
      background: theme.background,
      fontFamily: FONT_FAMILY,
      color: theme.text,
    },
    [
      // header: identity + brand
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, [
        node('div', { display: 'flex', alignItems: 'center', gap: '22px' }, [
          node(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '28px',
              backgroundColor: theme.chip,
              border: `2px solid ${theme.border}`,
              fontSize: '44px',
              fontWeight: 600,
              color: theme.accent,
            },
            (card.displayName || card.username || '?').slice(0, 1).toUpperCase(),
          ),
          node('div', { display: 'flex', flexDirection: 'column', gap: '6px' }, [
            text(card.displayName || card.username, {
              fontSize: '46px',
              fontWeight: 600,
              lineHeight: 1.05,
            }),
            text(`@${card.username}`, { fontSize: '22px', color: theme.muted }),
          ]),
        ]),

        node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }, [
          text('CodeHub', { fontSize: '26px', fontWeight: 600, color: theme.accent }),
          text('unified CP dashboard', { fontSize: '15px', color: theme.muted }),
        ]),
      ]),

      // middle: platform handles
      node('div', { display: 'flex', gap: '16px' }, ratingRows),

      // stats + heatmap
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }, [
        node('div', { display: 'flex', gap: '48px' }, [
          statBlock('solved', String(card.totalSolved ?? 0), theme, theme.accent),
          statBlock('contests', String(card.contests ?? 0), theme),
          statBlock('day streak', String(card.streak ?? 0), theme),
        ]),
        node('div', { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }, [
          text('last 12 weeks', { fontSize: '14px', color: theme.muted }),
          miniHeatmap(card.heatmap, theme),
        ]),
      ]),

      // footer: topics
      node(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderTop: `1px solid ${theme.border}`,
          paddingTop: '22px',
        },
        topicChips.length > 0
          ? topicChips
          : [text('Add handles to fill this card', { fontSize: '18px', color: theme.muted })],
      ),
    ],
  );
};

/* ----------------------------------------------------------- rendering */

export const renderCardSvg = async (card) => {
  const fonts = loadFonts();
  if (!fonts) return fallbackSvg(card);

  try {
    const { default: satori } = await import('satori');

    return await satori(buildCardTree(card), { width: WIDTH, height: HEIGHT, fonts });
  } catch (error) {
    logger.error('satori render failed - using fallback SVG', { error: error.message });
    return fallbackSvg(card);
  }
};

/**
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
export const renderCardImage = async (card) => {
  const svg = await renderCardSvg(card);

  try {
    const { Resvg } = await import('@resvg/resvg-js');
    const fonts = loadFonts();

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: WIDTH },
      font: {
        loadSystemFonts: false,
        fontBuffers: fonts ? fonts.map((font) => font.data) : [],
        defaultFontFamily: FONT_FAMILY,
      },
    });

    return { buffer: resvg.render().asPng(), contentType: 'image/png' };
  } catch (error) {
    // Serving SVG is still useful: browsers render it, and the page never breaks.
    logger.error('PNG rasterisation failed - serving SVG instead', { error: error.message });
    return { buffer: Buffer.from(svg, 'utf8'), contentType: 'image/svg+xml' };
  }
};

/** Dependency-free card, used when satori or its fonts are unavailable. */
export const fallbackSvg = (card) => {
  const theme = resolveTheme(card.theme);
  const escape = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const handles = Object.entries(card.handles ?? {})
    .map(([platform, handle], index) => {
      const label = `${PLATFORM_LABELS[platform] ?? platform}: ${handle}`;
      return `<text x="64" y="${330 + index * 40}" font-size="24" fill="${theme.muted}" font-family="sans-serif">${escape(label)}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#161513" />
      <stop offset="100%" stop-color="#1c1b18" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <text x="64" y="120" font-size="28" fill="${theme.accent}" font-family="sans-serif">CodeHub</text>
  <text x="64" y="210" font-size="56" font-weight="600" fill="${theme.text}" font-family="sans-serif">${escape(card.displayName || card.username)}</text>
  <text x="64" y="256" font-size="24" fill="${theme.muted}" font-family="sans-serif">@${escape(card.username)}</text>
  ${handles}
  <text x="64" y="540" font-size="72" font-weight="600" fill="${theme.accent2}" font-family="sans-serif">${card.totalSolved ?? 0}</text>
  <text x="64" y="578" font-size="22" fill="${theme.muted}" font-family="sans-serif">problems solved across platforms</text>
</svg>`;
};

export default { renderCardImage, renderCardSvg, THEMES };
