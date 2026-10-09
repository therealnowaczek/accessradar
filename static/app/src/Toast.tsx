import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AutoDismissFlag, FlagGroup } from '@atlaskit/flag';
import ErrorIcon from '@atlaskit/icon/core/status-error';
import SuccessIcon from '@atlaskit/icon/core/status-success';

type Toast = { id: number; title: string; description?: string; tone: 'success' | 'error' };
type Toaster = {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
};

const ToastContext = createContext<Toaster>({ success: () => undefined, error: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

/** Non-blocking confirmations for saved/deleted results, announced politely to screen readers. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback(
    (tone: Toast['tone']) => (title: string, description?: string) =>
      setToasts((current) => [
        ...current.slice(-2),
        { id: Date.now() + Math.random(), title, description, tone },
      ]),
    [],
  );
  const toaster = useMemo<Toaster>(
    () => ({ success: push('success'), error: push('error') }),
    [push],
  );
  const dismiss = useCallback(
    (id: number | string) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  );
  return (
    <ToastContext.Provider value={toaster}>
      {children}
      <FlagGroup onDismissed={dismiss}>
        {toasts.map((toast) => (
          <AutoDismissFlag
            key={toast.id}
            id={toast.id}
            title={toast.title}
            description={toast.description}
            icon={
              toast.tone === 'success' ? (
                <SuccessIcon label="Success" color="var(--ds-icon-success)" />
              ) : (
                <ErrorIcon label="Error" color="var(--ds-icon-danger)" />
              )
            }
          />
        ))}
      </FlagGroup>
    </ToastContext.Provider>
  );
}
