import api from './axios.js';

const serialise = (params = {}) =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      })
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(',') : value instanceof Date ? value.toISOString() : value,
      ]),
  );

export const fetchContests = (params) =>
  api.get('/contests', { params: serialise(params) }).then((response) => response.data);

export const triggerContestSync = () =>
  api.post('/contests/sync').then((response) => response.data);

/** Absolute URL so the anchor works regardless of the router's base path. */
export const contestIcsUrl = (contestId, reminderMinutes = 60) => {
  const base = import.meta.env.DEV
    ? '/api'
    : `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

  return `${base}/contests/${contestId}/ics?reminderMinutes=${reminderMinutes}`;
};

export default { fetchContests, triggerContestSync, contestIcsUrl };
