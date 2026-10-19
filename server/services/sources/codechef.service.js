import axios from 'axios';

import env from '../../config/env.js';
import { SOURCES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import RequestQueue from '../../utils/requestQueue.js';
import { isTransientError, withRetry } from '../../utils/retry.js';
import { recordFailure, recordSuccess } from '../sourceHealth.service.js';

/**
 * CodeChef adapter (UNOFFICIAL, HTML based).
 * ---------------------------------------------------------------------------
 * CodeChef exposes no public API, so this reads the public profile page and
 * extracts a small, well-defined set of fields. Markup changes WILL break the
 * extraction, which is precisely why:
 *   - every field is optional and defaulted,
 *   - `isValidProfile` refuses half-parsed results,
 *   - callers wrap this in fetchWithFallback() and serve the last snapshot.
 *
 * Keep all parsing here; no other module should know CodeChef is scraped.
 */

const client = axios.create({
  timeout: 20_000,
  maxRedirects: 3,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  validateStatus: (status) => status < 500,
  responseType: 'text',
});

const codechefQueue = new RequestQueue({ minIntervalMs: 1200, name: 'codechef' });

const firstMatch = (html, patterns, transform = (value) => value) => {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1] !== undefined) return transform(match[1].trim());
  }
  return null;
};

const toNumber = (value) => {
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};

/**
 * Pull the fields we care about out of the profile HTML.
 * Exported so the parser can be unit tested against a saved fixture.
 */
export const parseProfileHtml = (html, handle) => {
  const rating = firstMatch(
    html,
    [
      /<div class="rating-number">\s*([\d]+)\s*</i,
      /class="rating-number"[^>]*>\s*([\d]+)/i,
    ],
    toNumber,
  );

  const maxRating = firstMatch(
    html,
    [/Highest\s*Rating\s*<?[^>]*>?\s*([\d]+)/i, /Highest Rating\s*([\d]+)/i],
    toNumber,
  );

  const stars = firstMatch(html, [/<span class="rating">\s*(\d+)\s*★/i, /(\d)\s*★/], toNumber);

  // The ranks block holds global rank then country rank.
  const ranksBlock = /<div class="rating-ranks">([\s\S]{0,600}?)<\/div>/i.exec(html)?.[1] ?? '';
  const rankValues = [...ranksBlock.matchAll(/<strong>\s*([\d,]+)\s*<\/strong>/gi)].map((match) =>
    toNumber(match[1]),
  );

  const country = firstMatch(html, [
    /class="user-country-name"[^>]*>\s*([^<]+)</i,
    /itemprop="addressCountry"[^>]*>\s*([^<]+)</i,
  ]);

  const avatar = firstMatch(html, [
    /<img[^>]+src="([^"]+)"[^>]*class="[^"]*profile[^"]*"/i,
    /class="user-details-container"[\s\S]{0,300}?<img[^>]+src="([^"]+)"/i,
  ]);

  const fullySolved = firstMatch(
    html,
    [
      /Fully Solved\s*\(?\s*(\d+)\s*\)?/i,
      /Total Problems Solved:?\s*<?[^>]*>?\s*(\d+)/i,
      /Problems Solved:?\s*<?[^>]*>?\s*(\d+)/i,
    ],
    toNumber,
  );

  const partiallySolved = firstMatch(html, [/Partially Solved\s*\(?\s*(\d+)\s*\)?/i], toNumber);

  const displayName = firstMatch(html, [
    /<h1 class="h2-style"[^>]*>\s*([^<]+)</i,
    /<div class="user-details-container">[\s\S]{0,400}?<h2[^>]*>\s*([^<]+)</i,
  ]);

  return {
    handle,
    displayName: displayName ?? handle,
    rating,
    maxRating: maxRating ?? rating,
    stars,
    globalRank: rankValues[0] ?? null,
    countryRank: rankValues[1] ?? null,
    country,
    avatarUrl: avatar && avatar.startsWith('http') ? avatar : null,
    problemsSolved: fullySolved,
    partiallySolved,
    profileUrl: `${env.CODECHEF_PROFILE_BASE}/${encodeURIComponent(handle)}`,
  };
};

/**
 * A result is only trustworthy if the page actually looked like a profile.
 * Requiring at least one real signal stops an error page or a redesigned
 * layout from silently overwriting a good snapshot with empty fields.
 */
export const isValidProfile = (value) =>
  Boolean(
    value &&
      typeof value.handle === 'string' &&
      value.handle.length > 0 &&
      (Number.isFinite(value.rating) ||
        Number.isFinite(value.problemsSolved) ||
        Number.isFinite(value.stars)),
  );

export const fetchUserProfile = async (handle) => {
  const startedAt = Date.now();
  const url = `${env.CODECHEF_PROFILE_BASE}/${encodeURIComponent(handle)}`;

  const run = () =>
    codechefQueue.add(async () => {
      const response = await client.get(url);

      if (response.status === 404) {
        throw ApiError.notFound(`CodeChef user "${handle}" was not found`, {
          code: 'HANDLE_NOT_FOUND',
        });
      }

      if (response.status >= 400) {
        throw ApiError.badGateway(`CodeChef responded with status ${response.status}`);
      }

      const html = String(response.data ?? '');

      // CodeChef serves a 200 page for unknown users in some regions.
      if (/user\s+not\s+found|page\s+not\s+found/i.test(html) && html.length < 60_000) {
        throw ApiError.notFound(`CodeChef user "${handle}" was not found`, {
          code: 'HANDLE_NOT_FOUND',
        });
      }

      const parsed = parseProfileHtml(html, handle);

      if (!isValidProfile(parsed)) {
        throw ApiError.badGateway('CodeChef profile markup changed - nothing usable was parsed');
      }

      return parsed;
    });

  try {
    const profile = await withRetry(run, {
      label: 'codechef:profile',
      retries: 2,
      baseDelayMs: 1200,
      shouldRetry: (error) =>
        !(error instanceof ApiError && error.statusCode === 404) && isTransientError(error),
    });

    recordSuccess(SOURCES.CODECHEF_PROFILE, { latencyMs: Date.now() - startedAt });
    return profile;
  } catch (error) {
    if (!(error instanceof ApiError && error.statusCode === 404)) {
      recordFailure(SOURCES.CODECHEF_PROFILE, error);
    }
    throw error;
  }
};

export default { fetchUserProfile, parseProfileHtml, isValidProfile };
