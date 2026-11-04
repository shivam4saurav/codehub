import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence } from 'framer-motion';
import { Menu, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import CommandPalette from '../common/CommandPalette.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import ServerWakeNotice from '../common/ServerWakeNotice.jsx';
import Footer from './Footer.jsx';
import { BrandLink, SidebarContent } from './Sidebar.jsx';
import TopNav from './TopNav.jsx';

/** Sign-in pages are focused tasks, so they skip the sidebar. */
const AUTH_ROUTES = ['/login', '/register'];

/**
 * App shell.
 *
 * Desktop: a fixed sidebar that names and describes every feature, so the
 * answer to "where do I go for X?" is always visible.
 * Mobile: a top bar with a menu button that opens the same sidebar as a drawer.
 * Guests: a website-style top navbar instead of the sidebar. It is also shown
 * while the session check runs, because most first visits are from guests.
 */
export const AppLayout = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { isAuthenticated } = useAuth();
  const isAuthRoute = AUTH_ROUTES.includes(location.pathname);

  const page = (
    <ErrorBoundary key={location.pathname}>
      <AnimatePresence mode="wait" initial={false}>
        <Outlet key={location.pathname} />
      </AnimatePresence>
    </ErrorBoundary>
  );

  if (isAuthRoute) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <BrandLink />
        </header>
        <main id="main-content" className="flex-1">
          {page}
        </main>
        <ServerWakeNotice />
      </div>
    );
  }

  const openSearch = () => {
    setMenuOpen(false);
    setSearchOpen(true);
  };
  const skipLink = (
    <a
      href="#main-content"
      className="sr-only-focusable focus-ring fixed left-4 top-3 z-[60] rounded-md bg-surface-overlay px-3 py-1.5 text-sm text-content-primary"
    >
      Skip to content
    </a>
  );
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        {skipLink}
        <TopNav onOpenSearch={openSearch} />
        <main id="main-content" className="flex-1">
          {page}
        </main>
        <Footer />
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        <ServerWakeNotice />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {skipLink}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-edge bg-surface-raised lg:block">
        <SidebarContent onOpenSearch={openSearch} />
      </aside>

      {/* Mobile top bar + drawer */}
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-edge bg-surface-raised/90 px-4 backdrop-blur lg:hidden">
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="focus-ring rounded-lg p-2 text-content-secondary hover:bg-surface-inset hover:text-content-primary"
              aria-label="Open menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </Dialog.Trigger>

          <BrandLink />

          <button
            type="button"
            onClick={openSearch}
            className="focus-ring rounded-lg p-2 text-content-secondary hover:bg-surface-inset hover:text-content-primary"
            aria-label="Search pages"
          >
            <Search size={19} aria-hidden="true" />
          </button>
        </header>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-xs border-r border-edge bg-surface-raised shadow-overlay focus:outline-none data-[state=open]:animate-slide-in-left lg:hidden">
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">All CodeHub pages</Dialog.Description>
            <Dialog.Close
              className="focus-ring absolute right-3 top-5 rounded-lg p-1.5 text-content-muted hover:bg-surface-inset hover:text-content-primary"
              aria-label="Close menu"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
            <SidebarContent onNavigate={() => setMenuOpen(false)} onOpenSearch={openSearch} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-h-screen flex-col lg:pl-60">
        <main id="main-content" className="flex-1">
          {page}
        </main>
        <Footer />
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <ServerWakeNotice />
    </div>
  );
};

export default AppLayout;
