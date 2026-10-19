import api from './axios.js';

export const fetchPublicProfile = (username) =>
  api.get(`/public/${encodeURIComponent(username)}`).then((response) => response.data);

/** Absolute URL of the server-rendered card, used for previews and OG images. */
export const cardImageUrl = (username, theme) => {
  const base = import.meta.env.DEV
    ? '/api'
    : `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

  const query = theme ? `?theme=${encodeURIComponent(theme)}` : '';
  return `${base}/card/${encodeURIComponent(username)}.png${query}`;
};

export default { fetchPublicProfile, cardImageUrl };
