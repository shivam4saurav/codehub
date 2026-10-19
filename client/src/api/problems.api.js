import api from './axios.js';

/** Drop empty values so the URL stays clean and cache keys stay stable. */
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );

/** Arrays go over the wire as comma-separated values. */
const serialise = (params = {}) =>
  Object.fromEntries(
    Object.entries(clean(params)).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );

export const fetchProblems = (params) =>
  api.get('/problems', { params: serialise(params) }).then((response) => response.data);

export const fetchFacets = (params) =>
  api.get('/problems/facets', { params: serialise(params) }).then((response) => response.data);

export const fetchRawTags = (params) =>
  api.get('/problems/raw-tags', { params: serialise(params) }).then((response) => response.data);

export const fetchTopicProgress = (params) =>
  api.get('/problems/progress', { params: serialise(params) }).then((response) => response.data);

export const fetchBookmarks = (params) =>
  api.get('/problems/bookmarks', { params: serialise(params) }).then((response) => response.data);

export const saveBookmark = ({ problemId, ...patch }) =>
  api.patch(`/problems/${problemId}/bookmark`, patch).then((response) => response.data.bookmark);

export const deleteBookmark = (problemId) =>
  api.delete(`/problems/${problemId}/bookmark`).then((response) => response.data);

export const triggerProblemSync = () =>
  api.post('/problems/sync').then((response) => response.data);

export const fetchTaxonomy = () => api.get('/taxonomy').then((response) => response.data);

export default { fetchProblems, fetchFacets, fetchRawTags, fetchTopicProgress };
