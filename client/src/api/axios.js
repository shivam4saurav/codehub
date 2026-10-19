import axios from 'axios';

/**
 * In development every request goes through Vite's proxy so the API stays
 * same-origin and httpOnly cookies are sent normally. In production the client
 * talks to VITE_API_URL directly (which then needs SameSite=None cookies).
 */
const baseURL = import.meta.env.DEV
  ? '/api'
  : `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
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
  (response) => response,
  async (error) => {
    const { response, config } = error;

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
