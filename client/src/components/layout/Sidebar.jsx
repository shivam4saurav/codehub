import { ExternalLink, Lock, LogOut, Moon, Search, Sun } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { NAV_SECTIONS } from '../../app/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import cn from '../../utils/cn.js';
import Button from '../ui/Button.jsx';

/** Wordmark: a small "ch" monogram plus the name. Reused by the sidebar, mobile bar and auth pages. */
export const BrandLink = ({ onClick, className }) => (
  <Link
    to="/"
    onClick={onClick}
    className={cn('focus-ring flex items-center gap-2 rounded-md', className)}
  >
    <span
      className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-mono text-[13px] font-semibold leading-none text-white shadow-card"
      aria-hidden="true"
    >
      ch
    </span>
    <span className="text-[1.1rem] font-bold tracking-tight text-content-primary">
      Code<span className="text-brand-300">Hub</span>
    </span>
  </Link>
);

const NavItem = ({ item, isAuthenticated, onNavigate }) => {
  const locked = item.requiresAuth && !isAuthenticated;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={locked ? `${item.label}: sign in to use this` : item.hint}
      className={({ isActive }) =>
        cn(
          'focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-brand-500/10 font-semibold text-brand-300'
            : 'text-content-secondary hover:bg-surface-inset/70 hover:text-content-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          
          <item.icon
            size={16}
            aria-hidden="true"
            className={cn(
              'shrink-0',
              isActive ? 'text-brand-300' : 'text-content-muted group-hover:text-content-secondary',
            )}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {locked ? (
            <Lock size={12} className="text-content-muted" aria-label="Sign in required" />
          ) : null}
        </>
      )}
    </NavLink>
  );
};

/**
 * The full sidebar body. Rendered as a fixed column on desktop and inside a
 * slide-in drawer on mobile, so both show exactly the same navigation.
 */
export const SidebarContent = ({ onNavigate, onOpenSearch }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    navigate('/');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <BrandLink onClick={onNavigate} />
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="focus-ring flex w-full items-center gap-2 rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-content-muted transition-colors hover:border-edge-strong hover:text-content-secondary"
        >
          <Search size={14} aria-hidden="true" />
          <span className="flex-1 text-left">Go to page…</span>
          <kbd className="font-mono text-[11px] text-content-muted">⌘K</kbd>
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            {section.label ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-content-muted">{section.label}</p>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  isAuthenticated={isAuthenticated}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-edge p-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500/15 text-sm font-semibold uppercase text-brand-300">
              {(user.displayName || user.username).slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-content-primary">
                {user.displayName || user.username}
              </p>
              {user.publicProfile?.enabled ? (
                <Link
                  to={`/u/${user.username}`}
                  onClick={onNavigate}
                  className="focus-ring inline-flex items-center gap-1 rounded text-xs text-content-muted hover:text-content-primary"
                >
                  Public profile
                  <ExternalLink size={11} aria-hidden="true" />
                </Link>
              ) : (
                <p className="truncate text-xs text-content-muted">@{user.username}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="focus-ring rounded-md p-1.5 text-content-muted transition-colors hover:bg-surface-inset hover:text-content-primary"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="px-1 pb-1">
            <p className="text-xs leading-relaxed text-content-muted">
              An account saves your usernames, bookmarks and reminders.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button as={Link} to="/register" size="sm" className="flex-1" onClick={onNavigate}>
                Sign up
              </Button>
              <Button as={Link} to="/login" variant="secondary" size="sm" className="flex-1" onClick={onNavigate}>
                Sign in
              </Button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="focus-ring mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-content-muted transition-colors hover:bg-surface-inset hover:text-content-primary"
        >
          {theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>
    </div>
  );
};

export default SidebarContent;
