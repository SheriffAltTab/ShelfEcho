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
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const skipAuthRedirect =
      path === '/auth' ||
      path === '/auth/callback' ||
      path === '/verify-email' ||
      path === '/forgot-password' ||
      path === '/reset-password';

    if (error.response?.status === 401 && !skipAuthRedirect) {
      localStorage.removeItem('shelfecho_token');
      window.location.href = '/auth';
    }
    const errMsg = error.response?.data?.error;
    if (error.response?.status === 403 && errMsg === 'Account is blocked') {
      localStorage.removeItem('shelfecho_token');
      if (!skipAuthRedirect) window.location.href = '/auth';
    }
    if (
      error.response?.status === 403 &&
      typeof errMsg === 'string' &&
      errMsg.toLowerCase().includes('verify')
    ) {
      localStorage.removeItem('shelfecho_token');
      if (!skipAuthRedirect) window.location.href = '/auth?needsVerification=1';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
