import axios from 'axios';

const API_BASE_URL = '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (username, password) =>
    client.post('/auth/login', { username, password }),
};

export const eventsAPI = {
  getAll: () => client.get('/events'),
  create: (name, start_time, end_time) =>
    client.post('/events', { name, start_time, end_time }),
  update: (id, name, start_time, end_time) =>
    client.put(`/events/${id}`, { name, start_time, end_time }),
  delete: (id) => client.delete(`/events/${id}`),
};

export default client;
