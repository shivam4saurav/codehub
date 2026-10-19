import axios from 'axios';

/**
 * Requests always go to "/api" on the site's own origin:
 *  - in development, Vite's proxy forwards them to the local API;
 *  - on Vercel, client/vercel.json forwards them to Render.
 * Same origin means the httpOnly login cookies are first-party, which Safari
 * and Brave require. VITE_API_URL is only for a deliberately cross-site setup
 * (and then needs SameSite=None cookies, which Safari blocks anyway).
 */
const baseURL = import.meta.env.DEV
  ? '/api'
  : `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

/**
 * Render's free plan sleeps after 15 idle minutes and takes about a minute to
 * wake. The timeout leaves room for that instead of failing at 20 seconds.
 */
export const REQUEST_TIMEOUT_MS = 90_000;

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/* ------------------------------------------------- "server is waking up" */

/** A request still pending after this long is worth explaining to the user. */
const SLOW_AFTER_MS = 5_000;
/** Render sleeps after 15 minutes without traffic; a little under that is "probably asleep". */
const LIKELY_ASLEEP_AFTER_MS = 14 * 60_000;

let lastResponseAt = null;
let wakingRequests = 0;
const wakeListeners = new Set();

const notifyWake = () => wakeListeners.forEach((listener) => listener());

/** useSyncExternalStore-compatible store for the wake-up notice. */
export const subscribeServerWaking = (listener) => {
  wakeListeners.add(listener);
  return () => wakeListeners.delete(listener);
};
export const getServerWaking = () => wakingRequests > 0;

/**
 * Only a slow request after a long quiet spell counts as "waking up"; a slow
 * request while the server is clearly awake is just a slow request.
 */
const startSlowTimer = (config) => {
  config.__slowTimer = setTimeout(() => {
    const quietFor = lastResponseAt === null ? Infinity : Date.now() - lastResponseAt;
    if (quietFor < LIKELY_ASLEEP_AFTER_MS) return;
    config.__countedAsWaking = true;
    wakingRequests += 1;
    notifyWake();
  }, SLOW_AFTER_MS);
};

const finishRequest = (config, gotResponse) => {
  if (gotResponse) lastResponseAt = Date.now();
  if (!config) return;
  clearTimeout(config.__slowTimer);
  if (config.__countedAsWaking) {
    config.__countedAsWaking = false;
    wakingRequests = Math.max(0, wakingRequests - 1);
    notifyWake();
  }
};

api.interceptors.request.use((config) => {
  startSlowTimer(config);
  return config;
});

/** Broadcast so AuthContext can drop the session without a circular import. */
const AUTH_EXPIRED_EVENT = 'codehub:auth-expired';

export const onAuthExpired = (handler) => {
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
};

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

/** Single-flight refresh: many parallel 401s trigger only one refresh call. */
let refreshPromise = null;

const refreshSession = () => {
  refreshPromise ??= api
    .post('/auth/refresh')
    .then((response) => response.data)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => {
    finishRequest(response.config, true);
    return response;
  },
  async (error) => {
    const { response, config } = error;
    finishRequest(config, Boolean(response));

    const isAuthRoute = NO_REFRESH_PATHS.some((path) => config?.url?.includes(path));
    const canRetry = response?.status === 401 && config && !config.__retried && !isAuthRoute;

    if (canRetry) {
      config.__retried = true;

      try {
        await refreshSession();
        return api(config);
      } catch {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
    }

    return Promise.reject(normaliseError(error));
  },
);

/** Turn any axios failure into a predictable shape for the UI. */
export const normaliseError = (error) => {
  const payload = error.response?.data?.error;

  const normalised = new Error(
    payload?.message ??
      (error.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : error.message || 'Something went wrong'),
  );

  normalised.status = error.response?.status ?? null;
  normalised.code = payload?.code ?? error.code ?? null;
  normalised.details = payload?.details ?? null;
  normalised.isNetworkError = !error.response;

  return normalised;
};

export default api;
