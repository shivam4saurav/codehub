import api from './axios.js';

const serialise = (params = {}) =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      })
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
  );

export const fetchRecommendations = (params) =>
  api.get('/recommendations', { params: serialise(params) }).then((response) => response.data);

export const fetchRecommendationHistory = (limit = 10) =>
  api.get('/recommendations/history', { params: { limit } }).then((response) => response.data.history);

export default { fetchRecommendations, fetchRecommendationHistory };
