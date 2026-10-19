import { describe, expect, it } from '@jest/globals';

import {
  CANONICAL_TOPICS,
  OTHER_TOPIC_KEY,
  isNonAlgorithmicTag,
  resolveTag,
  slugifyTag,
} from '../../config/taxonomy.js';
import { normalizeTags } from '../../utils/normalizeTags.js';

describe('taxonomy: slugifyTag', () => {
  it('collapses punctuation, case and separators', () => {
    expect(slugifyTag('Dynamic Programming')).toBe('dynamic programming');
    expect(slugifyTag('dynamic-programming')).toBe('dynamic programming');
    expect(slugifyTag('Heap (Priority Queue)')).toBe('heap priority queue');
    expect(slugifyTag('  DFS and Similar  ')).toBe('dfs and similar');
    expect(slugifyTag('*special')).toBe('special');
  });
});

describe('taxonomy: resolveTag maps platform vocabularies onto one topic', () => {
  it('maps the three names for dynamic programming to the same key', () => {
    expect(resolveTag('codeforces', 'dp').key).toBe('dynamic-programming');
    expect(resolveTag('leetcode', 'Dynamic Programming').key).toBe('dynamic-programming');
    expect(resolveTag('codechef', 'dynamic-programming').key).toBe('dynamic-programming');
  });

  it('maps graph traversal aliases to Graphs', () => {
    expect(resolveTag('codeforces', 'dfs and similar').key).toBe('graphs');
    expect(resolveTag('leetcode', 'Depth-First Search').key).toBe('graphs');
    expect(resolveTag('leetcode', 'Breadth-First Search').key).toBe('graphs');
    expect(resolveTag('codeforces', 'shortest paths').key).toBe('graphs');
  });

  it('maps binary search aliases across platforms', () => {
    expect(resolveTag('codeforces', 'binary search').key).toBe('binary-search');
    expect(resolveTag('leetcode', 'Binary Search').key).toBe('binary-search');
    expect(resolveTag('codechef', 'binary-search').key).toBe('binary-search');
  });

  it('is case and punctuation insensitive', () => {
    expect(resolveTag('leetcode', 'HASH TABLE').key).toBe('hashing');
    expect(resolveTag('leetcode', 'Heap (Priority Queue)').key).toBe('heaps');
  });

  it('falls back to Other for genuinely unknown tags', () => {
    const result = resolveTag('codeforces', 'quantum teleportation');
    expect(result.key).toBe(OTHER_TOPIC_KEY);
    expect(result.matched).toBe(false);
  });

  it('accepts a canonical key or display name as its own alias', () => {
    expect(resolveTag('codeforces', 'Dynamic Programming').key).toBe('dynamic-programming');
    expect(resolveTag('leetcode', 'dsu').key).toBe('dsu');
  });
});

describe('taxonomy: normalizeTags', () => {
  it('normalises a Codeforces problem into canonical topics', () => {
    const result = normalizeTags('codeforces', ['dp', 'greedy', 'binary search']);

    expect(result.canonicalTopics.sort()).toEqual(
      ['binary-search', 'dynamic-programming', 'greedy'].sort(),
    );
    expect(result.unmapped).toEqual([]);
  });

  it('collapses many raw tags onto one canonical topic without duplicates', () => {
    const result = normalizeTags('leetcode', [
      'Depth-First Search',
      'Breadth-First Search',
      'Graph',
    ]);

    expect(result.canonicalTopics).toEqual(['graphs']);
  });

  it('keeps the original tags alongside the canonical ones', () => {
    const result = normalizeTags('codeforces', ['dp', 'dp', 'math']);

    expect(result.rawTags).toEqual(['dp', 'math']);
    expect(result.canonicalTopics.sort()).toEqual(['dynamic-programming', 'math']);
  });

  it('reports unknown tags so the mapping can be extended', () => {
    const result = normalizeTags('codeforces', ['dp', 'brand new tag']);

    expect(result.canonicalTopics).toContain('dynamic-programming');
    expect(result.unmapped).toEqual(['brand new tag']);
  });

  it('does not report deliberately non-algorithmic tags as gaps', () => {
    const result = normalizeTags('leetcode', ['Database']);

    expect(result.canonicalTopics).toEqual([OTHER_TOPIC_KEY]);
    expect(result.unmapped).toEqual([]);
    expect(isNonAlgorithmicTag('leetcode', 'Database')).toBe(true);
  });

  it('drops Other once a real topic is present', () => {
    const result = normalizeTags('leetcode', ['Database', 'Dynamic Programming']);

    expect(result.canonicalTopics).toEqual(['dynamic-programming']);
  });

  it('returns Other for empty or junk input instead of an empty list', () => {
    expect(normalizeTags('codeforces', []).canonicalTopics).toEqual([OTHER_TOPIC_KEY]);
    expect(normalizeTags('codeforces', [null, '', '   ']).canonicalTopics).toEqual([
      OTHER_TOPIC_KEY,
    ]);
  });

  it('accepts a single tag that is not wrapped in an array', () => {
    expect(normalizeTags('codeforces', 'greedy').canonicalTopics).toEqual(['greedy']);
  });
});

describe('taxonomy: catalogue integrity', () => {
  it('has unique keys and no accidental Other entry', () => {
    const keys = CANONICAL_TOPICS.map((topic) => topic.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(OTHER_TOPIC_KEY);
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });

  it('never maps one raw tag to two canonical topics for a platform', () => {
    const seen = new Map();

    for (const topic of CANONICAL_TOPICS) {
      for (const [platform, aliases] of Object.entries(topic.aliases)) {
        for (const alias of aliases) {
          const key = `${platform}:${slugifyTag(alias)}`;
          expect(seen.has(key)).toBe(false);
          seen.set(key, topic.key);
        }
      }
    }
  });

  it('gives every topic a name, short label, accent and description', () => {
    for (const topic of CANONICAL_TOPICS) {
      expect(topic.name).toBeTruthy();
      expect(topic.short).toBeTruthy();
      expect(topic.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(topic.description.length).toBeGreaterThan(10);
    }
  });
});
