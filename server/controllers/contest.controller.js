import { getContestById, listContests, syncContests } from '../services/contest.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildContestIcs, googleCalendarUrl, icsFilename } from '../utils/ics.js';

/** GET /api/contests */
export const list = asyncHandler(async (req, res) => {
  const { platforms, status, from, to, minDurationHours, maxDurationHours, limit } =
    req.validated.query;

  const result = await listContests({
    platforms,
    status,
    from,
    to,
    minDurationHours,
    maxDurationHours,
    limit,
  });

  // Every contest carries its own calendar links so the client needs no logic.
  const items = result.items.map((contest) => ({
    ...contest,
    googleCalendarUrl: googleCalendarUrl(contest),
    icsUrl: `/api/contests/${contest.id}/ics`,
  }));

  res.json({ ...result, items });
});

/** GET /api/contests/:contestId/ics - downloadable calendar file. */
export const downloadIcs = asyncHandler(async (req, res) => {
  const { contestId } = req.validated.params;
  const { reminderMinutes } = req.validated.query;

  const contest = await getContestById(contestId);
  if (!contest) throw ApiError.notFound('Contest not found');

  const ics = buildContestIcs({
    name: contest.name,
    url: contest.url,
    platform: contest.platform,
    startTime: contest.startTime,
    endTime: contest.endTime,
    reminderMinutesBefore: reminderMinutes ?? 60,
    uid: `${contest.platform}-${contest.externalId}@codehub`,
  });

  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="${icsFilename(contest.name)}"`,
    'Cache-Control': 'no-store',
  });

  res.send(ics);
});

/** POST /api/contests/sync - manual refresh (signed in, rate limited). */
export const sync = asyncHandler(async (_req, res) => {
  const results = await syncContests();
  const anyOk = results.some((result) => result.ok);

  res.status(anyOk ? 200 : 502).json({ results });
});

export default { list, downloadIcs, sync };
