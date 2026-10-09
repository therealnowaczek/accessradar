import { useCallback, useEffect, useRef, useState } from 'react';
import { call, errorText, type Status } from './api';

export type Loadable<T> = { data?: T; error?: string; loading: boolean; reload: () => void };

/** Calls a resolver and re-runs when the key or payload changes. Keeps stale data while reloading. */
export function useCall<T>(key: string | null, payload: Record<string, unknown> = {}): Loadable<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: key !== null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const body = JSON.stringify(payload);
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    call<T>(key, JSON.parse(body))
      .then((data) => alive && setState({ data, loading: false }))
      .catch(
        (e) => alive && setState((s) => ({ data: s.data, error: errorText(e), loading: false })),
      );
    return () => {
      alive = false;
    };
  }, [key, body, nonce]);
  return { ...state, reload };
}

export const useStatus = () => useCall<Status>('getStatus');

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
