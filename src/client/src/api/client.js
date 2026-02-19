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
  create: (name, start_time, end_time, m3u_entry_id) =>
    client.post('/events', { name, start_time, end_time, m3u_entry_id }),
  update: (id, name, start_time, end_time, m3u_entry_id) =>
    client.put(`/events/${id}`, { name, start_time, end_time, m3u_entry_id }),
  delete: (id) => client.delete(`/events/${id}`),
};

export const m3uAPI = {
  getPlaylists: () => client.get('/m3u/playlists'),
  getEntries: (playlistId) =>
    client.get('/m3u/entries', { params: { playlistId } }),
  addPlaylist: (url, name) =>
    client.post('/m3u/playlists', { url, name }),
  deletePlaylist: (id) =>
    client.delete(`/m3u/playlists/${id}`),
  refreshPlaylist: (id) =>
    client.post(`/m3u/playlists/${id}/refresh`),
};

export default client;
