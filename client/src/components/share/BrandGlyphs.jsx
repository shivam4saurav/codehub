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

export default { LinkedInGlyph, XGlyph };
