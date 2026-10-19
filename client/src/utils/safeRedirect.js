/**
 * Sanitise a post-login redirect target.
 *
 * React Router v6 (pinned per project requirements) has a known open-redirect
 * vector where values like "//evil.com" or "/\\evil.com" are treated as
 * absolute URLs by the browser. Since `?next=` is attacker-controllable, we
 * only ever navigate to a clean, same-origin path.
 *
 * @param {string|null} rawNext value of the ?next= query parameter
 * @param {string} fallback where to go when the value is missing or unsafe
 * @returns {string} a safe in-app path
 */
export const safeRedirectPath = (rawNext, fallback = '/profile') => {
  if (!rawNext) return fallback;

  let candidate = rawNext;

  // The value arrives URL-encoded; decoding can itself be malformed.
  try {
    candidate = decodeURIComponent(rawNext);
  } catch {
    return fallback;
  }

  candidate = candidate.trim();

  // Must be a root-relative path.
  if (!candidate.startsWith('/')) return fallback;

  // Reject protocol-relative and backslash-smuggled absolute URLs:
  // "//evil.com", "/\evil.com", "/\/evil.com".
  if (/^\/[/\\]/.test(candidate)) return fallback;

  // Reject anything that still parses as an absolute URL with a scheme.
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return fallback;

  // Never bounce back into the auth pages.
  if (/^\/(login|register)(\/|\?|$)/.test(candidate)) return fallback;

  return candidate;
};

export default safeRedirectPath;
