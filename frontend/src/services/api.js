/**
 * Shared Axios instance for all frontend API calls: base URL → /api, JWT header, friendly errors.
 */

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
      const path = window.location.pathname;
      if (path !== '/login' && !path.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    let message =
      err.response?.data?.error?.message ||
      err.response?.data?.detail ||
      err.message ||
      'Request failed';
    if (!err.response && (err.code === 'ERR_NETWORK' || message === 'Network Error')) {
      const hint = baseURL
        ? `Expected API at ${baseURL}.`
        : 'Using Vite proxy — backend should be on http://localhost:4000.';
      message = `Cannot reach the server. ${hint} Start the API (backend: npm run dev), match DATABASE_URL to your Postgres port, then verify http://localhost:4000/api/health`;
    }
    err.friendlyMessage = message;
    return Promise.reject(err);
  }
);

export default api;
