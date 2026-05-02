/**
 * Async data hook: wraps a fetcher function with loading/error state and optional initial run.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useApi(fn, { immediate = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fnRef.current(...args);
      setData(res);
      return res;
    } catch (err) {
      setError(err.friendlyMessage || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, run, setData };
}
