import api from './axios.js';

export const fetchProfile = (handles = {}) => {
  const params = Object.fromEntries(
    Object.entries(handles).filter(([, value]) => value && value.trim() !== ''),
  );

  return api.get('/profile', { params }).then((response) => response.data);
};

export const refreshProfile = () =>
  api.post('/profile/refresh').then((response) => response.data);

export default { fetchProfile, refreshProfile };
