import { PLATFORMS, PLATFORM_LABELS } from '../config/constants.js';
import PlatformHandle from '../models/PlatformHandle.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { invalidateActivity } from './userActivity.service.js';
import * as codeforces from './sources/codeforces.service.js';
import * as codechef from './sources/codechef.service.js';
import * as leetcode from './sources/leetcode.service.js';

/**
 * Linking a platform handle to a CodeHub account.
 *
 * Verification is best effort by design: if the platform is down we still save
 * the handle (verified: false) rather than blocking the user on someone else's
 * outage. A later profile fetch will flip it to verified.
 */

const VERIFIERS = {
  [PLATFORMS.CODEFORCES]: async (handle) => {
    const info = await codeforces.fetchUserInfo(handle);
    return { handle: info.handle };
  },
  [PLATFORMS.LEETCODE]: async (handle) => {
    const data = await leetcode.fetchUserProfile(handle);
    return { handle: data.matchedUser.username };
  },
  [PLATFORMS.CODECHEF]: async (handle) => {
    const profile = await codechef.fetchUserProfile(handle);
    return { handle: profile.handle };
  },
};

const verifyHandle = async (platform, handle) => {
  const verifier = VERIFIERS[platform];
  if (!verifier) return { verified: false, canonicalHandle: handle, reason: 'no-verifier' };

  try {
    const result = await verifier(handle);
    return { verified: true, canonicalHandle: result.handle || handle };
  } catch (error) {
    // A confirmed "no such user" is the user's mistake - surface it.
    if (error instanceof ApiError && error.statusCode === 404) throw error;

    logger.warn('Handle verification skipped (source unavailable)', {
      platform,
      handle,
      reason: error.message,
    });

    return { verified: false, canonicalHandle: handle, reason: 'source-unavailable' };
  }
};

export const listHandles = async (userId) => {
  const rows = await PlatformHandle.find({ userId }).lean();

  return rows.map((row) => ({
    id: String(row._id),
    platform: row.platform,
    handle: row.handle,
    verified: row.verified,
    lastVerifiedAt: row.lastVerifiedAt ?? null,
    lastSyncedAt: row.lastSyncedAt ?? null,
  }));
};

/** platform -> handle string, for the dashboard and recommender. */
export const getHandleMap = async (userId) => {
  if (!userId) return {};

  const rows = await PlatformHandle.find({ userId }).lean();
  return Object.fromEntries(rows.map((row) => [row.platform, row.handle]));
};

export const linkHandle = async ({ userId, platform, handle }) => {
  const trimmed = handle.trim();
  const { verified, canonicalHandle, reason } = await verifyHandle(platform, trimmed);

  const normalizedHandle = canonicalHandle.trim().toLowerCase();

  // Another account may already own this handle (unique index enforces it too).
  const owner = await PlatformHandle.findOne({ platform, normalizedHandle }).lean();
  if (owner && String(owner.userId) !== String(userId)) {
    throw ApiError.conflict(
      `That ${PLATFORM_LABELS[platform]} handle is already linked to another CodeHub account`,
    );
  }

  const existing = await PlatformHandle.findOne({ userId, platform });

  // Changing the handle invalidates the cached activity of the old one.
  if (existing && existing.normalizedHandle !== normalizedHandle) {
    invalidateActivity(platform, existing.handle);
  }

  const document = await PlatformHandle.findOneAndUpdate(
    { userId, platform },
    {
      $set: {
        handle: canonicalHandle,
        normalizedHandle,
        verified,
        lastVerifiedAt: verified ? new Date() : null,
        lastError: verified ? '' : (reason ?? ''),
      },
      $setOnInsert: { userId, platform },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { handle: document.toSafeJSON(), verified, reason };
};

export const unlinkHandle = async ({ userId, platform }) => {
  const removed = await PlatformHandle.findOneAndDelete({ userId, platform });
  if (!removed) throw ApiError.notFound(`No ${PLATFORM_LABELS[platform]} handle is linked`);

  invalidateActivity(platform, removed.handle);
  return { platform, handle: removed.handle };
};

export default { listHandles, getHandleMap, linkHandle, unlinkHandle };
