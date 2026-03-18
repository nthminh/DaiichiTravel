import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  dismissToast: (id: number) => void;
}

/**
 * Lightweight in-component toast notification hook.
 * Usage: const { toasts, showToast } = useToast();
 * Render <ToastContainer toasts={toasts} onDismiss={dismissToast} /> anywhere.
 */
export function useToast(defaultDurationMs = 4000): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs?: number) => {
      const id = ++idRef.current;
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, durationMs ?? defaultDurationMs);
    },
    [defaultDurationMs],
  );

  return { toasts, showToast, dismissToast };
}
