import { useCallback, useEffect, useState } from 'react';
import { call, errorText, type ProjectList, type Status } from './api';

export type Loadable<T> = { data?: T; error?: string; loading: boolean; reload: () => void };

function useCall<T>(key: string): Loadable<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    call<T>(key)
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e) => alive && setState({ error: errorText(e), loading: false }));
    return () => {
      alive = false;
    };
  }, [key, nonce]);
  return { ...state, reload };
}

export const useStatus = () => useCall<Status>('getStatus');
export const useProjects = () => useCall<ProjectList>('listProjects');
