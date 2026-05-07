/**
 * Persists JWT access token in localStorage under a fixed key (when JWT auth is enabled).
 */

const KEY = 'finagri_access_token';

export function getAccessToken() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessToken(token) {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function clearAccessToken() {
  setAccessToken('');
}
