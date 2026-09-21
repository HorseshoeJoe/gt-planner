import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

/**
 * Small notification system. Messages are announced through an aria-live
 * region so screen-reader users hear confirmations too, rather than relying on
 * the visual toast alone.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4500);
  }, []);

  const value = useMemo(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push]
  );

  const tones = {
    success: 'border-green-300 bg-green-50 text-green-900',
    error: 'border-red-300 bg-red-50 text-red-900',
    info: 'border-brand-100 bg-brand-50 text-brand-800',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${tones[t.tone]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
