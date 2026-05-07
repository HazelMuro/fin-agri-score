/**
 * Session bootstrap via GET /auth/me: JWT mode vs backend “auth disabled” vs network fallback for demo UX.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { clearAccessToken } from './authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setAuthDisabled(false);
      setUser(data?.user || null);
    } catch (err) {
      clearAccessToken();
      setAuthDisabled(false);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setBootstrapped(true));
  }, [refreshUser]);

  const logout = useCallback(() => {
    clearAccessToken();
    sessionStorage.removeItem('finagri_mock_login');
    setUser(null);
    setAuthDisabled(false);
    window.location.assign('/login');
  }, []);

  const value = useMemo(
    () => ({
      user,
      authDisabled,
      bootstrapped,
      refreshUser,
      logout,
      setUser,
    }),
    [user, authDisabled, bootstrapped, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Used by RequireAuth to wait for initial /auth/me without showing the shell */
export function useAuthBootstrap() {
  const { bootstrapped } = useAuth();
  return bootstrapped;
}
