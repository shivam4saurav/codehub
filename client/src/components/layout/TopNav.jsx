import * as Dialog from '@radix-ui/react-dialog';
import { Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../app/navigation.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import cn from '../../utils/cn.js';
import Button from '../ui/Button.jsx';
import { BrandLink } from './Sidebar.jsx';

/**
 * Guest navigation. People who are not signed in get a marketing-style top
 * bar instead of the app sidebar; links come from the same NAV_ITEMS list, so
 * names stay consistent. Pages that need an account are left out here; they
 * are still reachable from search and show a lock there.
 */
const GUEST_LINKS = NAV_ITEMS.filter((item) => item.to !== '/' && !item.requiresAuth);

const linkClass = ({ isActive }) =>
  cn(
    'focus-ring rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'text-brand-300'
      : 'text-content-secondary hover:bg-surface-inset hover:text-content-primary',
  );

const ThemeButton = () => {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-edge bg-surface-raised text-content-secondary transition-colors hover:text-content-primary"
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
};

export const TopNav = ({ onOpenSearch }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <header className="sticky top-0 z-30 border-b border-edge bg-surface-raised/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLink />

          <nav aria-label="Main navigation" className="ml-auto hidden items-center gap-1 lg:flex">
            {GUEST_LINKS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} title={item.hint} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search pages"
              title="Search pages (⌘K)"
              className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-edge bg-surface-raised text-content-secondary transition-colors hover:text-content-primary"
            >
              <Search size={16} aria-hidden="true" />
            </button>
            <ThemeButton />
            <Button as={Link} to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign in
            </Button>
            <Button as={Link} to="/register" size="sm" className="hidden sm:inline-flex">
              Sign up
            </Button>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-content-secondary hover:bg-surface-inset hover:text-content-primary lg:hidden"
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
          </div>
        </div>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
        <Dialog.Content className="fixed inset-x-3 top-3 z-50 rounded-2xl border border-edge bg-surface-raised p-4 shadow-overlay focus:outline-none data-[state=open]:animate-fade-up lg:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">CodeHub pages</Dialog.Description>
          <div className="mb-3 flex items-center justify-between">
            <BrandLink onClick={close} />
            <Dialog.Close
              className="focus-ring rounded-lg p-1.5 text-content-muted hover:bg-surface-inset hover:text-content-primary"
              aria-label="Close menu"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {GUEST_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={close}
                className={({ isActive }) =>
                  cn(
                    'focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-brand-500/10 text-brand-300'
                      : 'text-content-secondary hover:bg-surface-inset hover:text-content-primary',
                  )
                }
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-edge pt-4">
            <Button as={Link} to="/login" variant="secondary" size="sm" onClick={close}>
              Sign in
            </Button>
            <Button as={Link} to="/register" size="sm" onClick={close}>
              Sign up
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default TopNav;
