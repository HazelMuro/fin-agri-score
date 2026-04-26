import axios from 'axios';
import { clearAccessToken, getAccessToken } from '../auth/authStorage';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';
export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = String(err.config?.url || '');
    if (
      status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/me')
    ) {
      clearAccessToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    const message =
      err.response?.data?.error?.message ||
      err.response?.data?.detail ||
      err.message ||
      'Request failed';
    err.friendlyMessage = message;
    return Promise.reject(err);
  }
);

export default api;
