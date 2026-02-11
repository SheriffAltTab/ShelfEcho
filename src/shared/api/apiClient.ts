import axios from 'axios';

const baseURL =
  typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : '/api';

const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('shelfecho_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('shelfecho_token');
      window.location.href = '/auth';
    }
    if (error.response?.status === 403 && error.response?.data?.error === 'Account is blocked') {
      localStorage.removeItem('shelfecho_token');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
