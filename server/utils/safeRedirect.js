/**
 * Sanitise a post-login redirect target on the server.
 *
 * The OAuth flow carries a `next` path through Google and back, so the value
 * is attacker-controllable. Only clean, root-relative, same-origin paths are
 * ever honoured - otherwise CodeHub could be used to bounce visitors to a
 * phishing page that looks like it came from us.
 *
 * Mirrors client/src/utils/safeRedirect.js; a test keeps the two in agreement.
 *
 * @param {string|null|undefined} rawNext candidate path
 * @param {string} fallback used when the value is missing or unsafe
 * @returns {string} a safe in-app path
 */
export const safeRedirectPath = (rawNext, fallback = '/') => {
  if (!rawNext || typeof rawNext !== 'string') return fallback;

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

  // Control characters have no place in a Location header: a CR/LF would let
  // the value smuggle extra response headers. Checked by code point rather
  // than a regex so the intent survives lint's no-control-regex rule.
  for (let index = 0; index < candidate.length; index += 1) {
    const code = candidate.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return fallback;
  }

  // Never bounce back into the auth pages.
  if (/^\/(login|register)(\/|\?|$)/.test(candidate)) return fallback;

  return candidate;
};

export default safeRedirectPath;
