import api from './axios.js';

export const fetchHandles = () => api.get('/handles').then((response) => response.data.handles);

export const linkHandle = ({ platform, handle }) =>
  api.put(`/handles/${platform}`, { handle }).then((response) => response.data);

export const unlinkHandle = (platform) =>
  api.delete(`/handles/${platform}`).then((response) => response.data);

export default { fetchHandles, linkHandle, unlinkHandle };
