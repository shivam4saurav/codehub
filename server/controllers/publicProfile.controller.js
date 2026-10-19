import env from '../config/env.js';
import {
  cardDescription,
  getCardData,
  getPublicProfile,
} from '../services/publicProfile.service.js';
import { renderCardImage } from '../services/shareCard.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import cache from '../utils/cache.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** GET /api/public/:username */
export const publicProfile = asyncHandler(async (req, res) => {
  const { username } = req.validated.params;
  const profile = await getPublicProfile(username);

  res.set('Cache-Control', 'public, max-age=120');
  res.json(profile);
});

/**
 * GET /api/card/:username.png
 * Rendered on the server because social crawlers never execute JavaScript.
 */
export const cardImage = asyncHandler(async (req, res) => {
  const { username } = req.validated.params;

  const cacheKey = `card:${username.toLowerCase()}:${req.validated.query.theme ?? 'default'}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    res.set({ 'Content-Type': cached.contentType, 'Cache-Control': 'public, max-age=600' });
    res.send(cached.buffer);
    return;
  }

  const card = await getCardData(username);
  if (req.validated.query.theme) card.theme = req.validated.query.theme;

  const image = await renderCardImage(card);

  cache.set(cacheKey, image, 600);

  res.set({
    'Content-Type': image.contentType,
    'Cache-Control': 'public, max-age=600',
    'Content-Disposition': `inline; filename="codehub-${card.username}.png"`,
  });
  res.send(image.buffer);
});

/**
 * GET /share/:username  (mounted outside /api)
 *
 * A React SPA cannot provide per-user Open Graph tags, because crawlers do not
 * run JS. This route returns a tiny HTML document with the correct meta tags
 * and forwards real browsers to the SPA.
 */
export const shareHtml = asyncHandler(async (req, res) => {
  const { username } = req.validated.params;

  const card = await getCardData(username);

  const title = `${card.displayName} on CodeHub`;
  const description = cardDescription(card);
  const profileUrl = `${env.CLIENT_URL}/u/${encodeURIComponent(card.username)}`;
  const imageUrl = `${env.SERVER_URL}/api/card/${encodeURIComponent(card.username)}.png`;

  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });

  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(profileUrl)}" />

    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="CodeHub" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(profileUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

    <!-- Humans get the real app; crawlers already have what they need above. -->
    <meta http-equiv="refresh" content="0; url=${escapeHtml(profileUrl)}" />
  </head>
  <body style="font-family:system-ui;background:#f7f6f2;color:#1c1b18;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
    <main style="text-align:center;padding:2rem">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" width="600" style="max-width:100%;border-radius:16px" />
      <p style="margin-top:1.5rem">
        Redirecting to <a href="${escapeHtml(profileUrl)}" style="color:#1f7f4b">${escapeHtml(profileUrl)}</a>
      </p>
    </main>
  </body>
</html>`);
});

export default { publicProfile, cardImage, shareHtml };
