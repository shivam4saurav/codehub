/**
 * Minimal, self-authored glyphs for the share targets.
 *
 * lucide-react v1 dropped brand icons, and copying official logo artwork would
 * drag trademark baggage into the repo. These are plain geometric stand-ins:
 * recognisable in context, and paired with a text label plus aria-label so the
 * meaning never depends on the shape alone.
 */

export const LinkedInGlyph = ({ size = 15, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <line x1="8" y1="11" x2="8" y2="17" />
    <circle cx="8" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    <path d="M12 17v-3.2a2.3 2.3 0 0 1 4.6 0V17" />
  </svg>
);

export const XGlyph = ({ size = 15, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    {...props}
  >
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </svg>
);

/**
 * The official Google "G". Unlike the glyphs above, this one is deliberately
 * the real mark: Google's Sign-In branding guidelines require their own logo
 * on a "Sign in with Google" button, so a stand-in would be the wrong call.
 */
export const GoogleGlyph = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export default { LinkedInGlyph, XGlyph, GoogleGlyph };
