import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { cn } from '../lib/utils.js';

export const ToastCtx = createContext(null);

const NOOP_TOAST = { success: () => {}, error: () => {}, info: () => {} };

export const useToast = () => useContext(ToastCtx) || NOOP_TOAST;

const TOAST_STYLES = {
  success: { wrap: 'border-emerald-200 bg-white', icon: 'text-emerald-600 bg-emerald-50', name: 'check' },
  error: { wrap: 'border-rose-200 bg-white', icon: 'text-rose-600 bg-rose-50', name: 'alert' },
  info: { wrap: 'border-sky-200 bg-white', icon: 'text-sky-600 bg-sky-50', name: 'info' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list, { id, type, message: String(message) }]);
      setTimeout(() => dismiss(id), 4600);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const s = TOAST_STYLES[t.type] || TOAST_STYLES.info;
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-pop animate-slide-in-right',
                s.wrap
              )}
            >
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', s.icon)}>
                <Icon name={s.name} className="h-4 w-4" />
              </span>
              <p className="flex-1 pt-1 text-sm leading-snug text-slate-700">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
