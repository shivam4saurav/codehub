import cn from '../../utils/cn.js';
import { GoogleGlyph } from '../share/BrandGlyphs.jsx';

/**
 * Starts the Google OAuth flow.
 *
 * A plain link, not a button with an onClick: the flow is a full-page
 * navigation to the server, which redirects on to Google. That keeps the whole
 * exchange on our own origin (so the session cookie stays first-party) and
 * means it still works if the JavaScript bundle has not finished loading.
 */
export const GoogleSignInButton = ({ next, label = 'Continue with Google', className }) => {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';

  return (
    <a
      href={href}
      // The server sets a short-lived state cookie, so this must not be
      // prefetched or followed by a link scanner.
      rel="nofollow"
      className={cn(
        'focus-ring inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border',
        'border-edge-strong bg-surface-raised px-4 text-sm font-medium text-content-primary',
        'transition-colors hover:bg-surface-inset',
        className,
      )}
    >
      <GoogleGlyph size={17} />
      {label}
    </a>
  );
};

export default GoogleSignInButton;
