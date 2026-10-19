import api from './axios.js';

export const registerRequest = (payload) =>
  api.post('/auth/register', payload).then((response) => response.data.user);

export const loginRequest = (payload) =>
  api.post('/auth/login', payload).then((response) => response.data.user);

export const logoutRequest = () => api.post('/auth/logout').then((response) => response.data);

export const fetchCurrentUser = () =>
  api.get('/auth/me').then((response) => response.data.user);

export const updateProfileRequest = (payload) =>
  api.patch('/users/me', payload).then((response) => response.data.user);

export const changePasswordRequest = (payload) =>
  api.patch('/auth/password', payload).then((response) => response.data);

export default {
  registerRequest,
  loginRequest,
  logoutRequest,
  fetchCurrentUser,
  updateProfileRequest,
  changePasswordRequest,
};
