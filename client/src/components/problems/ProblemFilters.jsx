import * as Slider from '@radix-ui/react-slider';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import cn from '../../utils/cn.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Input, { Select } from '../ui/Input.jsx';
import { Checkbox } from '../ui/Toggle.jsx';

const SORT_OPTIONS = [
  { value: 'rating-asc', label: 'Rating: low to high' },
  { value: 'rating-desc', label: 'Rating: high to low' },
  { value: 'popularity', label: 'Most solved' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A-Z)' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All problems' },
  { value: 'unsolved', label: 'Unsolved only' },
  { value: 'solved', label: 'Solved only' },
  { value: 'attempted', label: 'Attempted, not solved' },
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const DIVISIONS = [1, 2, 3, 4];

/**
 * Filter panel. Rating is a real two-thumb range slider for Codeforces; the
 * LeetCode view swaps it for difficulty chips, because LeetCode problems have
 * no numeric rating and pretending otherwise would be dishonest.
 */
export const ProblemFilters = ({
  filters,
  onChange,
  onReset,
  ratingBounds = { min: 800, max: 3500 },
  platform,
  canFilterByStatus,
  totalResults,
}) => {
  const isCodeforces = platform === 'codeforces';

  /**
   * Local state exists only while the thumb is being dragged; the rest of the
   * time the slider reads straight from the filters. That keeps dragging smooth
   * without mirroring external state into an effect.
   */
  const [dragRange, setDragRange] = useState(null);
  const range = dragRange ?? [
    filters.ratingMin ?? ratingBounds.min,
    filters.ratingMax ?? ratingBounds.max,
  ];

  const toggleInArray = (key, value) => {
    const current = filters[key] ?? [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    onChange({ [key]: next });
  };

  return (
    <section className="glass p-4" aria-label="Problem filters">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <Input
            icon={Search}
            placeholder={isCodeforces ? 'Search name or id (e.g. 1547B)' : 'Search problem name'}
            value={filters.search ?? ''}
            onChange={(event) => onChange({ search: event.target.value })}
            aria-label="Search problems"
          />
        </div>

        <Select
          value={filters.sort}
          onChange={(event) => onChange({ sort: event.target.value })}
          aria-label="Sort problems"
          containerClassName="sm:w-52"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value })}
          aria-label="Filter by solve status"
          containerClassName="sm:w-48"
          disabled={!canFilterByStatus}
          title={canFilterByStatus ? undefined : 'Link a Codeforces handle to filter by status'}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
          Reset
        </Button>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {isCodeforces ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              {/* Not a <label>: the control is a Radix slider, which is labelled
                  through aria-label on its root rather than a for/id pair. */}
              <span
                id="rating-range-label"
                className="flex items-center gap-1.5 text-sm font-medium text-content-secondary"
              >
                <SlidersHorizontal size={13} aria-hidden="true" />
                Rating range
              </span>
              <span className="font-mono text-xs text-content-primary">
                {range[0]} – {range[1]}
              </span>
            </div>

            <Slider.Root
              value={range}
              min={ratingBounds.min}
              max={ratingBounds.max}
              step={100}
              minStepsBetweenThumbs={1}
              onValueChange={setDragRange}
              onValueCommit={([min, max]) => {
                setDragRange(null);
                onChange({ ratingMin: min, ratingMax: max });
              }}
              className="relative flex h-5 w-full touch-none select-none items-center"
              aria-labelledby="rating-range-label"
            >
              <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-surface-inset">
                <Slider.Range className="absolute h-full rounded-full bg-brand-500" />
              </Slider.Track>

              {['Minimum rating', 'Maximum rating'].map((label) => (
                <Slider.Thumb
                  key={label}
                  aria-label={label}
                  className="focus-ring block h-4 w-4 rounded-full border-2 border-brand-400 bg-surface-base shadow transition hover:scale-110"
                />
              ))}
            </Slider.Root>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Checkbox
                checked={filters.includeUnrated ?? true}
                onCheckedChange={(checked) => onChange({ includeUnrated: checked })}
                label="Include unrated"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-content-muted">Division</span>
                {DIVISIONS.map((division) => (
                  <button
                    key={division}
                    type="button"
                    onClick={() => toggleInArray('divisions', division)}
                    aria-pressed={(filters.divisions ?? []).includes(division)}
                    className={cn(
                      'chip focus-ring px-2',
                      (filters.divisions ?? []).includes(division) && 'chip-active',
                    )}
                  >
                    {division}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-content-secondary">Difficulty</p>

            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => toggleInArray('difficulties', difficulty)}
                  aria-pressed={(filters.difficulties ?? []).includes(difficulty)}
                  className={cn(
                    'chip focus-ring',
                    (filters.difficulties ?? []).includes(difficulty) && 'chip-active',
                  )}
                >
                  {difficulty}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <Checkbox
                checked={filters.excludePremium ?? false}
                onCheckedChange={(checked) => onChange({ excludePremium: checked })}
                label="Hide premium-only problems"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="min-solved"
            className="mb-2 block text-sm font-medium text-content-secondary"
          >
            Minimum solve count
          </label>

          <Input
            id="min-solved"
            type="number"
            min={0}
            step={1000}
            placeholder="e.g. 5000"
            value={filters.minSolvedCount ?? ''}
            onChange={(event) =>
              onChange({
                minSolvedCount: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
            hint="Higher values surface well-known, heavily solved problems."
          />
        </div>
      </div>

      {typeof totalResults === 'number' ? (
        <div className="mt-4 flex items-center gap-2 border-t border-edge/70 pt-3">
          <Badge variant="brand" size="sm">
            {totalResults.toLocaleString()} match{totalResults === 1 ? '' : 'es'}
          </Badge>
          {!canFilterByStatus ? (
            <span className="text-xs text-content-muted">
              Link a Codeforces handle to mark solved problems.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default ProblemFilters;
