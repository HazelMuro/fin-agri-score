import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'finagri.theme';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  source: 'system',
});

function resolveInitial() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return { theme: stored, source: 'user' };
    }
  } catch (_) { /* SSR or private mode */ }

  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { theme: prefersDark ? 'dark' : 'light', source: 'system' };
}

export function ThemeProvider({ children }) {
  const [state, setState] = useState(() => resolveInitial());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      setState((prev) => {
        if (prev.source !== 'system') return prev;
        return { theme: e.matches ? 'dark' : 'light', source: 'system' };
      });
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (_) { /* ignore */ }
    setState({ theme: next, source: 'user' });
  }, []);

  const toggleTheme = useCallback(() => {
    setState((prev) => {
      const next = prev.theme === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch (_) { /* ignore */ }
      return { theme: next, source: 'user' };
    });
  }, []);

  const value = useMemo(
    () => ({ theme: state.theme, setTheme, toggleTheme, source: state.source }),
    [state.theme, state.source, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
