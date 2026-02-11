import axios from 'axios';

const raw = typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : '';
const baseURL = raw ? (raw.endsWith('/api') ? raw : `${raw}/api`) : '/api';

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
    const isAuthPage = typeof window !== 'undefined' && window.location.pathname === '/auth';
    if (error.response?.status === 401 && !isAuthPage) {
      localStorage.removeItem('shelfecho_token');
      window.location.href = '/auth';
    }
    if (error.response?.status === 403 && error.response?.data?.error === 'Account is blocked') {
      localStorage.removeItem('shelfecho_token');
      if (!isAuthPage) window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
