import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

function readMessage(input, fallback) {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  return input.message || input.error || input?.response?.data?.message || fallback;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((type, message, options = {}) => {
    const id = options.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duration = Math.max(0, Number(options.duration ?? 3200) || 0);
    const text = readMessage(message, type === 'success' ? 'Thao tác thành công' : 'Thao tác thất bại');

    setToasts((items) => {
      const exists = items.some((item) => item.id === id);
      if (exists) {
        return items.map((item) => (item.id === id ? { id, type, message: text } : item));
      }
      return [...items, { id, type, message: text }];
    });

    const currentTimer = timersRef.current.get(id);
    if (currentTimer) window.clearTimeout(currentTimer);

    if (duration > 0) {
      const timer = window.setTimeout(() => remove(id), duration);
      timersRef.current.set(id, timer);
    } else {
      timersRef.current.delete(id);
    }
  }, [remove]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const value = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options)
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => remove(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      info: () => {}
    };
  }
  return ctx;
}

export function messageOf(result, fallback = 'Thao tác thành công') {
  return readMessage(result, fallback);
}

export function errorMessageOf(error, fallback = 'Thao tác thất bại') {
  return readMessage(error, fallback);
}
