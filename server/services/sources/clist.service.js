import axios from 'axios';

import env from '../../config/env.js';
import { PLATFORMS, SOURCES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import RequestQueue from '../../utils/requestQueue.js';
import { isTransientError, withRetry } from '../../utils/retry.js';
import { recordFailure, recordSuccess } from '../sourceHealth.service.js';

/**
 * clist.by aggregator - the source for LeetCode and CodeChef contests, which
 * have no official contest APIs.
 *
 * OPTIONAL BY DESIGN: with no credentials configured, `isEnabled()` is false
 * and the contest calendar simply runs on Codeforces plus whatever is already
 * cached in MongoDB. Nothing breaks, the UI just says so.
 *
 * Key page (needs a clist.by login): https://clist.by/api/v4/doc/
 */

const client = axios.create({
  baseURL: env.CLIST_API_BASE,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

// clist.by allows ~10 requests/minute, so keep a healthy gap.
const clistQueue = new RequestQueue({ minIntervalMs: 6500, name: 'clist' });

/**
 * Which clist "resource" maps to which CodeHub platform.
 * Codeforces is deliberately absent: its official API is the source of truth,
 * and taking it from clist too would list every round twice (different ids).
 */
export const RESOURCE_MAP = {
  'leetcode.com': PLATFORMS.LEETCODE,
  'codechef.com': PLATFORMS.CODECHEF,
};

/** Only ask clist for the judges CodeHub shows, so `limit` is not spent on others. */
const HOST_FILTER = `^(${Object.keys(RESOURCE_MAP)
  .map((host) => host.replace(/\./g, '\\.'))
  .join('|')})$`;

export const isEnabled = () => env.clistEnabled;

/**
 * clist's docs show the key in its header form, `ApiKey <username>:<key>`, and
 * that whole string is easy to paste into CLIST_API_KEY. Accept either shape:
 * a bare key, `<username>:<key>`, or the full header value.
 */
export const resolveCredentials = (username = env.CLIST_USERNAME, apiKey = env.CLIST_API_KEY) => {
  const pasted = /^(?:ApiKey\s+)?([^:\s]+):(\S+)$/i.exec(apiKey ?? '');
  if (pasted) return { username: pasted[1], apiKey: pasted[2] };

  return { username, apiKey };
};

const resourceName = (entry) => {
  // v4 returns either a string or an object depending on query shape.
  if (typeof entry.resource === 'string') return entry.resource;
  return entry.resource?.name ?? entry.host ?? '';
};

export const isValidContestPayload = (value) =>
  Boolean(
    value &&
      Array.isArray(value.objects) &&
      (value.objects.length === 0 ||
        (typeof value.objects[0]?.event === 'string' && typeof value.objects[0]?.start === 'string')),
  );

/** clist timestamps are UTC without a zone suffix. */
const parseUtc = (value) => {
  if (!value) return null;
  const normalised = /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Upcoming and running contests for the platforms CodeHub cares about.
 * @returns {Promise<Array<object>>} normalised contest rows
 */
export const fetchUpcomingContests = async ({ limit = 200 } = {}) => {
  if (!isEnabled()) {
    throw ApiError.serviceUnavailable('clist.by is not configured', { code: 'CLIST_DISABLED' });
  }

  const startedAt = Date.now();
  const credentials = resolveCredentials();

  const run = () =>
    clistQueue.add(async () => {
      const response = await client.get('/contest/', {
        params: {
          username: credentials.username,
          api_key: credentials.apiKey,
          host__regex: HOST_FILTER,
          upcoming: true,
          order_by: 'start',
          limit,
          format: 'json',
        },
      });

      if (!isValidContestPayload(response.data)) {
        throw ApiError.badGateway('clist.by response shape changed');
      }

      return response.data.objects;
    });

  try {
    const objects = await withRetry(run, {
      label: 'clist:contests',
      retries: 1,
      baseDelayMs: 2000,
      shouldRetry: isTransientError,
    });

    const rows = objects
      .map((entry) => {
        const platform = RESOURCE_MAP[resourceName(entry)];
        if (!platform) return null;

        const start = parseUtc(entry.start);
        const end = parseUtc(entry.end);
        if (!start || !end) return null;

        return {
          platform,
          externalId: String(entry.id),
          name: entry.event,
          url: entry.href,
          startTime: start,
          endTime: end,
          durationSeconds: entry.duration ?? Math.round((end - start) / 1000),
          source: SOURCES.CLIST_CONTESTS,
        };
      })
      .filter(Boolean);

    recordSuccess(SOURCES.CLIST_CONTESTS, { latencyMs: Date.now() - startedAt });
    logger.info('Fetched contests from clist.by', { total: objects.length, usable: rows.length });

    return rows;
  } catch (error) {
    recordFailure(SOURCES.CLIST_CONTESTS, error);
    throw error;
  }
};

export default { fetchUpcomingContests, isEnabled, resolveCredentials, RESOURCE_MAP };
