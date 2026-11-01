import { type DependencyList, useCallback, useEffect, useState } from "react";

interface AsyncState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/**
 * Runs `load` when `deps` change and on reload(). Keeps the previous data while
 * reloading, so the UI does not flash back to a skeleton.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ data: prev.data, loading: true }));
    load().then(
      (data) => !cancelled && setState({ data, loading: false }),
      (error: Error) => !cancelled && setState((prev) => ({ data: prev.data, error, loading: false })),
    );
    return () => {
      cancelled = true;
    };
    // `load` is a new function on every render; `deps` says when to rerun.
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
