import { describe, expect, it } from '@jest/globals';

import { PLATFORMS } from '../../config/constants.js';
import {
  buildRadarData,
  combineTopicStats,
  computeStreaks,
  estimateLevel,
  mergeHeatmaps,
} from '../../services/profileAggregation.service.js';

const dayString = (offsetDays) =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

describe('mergeHeatmaps', () => {
  it('sums activity from every platform per UTC day', () => {
    const merged = mergeHeatmaps([
      { '2026-05-01': 3, '2026-05-02': 1 },
      { '2026-05-01': 2, '2026-05-03': 5 },
    ]);

    expect(merged).toEqual({ '2026-05-01': 5, '2026-05-02': 1, '2026-05-03': 5 });
  });

  it('ignores missing or null heatmaps', () => {
    expect(mergeHeatmaps([null, undefined, { '2026-05-01': 1 }])).toEqual({ '2026-05-01': 1 });
    expect(mergeHeatmaps([])).toEqual({});
  });
});

describe('computeStreaks', () => {
  it('counts a live streak that includes today', () => {
    const heatmap = {
      [dayString(0)]: 2,
      [dayString(1)]: 1,
      [dayString(2)]: 4,
    };

    const streaks = computeStreaks(heatmap);

    expect(streaks.current).toBe(3);
    expect(streaks.longest).toBe(3);
    expect(streaks.activeDays).toBe(3);
    expect(streaks.totalSubmissions).toBe(7);
  });

  it('reports the longest streak even after it ended', () => {
    const heatmap = {
      '2026-01-01': 1,
      '2026-01-02': 1,
      '2026-01-03': 1,
      '2026-01-04': 1,
      '2026-03-01': 1,
    };

    const streaks = computeStreaks(heatmap);

    expect(streaks.longest).toBe(4);
    // Nothing recent, so the current streak is broken.
    expect(streaks.current).toBe(0);
  });

  it('handles an empty heatmap without dividing by zero', () => {
    expect(computeStreaks({})).toEqual({
      current: 0,
      longest: 0,
      activeDays: 0,
      totalSubmissions: 0,
    });
  });
});

describe('combineTopicStats', () => {
  const platformData = {
    [PLATFORMS.CODEFORCES]: {
      topics: [
        { topicKey: 'dynamic-programming', solved: 10, averageRating: 1500, lastSolvedAt: 1750000000 },
        { topicKey: 'graphs', solved: 6, averageRating: 1800, lastSolvedAt: 1760000000 },
      ],
    },
    [PLATFORMS.LEETCODE]: {
      topics: [
        { topicKey: 'dynamic-programming', solved: 25 },
        { topicKey: 'hashing', solved: 12 },
      ],
    },
    [PLATFORMS.CODECHEF]: null,
  };

  it('adds the same canonical topic across platforms', () => {
    const combined = combineTopicStats(platformData);
    const dp = combined.get('dynamic-programming');

    expect(dp.solved).toBe(35);
    expect(dp.byPlatform).toEqual({ codeforces: 10, leetcode: 25, codechef: 0 });
  });

  it('keeps a rating average weighted by solve count, ignoring unrated platforms', () => {
    const combined = combineTopicStats(platformData);

    // Only the 10 Codeforces solves carry a rating.
    expect(combined.get('dynamic-programming').averageRating).toBe(1500);
    expect(combined.get('hashing').averageRating).toBeNull();
  });

  it('keeps the most recent solve timestamp', () => {
    const combined = combineTopicStats(platformData);
    expect(combined.get('graphs').lastSolvedAt).toBe(1760000000);
  });

  it('tolerates a platform that failed entirely', () => {
    const combined = combineTopicStats({ [PLATFORMS.CODEFORCES]: null, [PLATFORMS.LEETCODE]: null });
    expect(combined.size).toBe(0);
  });
});

describe('buildRadarData', () => {
  it('returns one row per solved topic with a value per platform', () => {
    const combined = combineTopicStats({
      [PLATFORMS.CODEFORCES]: {
        topics: [
          { topicKey: 'graphs', solved: 6 },
          { topicKey: 'greedy', solved: 4 },
        ],
      },
      [PLATFORMS.LEETCODE]: { topics: [{ topicKey: 'graphs', solved: 10 }] },
    });

    const radar = buildRadarData(combined);

    expect(radar[0]).toMatchObject({ topicKey: 'graphs', codeforces: 6, leetcode: 10, total: 16 });
    // Untouched topics are not plotted.
    expect(radar.every((row) => row.total > 0)).toBe(true);
  });

  it('caps the number of axes so the chart stays readable', () => {
    const topics = Array.from({ length: 20 }, (_, index) => ({
      topicKey: ['graphs', 'greedy', 'math', 'strings', 'trees', 'hashing'][index % 6],
      solved: index + 1,
    }));

    const radar = buildRadarData(combineTopicStats({ [PLATFORMS.CODEFORCES]: { topics } }), {
      limit: 4,
    });

    expect(radar).toHaveLength(4);
  });
});

describe('estimateLevel', () => {
  it('prefers a real Codeforces rating', () => {
    const level = estimateLevel({ [PLATFORMS.CODEFORCES]: { rating: 1642 } });
    expect(level).toEqual({ rating: 1642, basis: 'codeforces-rating' });
  });

  it('falls back to a scaled LeetCode contest rating', () => {
    const level = estimateLevel({
      [PLATFORMS.CODEFORCES]: { rating: null },
      [PLATFORMS.LEETCODE]: { contestRating: 2000 },
    });

    expect(level.basis).toBe('leetcode-contest-rating');
    expect(level.rating).toBe(1700);
  });

  it('infers a level from solve volume when no rating exists', () => {
    const level = estimateLevel({
      [PLATFORMS.LEETCODE]: { solved: { total: 60 } },
    });

    expect(level.basis).toBe('solved-volume');
    expect(level.rating).toBeGreaterThan(1000);
  });

  it('uses the documented default for a brand-new user', () => {
    expect(estimateLevel({})).toEqual({ rating: 1200, basis: 'default' });
  });
});
