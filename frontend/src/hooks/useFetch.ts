import { useEffect, useRef, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Minimal data-fetching hook shared by the codex pages.
// Re-runs whenever `deps` changes (pass route params etc.). The latest `fetcher` is read
// through a ref, and `deps` is folded into one key, so the effect's dependency list is
// static and complete.
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  const [lastKey, setLastKey] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const key = JSON.stringify(deps);

  // Reset to loading during render when the deps change, rather than in the effect.
  if (key !== lastKey) {
    setLastKey(key);
    setState({ data: null, loading: true, error: null });
  }

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setState({ data: null, loading: false, error: message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
