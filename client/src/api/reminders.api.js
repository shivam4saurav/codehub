import api from './axios.js';

export const fetchReminders = (params = {}) =>
  api.get('/reminders', { params }).then((response) => response.data);

export const createReminder = ({ contestId, offsetKey }) =>
  api.post('/reminders', { contestId, offsetKey }).then((response) => response.data);

export const cancelReminder = (reminderId) =>
  api.delete(`/reminders/${reminderId}`).then((response) => response.data);

export default { fetchReminders, createReminder, cancelReminder };
