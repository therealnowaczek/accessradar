import { useCallback, useEffect, useRef, useState } from 'react';
import { call, errorText, type Status } from './api';

export type Loadable<T> = {
  data?: T;
  error?: string;
  loading: boolean;
  /** Re-fetch; resolves true on success, false on failure. Safe to fire-and-forget. */
  reload: () => Promise<boolean>;
};

/** Calls a resolver and re-runs when the key or payload changes. Keeps stale data while reloading. */
export function useCall<T>(key: string | null, payload: Record<string, unknown> = {}): Loadable<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: key !== null,
  });
  const [nonce, setNonce] = useState(0);
  const waiters = useRef<Array<(ok: boolean) => void>>([]);
  const body = JSON.stringify(payload);

  const reload = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (key === null) {
        resolve(false);
        return;
      }
      waiters.current.push(resolve);
      setNonce((n) => n + 1);
    });
  }, [key]);

  useEffect(() => {
    if (key === null) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    call<T>(key, JSON.parse(body))
      .then((data) => {
        if (!alive) return;
        setState({ data, loading: false });
        const pending = waiters.current.splice(0);
        pending.forEach((r) => r(true));
      })
      .catch((e) => {
        if (!alive) return;
        setState((s) => ({ data: s.data, error: errorText(e), loading: false }));
        const pending = waiters.current.splice(0);
        pending.forEach((r) => r(false));
      });
    return () => {
      alive = false;
    };
  }, [key, body, nonce]);

  return { ...state, reload };
}

export const useStatus = () => useCall<Status>('getStatus');

/**
 * Busy flag for an async trigger (ConfigRadar pattern). Use with Button `isLoading` /
 * `isDisabled` so the control itself shows waiting state.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R> | R) {
  const [busy, setBusy] = useState(false);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  const run = useCallback(async (...args: A) => {
    setBusy(true);
    try {
      return await latest.current(...args);
    } finally {
      setBusy(false);
    }
  }, []);
  return [run, busy] as const;
}

/** Polls a callback every `ms` while `active` is true. */
export function usePoll(active: boolean, fn: () => void, ms = 4000) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}
