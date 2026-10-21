/**
 * The OAuth leg is a browser redirect, so failures come back as a short code
 * in ?error= rather than a JSON body. Nothing from Google is echoed into the
 * URL; these are the only values the server ever sends.
 */
export const OAUTH_ERROR_MESSAGES = {
  google_disabled: 'Google sign-in is not set up on this server yet. Use your email and password.',
  google_denied: 'Google sign-in was cancelled.',
  google_expired: 'That sign-in attempt timed out. Please try again.',
  google_state: 'That sign-in attempt could not be verified. Please try again.',
  google_no_code: 'Google did not complete the sign-in. Please try again.',
  google_exchange: 'Could not reach Google to finish signing in. Please try again.',
  google_unverified:
    'Your Google account email is not verified, so it cannot be used to sign in.',
  google_failed: 'Something went wrong while signing you in with Google. Please try again.',
};

export const oauthErrorMessage = (code) =>
  (code && OAUTH_ERROR_MESSAGES[code]) ||
  (code ? 'Could not sign you in. Please try again.' : '');

export default oauthErrorMessage;
