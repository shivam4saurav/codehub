/**
 * CodeHub canonical topic taxonomy
 * ---------------------------------------------------------------------------
 * LeetCode, Codeforces and CodeChef all name their topics differently
 * ("Dynamic Programming" vs "dp", "Depth-First Search" vs "dfs and similar").
 * Every feature in CodeHub - problem browser, dashboards, radar chart,
 * heatmaps and the recommender - reads topics through THIS file so that the
 * whole product speaks one vocabulary.
 *
 * Rules
 *  - 26 canonical topics + an explicit "Other" bucket.
 *  - Mapping is many-to-one: many raw platform tags collapse into one topic.
 *  - A raw tag that is not mapped resolves to "Other" and is recorded in the
 *    UnmappedTag collection (see utils/normalizeTags.js) so the mapping can be
 *    extended instead of silently losing data.
 *  - `nonAlgorithmic` tags (LeetCode "Database", "Shell", ...) map to Other on
 *    purpose and are NOT reported as gaps.
 *
 * To extend: add the raw tag to the right topic's `aliases` list. Alias
 * matching is case/punctuation insensitive (see slugifyTag).
 */

export const OTHER_TOPIC_KEY = 'other';

export const CANONICAL_TOPICS = Object.freeze([
  {
    key: 'arrays',
    name: 'Arrays & Prefix Sums',
    short: 'Arrays',
    accent: '#38bdf8',
    description: 'Indexing, prefix sums, matrix traversal and in-place array tricks.',
    aliases: {
      codeforces: ['prefix sums'],
      leetcode: ['Array', 'Prefix Sum', 'Matrix'],
      codechef: ['arrays', 'array', 'prefix-sum', 'prefix-sums', 'matrix'],
    },
  },
  {
    key: 'strings',
    name: 'Strings',
    short: 'Strings',
    accent: '#a78bfa',
    description: 'String manipulation, pattern matching and suffix structures.',
    aliases: {
      codeforces: ['strings', 'string suffix structures', 'expression parsing'],
      leetcode: ['String', 'String Matching', 'Suffix Array', 'Parsing'],
      codechef: ['strings', 'string', 'string-algorithms', 'pattern-matching'],
    },
  },
  {
    key: 'hashing',
    name: 'Hashing',
    short: 'Hashing',
    accent: '#22d3ee',
    description: 'Hash maps, frequency counting and rolling-hash techniques.',
    aliases: {
      codeforces: ['hashing'],
      leetcode: ['Hash Table', 'Hash Function', 'Counting', 'Rolling Hash'],
      codechef: ['hashing', 'hash', 'hashmap'],
    },
  },
  {
    key: 'two-pointers',
    name: 'Two Pointers',
    short: 'Two Ptr',
    accent: '#34d399',
    description: 'Opposite-end or same-direction pointer scans over sorted data.',
    aliases: {
      codeforces: ['two pointers'],
      leetcode: ['Two Pointers'],
      codechef: ['two-pointers', 'two-pointer'],
    },
  },
  {
    key: 'sliding-window',
    name: 'Sliding Window',
    short: 'Window',
    accent: '#4ade80',
    description: 'Fixed and variable length window scans, monotonic queues.',
    aliases: {
      codeforces: ['sliding window'],
      leetcode: ['Sliding Window', 'Monotonic Queue'],
      codechef: ['sliding-window'],
    },
  },
  {
    key: 'binary-search',
    name: 'Binary Search',
    short: 'BinSearch',
    accent: '#facc15',
    description: 'Searching sorted spaces, binary search on the answer, ternary search.',
    aliases: {
      codeforces: ['binary search', 'ternary search'],
      leetcode: ['Binary Search'],
      codechef: ['binary-search', 'ternary-search'],
    },
  },
  {
    key: 'sorting',
    name: 'Sorting',
    short: 'Sorting',
    accent: '#fb923c',
    description: 'Comparison sorts, counting/bucket/radix sorts and order statistics.',
    aliases: {
      codeforces: ['sortings'],
      leetcode: [
        'Sorting',
        'Merge Sort',
        'Counting Sort',
        'Bucket Sort',
        'Radix Sort',
        'Quickselect',
      ],
      codechef: ['sorting', 'sortings'],
    },
  },
  {
    key: 'greedy',
    name: 'Greedy',
    short: 'Greedy',
    accent: '#f472b6',
    description: 'Locally optimal choices with an exchange-argument proof.',
    aliases: {
      codeforces: ['greedy'],
      leetcode: ['Greedy'],
      codechef: ['greedy'],
    },
  },
  {
    key: 'dynamic-programming',
    name: 'Dynamic Programming',
    short: 'DP',
    accent: '#818cf8',
    description: 'Overlapping subproblems, memoisation and bottom-up state design.',
    aliases: {
      codeforces: ['dp', 'dynamic programming'],
      leetcode: ['Dynamic Programming', 'Memoization'],
      codechef: ['dynamic-programming', 'dp'],
    },
  },
  {
    key: 'graphs',
    name: 'Graphs',
    short: 'Graphs',
    accent: '#2dd4bf',
    description: 'Traversals, shortest paths, flows, matchings and connectivity.',
    aliases: {
      codeforces: [
        'graphs',
        'dfs and similar',
        'shortest paths',
        'flows',
        'graph matchings',
        '2-sat',
      ],
      leetcode: [
        'Graph',
        'Depth-First Search',
        'Breadth-First Search',
        'Topological Sort',
        'Shortest Path',
        'Minimum Spanning Tree',
        'Strongly Connected Component',
        'Eulerian Circuit',
        'Biconnected Component',
      ],
      codechef: ['graphs', 'graph', 'graph-theory', 'bfs', 'dfs', 'shortest-path', 'flows'],
    },
  },
  {
    key: 'trees',
    name: 'Trees',
    short: 'Trees',
    accent: '#86efac',
    description: 'Rooted trees, binary trees, BSTs, tries and tree DP.',
    aliases: {
      codeforces: ['trees'],
      leetcode: ['Tree', 'Binary Tree', 'Binary Search Tree', 'Trie'],
      codechef: ['trees', 'tree', 'trie', 'lca'],
    },
  },
  {
    key: 'linked-lists',
    name: 'Linked Lists',
    short: 'Lists',
    accent: '#fca5a5',
    description: 'Pointer surgery on singly and doubly linked lists.',
    aliases: {
      codeforces: ['linked list'],
      leetcode: ['Linked List', 'Doubly-Linked List'],
      codechef: ['linked-list', 'linked-lists'],
    },
  },
  {
    key: 'stacks-queues',
    name: 'Stacks & Queues',
    short: 'Stack/Queue',
    accent: '#fdba74',
    description: 'LIFO/FIFO structures, monotonic stacks and deques.',
    aliases: {
      codeforces: ['stacks', 'queue'],
      leetcode: ['Stack', 'Queue', 'Monotonic Stack', 'Deque'],
      codechef: ['stack', 'stacks', 'queue', 'queues', 'deque'],
    },
  },
  {
    key: 'heaps',
    name: 'Heaps & Priority Queues',
    short: 'Heaps',
    accent: '#f9a8d4',
    description: 'Binary heaps, k-th element problems and scheduling by priority.',
    aliases: {
      codeforces: ['heap', 'priority queue'],
      leetcode: ['Heap (Priority Queue)', 'Heap'],
      codechef: ['heap', 'heaps', 'priority-queue'],
    },
  },
  {
    key: 'backtracking',
    name: 'Backtracking',
    short: 'Backtrack',
    accent: '#c084fc',
    description: 'Exhaustive search with pruning: permutations, subsets, N-queens.',
    aliases: {
      codeforces: ['backtracking'],
      leetcode: ['Backtracking'],
      codechef: ['backtracking'],
    },
  },
  {
    key: 'recursion-divide-conquer',
    name: 'Recursion & Divide and Conquer',
    short: 'Recursion',
    accent: '#93c5fd',
    description: 'Recursive decomposition, D&C and meet-in-the-middle.',
    aliases: {
      codeforces: ['divide and conquer', 'meet-in-the-middle'],
      leetcode: ['Recursion', 'Divide and Conquer'],
      codechef: ['recursion', 'divide-and-conquer'],
    },
  },
  {
    key: 'bit-manipulation',
    name: 'Bit Manipulation',
    short: 'Bits',
    accent: '#67e8f9',
    description: 'Bitwise tricks, masks and subset enumeration over bitmasks.',
    aliases: {
      codeforces: ['bitmasks'],
      leetcode: ['Bit Manipulation', 'Bitmask'],
      codechef: ['bit-manipulation', 'bitmask', 'bitmasks', 'bits'],
    },
  },
  {
    key: 'math',
    name: 'Math',
    short: 'Math',
    accent: '#fcd34d',
    description: 'Algebra, matrices, probability and general mathematical reasoning.',
    aliases: {
      codeforces: ['math', 'matrices', 'probabilities', 'fft'],
      leetcode: [
        'Math',
        'Probability and Statistics',
        'Randomized',
        'Reservoir Sampling',
        'Rejection Sampling',
      ],
      codechef: ['math', 'maths', 'mathematics', 'algebra', 'probability', 'matrix-exponentiation'],
    },
  },
  {
    key: 'number-theory',
    name: 'Number Theory',
    short: 'NumTheory',
    accent: '#fde68a',
    description: 'Primes, gcd/lcm, modular arithmetic and CRT.',
    aliases: {
      codeforces: ['number theory', 'chinese remainder theorem'],
      leetcode: ['Number Theory'],
      codechef: ['number-theory', 'modular-arithmetic', 'primes', 'sieve', 'gcd'],
    },
  },
  {
    key: 'combinatorics',
    name: 'Combinatorics',
    short: 'Combi',
    accent: '#d8b4fe',
    description: 'Counting arrangements, binomials and inclusion-exclusion.',
    aliases: {
      codeforces: ['combinatorics'],
      leetcode: ['Combinatorics'],
      codechef: ['combinatorics', 'counting'],
    },
  },
  {
    key: 'geometry',
    name: 'Geometry',
    short: 'Geometry',
    accent: '#5eead4',
    description: 'Points, vectors, convex hulls and sweep-line geometry.',
    aliases: {
      codeforces: ['geometry'],
      leetcode: ['Geometry', 'Line Sweep'],
      codechef: ['geometry', 'computational-geometry'],
    },
  },
  {
    key: 'data-structures',
    name: 'Data Structures',
    short: 'DS',
    accent: '#7dd3fc',
    description: 'Designing containers: ordered sets, streams, iterators, custom APIs.',
    aliases: {
      codeforces: ['data structures'],
      leetcode: ['Design', 'Ordered Set', 'Data Stream', 'Iterator'],
      codechef: ['data-structures', 'data-structure'],
    },
  },
  {
    key: 'dsu',
    name: 'Disjoint Set Union',
    short: 'DSU',
    accent: '#f0abfc',
    description: 'Union-find with path compression for connectivity queries.',
    aliases: {
      codeforces: ['dsu'],
      leetcode: ['Union Find'],
      codechef: ['dsu', 'disjoint-set-union', 'union-find'],
    },
  },
  {
    key: 'range-queries',
    name: 'Range Queries',
    short: 'SegTree',
    accent: '#60a5fa',
    description: 'Segment trees, Fenwick/BIT and sqrt decomposition for range work.',
    aliases: {
      codeforces: ['segment tree', 'sqrt decomposition'],
      leetcode: ['Segment Tree', 'Binary Indexed Tree'],
      codechef: ['segment-tree', 'segment-trees', 'fenwick-tree', 'bit', 'sqrt-decomposition'],
    },
  },
  {
    key: 'implementation',
    name: 'Implementation & Simulation',
    short: 'Impl',
    accent: '#cbd5e1',
    description: 'Careful coding, brute force and step-by-step simulation.',
    aliases: {
      codeforces: ['implementation', 'brute force', 'schedules'],
      leetcode: ['Simulation', 'Enumeration'],
      codechef: ['implementation', 'simulation', 'brute-force', 'ad-hoc', 'adhoc', 'basic'],
    },
  },
  {
    key: 'constructive-games',
    name: 'Constructive & Games',
    short: 'Construct',
    accent: '#fdd3e8',
    description: 'Building a valid answer, invariants, interactive tasks and game theory.',
    aliases: {
      codeforces: ['constructive algorithms', 'games', 'interactive'],
      leetcode: ['Game Theory', 'Brainteaser', 'Interactive'],
      codechef: ['constructive', 'game-theory', 'games', 'interactive', 'observation'],
    },
  },
]);

/** The catch-all bucket. Always last in UI ordering. */
export const OTHER_TOPIC = Object.freeze({
  key: OTHER_TOPIC_KEY,
  name: 'Other',
  short: 'Other',
  accent: '#94a3b8',
  description: 'Tags that do not map to a canonical topic yet.',
  aliases: { codeforces: [], leetcode: [], codechef: [] },
});

/**
 * Tags that are deliberately dropped into "Other": they are real platform tags
 * but not algorithmic topics, so they must not be reported as mapping gaps.
 */
export const NON_ALGORITHMIC_TAGS = Object.freeze({
  codeforces: ['*special'],
  leetcode: ['Database', 'Shell', 'Concurrency', 'Sql'],
  codechef: ['school', 'easy', 'medium', 'hard', 'beginner'],
});

export const ALL_TOPICS = Object.freeze([...CANONICAL_TOPICS, OTHER_TOPIC]);

export const TOPIC_KEYS = Object.freeze(CANONICAL_TOPICS.map((topic) => topic.key));

export const ALL_TOPIC_KEYS = Object.freeze(ALL_TOPICS.map((topic) => topic.key));

/**
 * Normalise a raw tag or topic name into a comparable slug.
 * "Heap (Priority Queue)" -> "heap priority queue"
 * "dfs and similar"       -> "dfs and similar"
 * "dynamic-programming"   -> "dynamic programming"
 */
export const slugifyTag = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-z0-9+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const topicByKey = new Map(ALL_TOPICS.map((topic) => [topic.key, topic]));

/** platform -> Map<slug, topicKey> */
const aliasIndexByPlatform = new Map();
/** Map<slug, topicKey> across every platform, used as a soft fallback. */
const globalAliasIndex = new Map();
/** platform -> Set<slug> of intentionally-unmapped tags */
const nonAlgorithmicByPlatform = new Map();

const registerAlias = (platform, rawAlias, topicKey) => {
  const slug = slugifyTag(rawAlias);
  if (!slug) return;

  if (!aliasIndexByPlatform.has(platform)) aliasIndexByPlatform.set(platform, new Map());
  const platformIndex = aliasIndexByPlatform.get(platform);

  if (!platformIndex.has(slug)) platformIndex.set(slug, topicKey);
  if (!globalAliasIndex.has(slug)) globalAliasIndex.set(slug, topicKey);
};

for (const topic of CANONICAL_TOPICS) {
  // The canonical name and short name are always valid aliases.
  registerAlias('*', topic.name, topic.key);
  registerAlias('*', topic.key, topic.key);
  registerAlias('*', topic.short, topic.key);

  for (const [platform, aliases] of Object.entries(topic.aliases ?? {})) {
    for (const alias of aliases) registerAlias(platform, alias, topic.key);
  }
}

for (const [platform, tags] of Object.entries(NON_ALGORITHMIC_TAGS)) {
  nonAlgorithmicByPlatform.set(platform, new Set(tags.map(slugifyTag)));
}

export const getTopic = (key) => topicByKey.get(key) ?? OTHER_TOPIC;

export const getTopicName = (key) => getTopic(key).name;

export const isCanonicalTopicKey = (key) => topicByKey.has(key) && key !== OTHER_TOPIC_KEY;

/** True when a tag is knowingly non-algorithmic for that platform. */
export const isNonAlgorithmicTag = (platform, rawTag) => {
  const slug = slugifyTag(rawTag);
  const platformSet = nonAlgorithmicByPlatform.get(platform);
  if (platformSet?.has(slug)) return true;
  return [...nonAlgorithmicByPlatform.values()].some((set) => set.has(slug));
};

/**
 * Resolve one raw tag to a canonical topic key.
 * Lookup order: platform aliases -> canonical names -> any-platform aliases.
 * Returns `{ key, matched }` where matched=false means it fell back to Other.
 */
export const resolveTag = (platform, rawTag) => {
  const slug = slugifyTag(rawTag);
  if (!slug) return { key: OTHER_TOPIC_KEY, matched: false };

  const platformIndex = aliasIndexByPlatform.get(platform);
  const platformHit = platformIndex?.get(slug);
  if (platformHit) return { key: platformHit, matched: true };

  const canonicalHit = aliasIndexByPlatform.get('*')?.get(slug);
  if (canonicalHit) return { key: canonicalHit, matched: true };

  const globalHit = globalAliasIndex.get(slug);
  if (globalHit) return { key: globalHit, matched: true };

  return { key: OTHER_TOPIC_KEY, matched: false };
};

/** Total number of aliases registered - handy for sanity tests. */
export const aliasCount = () =>
  [...aliasIndexByPlatform.values()].reduce((sum, index) => sum + index.size, 0);

export default {
  CANONICAL_TOPICS,
  ALL_TOPICS,
  OTHER_TOPIC,
  OTHER_TOPIC_KEY,
  TOPIC_KEYS,
  ALL_TOPIC_KEYS,
  slugifyTag,
  resolveTag,
  getTopic,
  getTopicName,
  isCanonicalTopicKey,
  isNonAlgorithmicTag,
};
