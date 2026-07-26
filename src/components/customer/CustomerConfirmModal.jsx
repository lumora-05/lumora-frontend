import { useEffect } from 'react';
import { CreditCard, LoaderCircle, X } from 'lucide-react';

export default function CustomerConfirmModal({
  open,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Quay lại',
  loading = false,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) onClose?.();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget && !loading) onClose?.();
  }

  return (
    <div className="customer-confirm-backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className="customer-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-confirm-title"
        aria-describedby="customer-confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="customer-confirm-close"
          onClick={() => onClose?.()}
          disabled={loading}
          aria-label="Đóng hộp thoại"
        >
          <X size={18} />
        </button>

        <div className="customer-confirm-brand">LUMORA</div>
        <div className="customer-confirm-icon" aria-hidden="true">
          <CreditCard size={28} />
        </div>

        <h2 id="customer-confirm-title">{title}</h2>
        <p id="customer-confirm-description">{description}</p>

        <div className="customer-confirm-actions">
          <button type="button" className="secondary" onClick={() => onClose?.()} disabled={loading}>
            {cancelText}
          </button>
          <button type="button" className="primary" onClick={() => onConfirm?.()} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : <CreditCard size={18} />}
            {loading ? 'Đang gửi...' : confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}
