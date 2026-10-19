import { Check, Hash, Layers, Loader2 } from 'lucide-react';

import cn from '../../utils/cn.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { ProgressBar } from '../ui/Progress.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * Topic navigation for the browser.
 *
 * Two vocabularies: the canonical CodeHub taxonomy (default, comparable across
 * platforms) and the platform's own raw tags. Counts come from the server so
 * the numbers always match what a click will return.
 */
export const TopicSidebar = ({
  tagMode,
  onTagModeChange,
  topics = [],
  rawTags = [],
  selectedTopics = [],
  selectedRawTags = [],
  onToggleTopic,
  onToggleRawTag,
  onClear,
  progressByTopic,
  isLoading,
  showProgress = false,
}) => {
  const selected = tagMode === 'canonical' ? selectedTopics : selectedRawTags;

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="glass p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-content-primary">Topics</h2>

          {selected.length > 0 ? (
            <Button variant="ghost" size="xs" onClick={onClear}>
              Clear ({selected.length})
            </Button>
          ) : null}
        </div>

        <Tabs value={tagMode} onValueChange={onTagModeChange} className="mb-4">
          <TabsList className="w-full" ariaLabel="Topic vocabulary">
            <TabsTrigger
              value="canonical"
              icon={Layers}
              className="flex-1 justify-center"
              title="Topics grouped the same way on every platform"
            >
              Topics
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              icon={Hash}
              className="flex-1 justify-center"
              title="The platform's own tag names"
            >
              Platform tags
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-2" role="status" aria-label="Loading topics">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-8 rounded-lg" />
            ))}
          </div>
        ) : tagMode === 'canonical' ? (
          <ul className="max-h-[32rem] space-y-1 overflow-y-auto pr-1">
            {topics.map((topic) => {
              const isActive = selectedTopics.includes(topic.key);
              const progress = progressByTopic?.get(topic.key);

              return (
                <li key={topic.key}>
                  <Tooltip content={topic.description} side="right">
                    <button
                      type="button"
                      onClick={() => onToggleTopic(topic.key)}
                      aria-pressed={isActive}
                      className={cn(
                        'focus-ring group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition',
                        isActive
                          ? 'bg-brand-500/15 text-content-primary'
                          : 'text-content-secondary hover:bg-surface-raised/70 hover:text-content-primary',
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: topic.accent }}
                        aria-hidden="true"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm">{topic.name}</span>
                          <span className="shrink-0 font-mono text-[11px] text-content-muted">
                            {topic.count}
                          </span>
                        </span>

                        {showProgress && progress ? (
                          <ProgressBar
                            value={progress.solved}
                            max={Math.max(1, progress.count)}
                            showValue={false}
                            size="sm"
                            color={progress.percent > 50 ? 'success' : 'brand'}
                            className="mt-1.5"
                          />
                        ) : null}
                      </span>

                      {isActive ? (
                        <Check size={14} className="shrink-0 text-brand-300" aria-hidden="true" />
                      ) : null}
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex max-h-[32rem] flex-wrap gap-1.5 overflow-y-auto pr-1">
            {rawTags.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-content-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                No platform tags synced yet
              </p>
            ) : (
              rawTags.map((row) => {
                const isActive = selectedRawTags.includes(row.tag);

                return (
                  <button
                    key={row.tag}
                    type="button"
                    onClick={() => onToggleRawTag(row.tag)}
                    aria-pressed={isActive}
                    className={cn('chip focus-ring', isActive && 'chip-active')}
                  >
                    {row.tag}
                    <span className="font-mono text-[10px] text-content-muted">{row.count}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {showProgress ? (
        <p className="mt-3 px-1 text-xs text-content-muted">
          Progress bars compare your solved problems against every problem
          CodeHub knows in that topic.
        </p>
      ) : (
        <div className="mt-3 px-1">
          <Badge variant="neutral" size="xs">
            Link a handle to see progress
          </Badge>
        </div>
      )}
    </aside>
  );
};

export default TopicSidebar;
