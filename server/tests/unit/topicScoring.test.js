import { describe, expect, it } from '@jest/globals';

import { RECOMMENDER } from '../../config/constants.js';
import {
  difficultyComponent,
  explainTopic,
  rankTopics,
  recencyComponent,
  scoreTopic,
  volumeComponent,
} from '../../services/topicScoring.js';

const DAY = 86_400_000;
const NOW = new Date('2026-06-01T00:00:00Z').getTime();

describe('scoring components', () => {
  it('saturates volume at the configured ceiling', () => {
    expect(volumeComponent(0)).toBe(0);
    expect(volumeComponent(20)).toBeCloseTo(0.5, 5);
    expect(volumeComponent(RECOMMENDER.VOLUME_SATURATION)).toBe(1);
    expect(volumeComponent(500)).toBe(1);
  });

  it('scales difficulty between the rating floor and ceiling', () => {
    expect(difficultyComponent(800).value).toBe(0);
    expect(difficultyComponent(1600).value).toBeCloseTo(0.5, 2);
    expect(difficultyComponent(2400).value).toBe(1);
    expect(difficultyComponent(3200).value).toBe(1);
  });

  it('treats an unknown average rating as neutral, not as zero', () => {
    const unknown = difficultyComponent(null);

    expect(unknown.value).toBe(0.5);
    expect(unknown.known).toBe(false);
    expect(difficultyComponent(1600).known).toBe(true);
  });

  it('halves recency credit every half-life', () => {
    expect(recencyComponent(NOW, NOW)).toBe(1);
    expect(recencyComponent(NOW - 45 * DAY, NOW)).toBeCloseTo(0.5, 2);
    expect(recencyComponent(NOW - 90 * DAY, NOW)).toBeCloseTo(0.25, 2);
    expect(recencyComponent(null, NOW)).toBe(0);
  });

  it('accepts both second and millisecond timestamps', () => {
    const seconds = Math.floor((NOW - 45 * DAY) / 1000);

    expect(recencyComponent(seconds, NOW)).toBeCloseTo(
      recencyComponent(NOW - 45 * DAY, NOW),
      5,
    );
  });
});

describe('scoreTopic', () => {
  it('applies the documented 0.5 / 0.3 / 0.2 weighting', () => {
    const result = scoreTopic(
      { solved: 40, averageRating: 2400, lastSolvedAt: NOW },
      { now: NOW },
    );

    // Perfect on every component.
    expect(result.score).toBe(1);
    expect(result.percent).toBe(100);
  });

  it('scores an untouched topic at zero', () => {
    const result = scoreTopic({ solved: 0, averageRating: null, lastSolvedAt: null }, { now: NOW });

    // Only the neutral difficulty term contributes: 0.3 * 0.5
    expect(result.score).toBeCloseTo(0.15, 5);
    expect(result.components.volume).toBe(0);
    expect(result.components.recency).toBe(0);
  });

  it('ranks a recent, harder, higher-volume topic above a stale easy one', () => {
    const strong = scoreTopic(
      { solved: 30, averageRating: 1900, lastSolvedAt: NOW - 2 * DAY },
      { now: NOW },
    );
    const weak = scoreTopic(
      { solved: 4, averageRating: 1000, lastSolvedAt: NOW - 200 * DAY },
      { now: NOW },
    );

    expect(strong.score).toBeGreaterThan(weak.score);
  });
});

describe('rankTopics', () => {
  const stats = new Map([
    ['dynamic-programming', { solved: 8, averageRating: 1100, lastSolvedAt: NOW - 120 * DAY }],
    ['graphs', { solved: 35, averageRating: 1900, lastSolvedAt: NOW - 3 * DAY }],
    ['greedy', { solved: 22, averageRating: 1500, lastSolvedAt: NOW - 10 * DAY }],
    ['math', { solved: 5, averageRating: 1200, lastSolvedAt: NOW - 60 * DAY }],
    ['binary-search', { solved: 2, averageRating: 1400, lastSolvedAt: NOW - 5 * DAY }],
    ['geometry', { solved: 0 }],
  ]);

  it('covers every canonical topic, even untouched ones', () => {
    const { ranked } = rankTopics(stats, { now: NOW });

    expect(ranked.length).toBeGreaterThanOrEqual(20);
    expect(ranked.some((topic) => topic.topicKey === 'geometry')).toBe(true);
  });

  it('sorts strongest first', () => {
    const { ranked } = rankTopics(stats, { now: NOW });

    expect(ranked[0].topicKey).toBe('graphs');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('only treats topics at or above the activity threshold as active', () => {
    const { active } = rankTopics(stats, { now: NOW });
    const keys = active.map((topic) => topic.topicKey);

    expect(keys).toContain('dynamic-programming');
    expect(keys).toContain('math');
    // 2 solved is below the 3-solve threshold.
    expect(keys).not.toContain('binary-search');
    expect(keys).not.toContain('geometry');
  });

  it('returns the weakest ACTIVE topics, excluding barely-touched ones', () => {
    const { weak } = rankTopics(stats, { now: NOW });

    expect(weak).toHaveLength(RECOMMENDER.WEAK_TOPIC_COUNT);

    const keys = weak.map((topic) => topic.topicKey);
    expect(keys).toContain('math');
    expect(keys).toContain('dynamic-programming');
    expect(keys).not.toContain('binary-search');
    expect(keys).not.toContain('geometry');

    // Weakest first.
    expect(weak[0].score).toBeLessThanOrEqual(weak[1].score);
  });

  it('separates never-attempted topics from weak ones', () => {
    const { neverAttempted, lowActivity, weak } = rankTopics(stats, { now: NOW });

    expect(neverAttempted.map((topic) => topic.topicKey)).toContain('geometry');
    expect(lowActivity.map((topic) => topic.topicKey)).toContain('binary-search');
    expect(weak.map((topic) => topic.topicKey)).not.toContain('geometry');
    // "Other" is never suggested as a topic to explore.
    expect(neverAttempted.map((topic) => topic.topicKey)).not.toContain('other');
  });

  it('accepts a plain object as well as a Map', () => {
    const fromObject = rankTopics({ graphs: { solved: 35, averageRating: 1900 } }, { now: NOW });
    expect(fromObject.ranked[0].topicKey).toBe('graphs');
  });

  it('respects a custom activity threshold', () => {
    const { active } = rankTopics(stats, { now: NOW, minSolved: 10 });
    const keys = active.map((topic) => topic.topicKey);

    expect(keys).toEqual(expect.arrayContaining(['graphs', 'greedy']));
    expect(keys).not.toContain('dynamic-programming');
  });
});

describe('explainTopic', () => {
  it('produces a human sentence with the numbers that drove the score', () => {
    const reason = explainTopic('dynamic-programming', {
      solved: 8,
      averageRating: 1100,
      lastSolvedAt: Math.floor((Date.now() - 30 * DAY) / 1000),
    });

    expect(reason).toContain('Dynamic Programming');
    expect(reason).toContain('8 solved');
    expect(reason).toContain('avg rating 1100');
    expect(reason).toMatch(/last solved \d+d ago/);
  });
});
