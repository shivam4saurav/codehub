import * as Dialog from '@radix-ui/react-dialog';
import { LogIn, LogOut, Moon, Search, Sun, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { NAV_ITEMS } from '../../app/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import cn from '../../utils/cn.js';

/**
 * Cmd+K / Ctrl+K quick search over every page and a few actions.
 *
 * Controlled by the layout so the sidebar's "Search pages" button can open it.
 * Radix Dialog handles focus trapping, Esc and scroll locking; arrow-key
 * navigation is wired manually with aria-activedescendant.
 */
export const CommandPalette = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const commands = useMemo(() => {
    const pages = NAV_ITEMS.filter((item) => !item.requiresAuth || isAuthenticated).map((item) => ({
      id: item.to,
      label: item.label,
      hint: item.hint,
      icon: item.icon,
      run: () => navigate(item.to),
    }));

    const actions = [
      {
        id: 'theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        hint: 'Appearance',
        icon: theme === 'dark' ? Sun : Moon,
        run: toggleTheme,
      },
    ];

    if (isAuthenticated) {
      actions.push({
        id: 'logout',
        label: 'Sign out',
        hint: 'End this session',
        icon: LogOut,
        run: async () => {
          await logout();
          navigate('/');
        },
      });
    } else {
      actions.push(
        { id: 'register', label: 'Create an account', hint: 'Save handles and reminders', icon: UserPlus, run: () => navigate('/register') },
        { id: 'login', label: 'Sign in', hint: 'I already have an account', icon: LogIn, run: () => navigate('/login') },
      );
    }

    return [...pages, ...actions];
  }, [navigate, isAuthenticated, logout, theme, toggleTheme]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;

    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(term) || command.hint.toLowerCase().includes(term),
    );
  }, [commands, query]);

  /** Closing always clears the query, so the palette reopens empty. */
  const setPaletteOpen = useCallback(
    (next) => {
      onOpenChange(next);
      if (!next) {
        setQuery('');
        setActiveIndex(0);
      }
    },
    [onOpenChange],
  );

  // Global shortcut.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(!open);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setPaletteOpen]);

  const onQueryChange = (value) => {
    setQuery(value);
    setActiveIndex(0);
  };

  const runCommand = async (command) => {
    setPaletteOpen(false);
    await command.run();
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(1, filtered.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      runCommand(filtered[activeIndex]);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setPaletteOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-up" />

        <Dialog.Content
          className="glass-strong fixed left-1/2 top-[15%] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden p-0 data-[state=open]:animate-fade-up"
          aria-label="Search pages"
        >
          <Dialog.Title className="sr-only">Search pages</Dialog.Title>
          <Dialog.Description className="sr-only">
            Type to find a page or action. Use the arrow keys to move and Enter to open.
          </Dialog.Description>

          <div className="flex items-center gap-2.5 border-b border-edge px-4 py-3">
            <Search size={16} className="text-content-muted" aria-hidden="true" />
            <input
              /* eslint-disable-next-line jsx-a11y/no-autofocus --
                 The palette is opened deliberately; focusing the search field is
                 the expected behaviour and Radix restores focus on close. */
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Where do you want to go?"
              className="w-full bg-transparent text-sm text-content-primary placeholder:text-content-muted focus:outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-activedescendant={filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined}
            />
            <kbd className="rounded border border-edge px-1.5 py-0.5 font-mono text-[10px] text-content-muted">
              Esc
            </kbd>
          </div>

          <ul id="command-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-content-muted">No matching page</li>
            ) : (
              filtered.map((command, index) => (
                <li key={command.id} role="none">
                  <button
                    id={`command-${command.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
                      index === activeIndex
                        ? 'bg-brand-500/15 text-content-primary'
                        : 'text-content-secondary hover:bg-surface-inset',
                    )}
                  >
                    <command.icon size={16} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{command.label}</span>
                      <span className="block truncate text-xs text-content-muted">{command.hint}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-edge px-4 py-2 text-xs text-content-muted">
            <span>Press ⌘K anywhere</span>
            <span>↑↓ to move · Enter to open</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CommandPalette;
