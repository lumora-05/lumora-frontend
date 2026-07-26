import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

function readMessage(input, fallback) {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  return input.message || input.error || input?.response?.data?.message || fallback;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const text = readMessage(message, type === 'success' ? 'Thao tác thành công' : 'Thao tác thất bại');
    setToasts((items) => [...items, { id, type, message: text }]);
    window.setTimeout(() => remove(id), 3200);
  }, [remove]);

  const value = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message)
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
