import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  title = 'Xác nhận thao tác',
  description,
  itemName,
  warning,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
}) {
  if (!open) return null;

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget || loading) return;
    onClose?.();
  }

  return (
    <div className="confirm-action-backdrop" onMouseDown={handleBackdropClick}>
      <div className="confirm-action-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button
          type="button"
          className="confirm-action-close"
          onClick={() => !loading && onClose?.()}
          disabled={loading}
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        <div className="confirm-action-icon">
          <Trash2 size={24} />
        </div>

        <h3>{title}</h3>
        {description ? <p className="confirm-action-description">{description}</p> : null}
        {itemName ? <div className="confirm-action-name">“{itemName}”</div> : null}

        {warning ? (
          <div className="confirm-action-warning">
            <AlertTriangle size={17} />
            <span>{warning}</span>
          </div>
        ) : null}

        <div className="confirm-action-buttons">
          <button type="button" className="secondary" onClick={() => onClose?.()} disabled={loading}>
            {cancelText}
          </button>
          <button type="button" className="danger" onClick={() => onConfirm?.()} disabled={loading}>
            <Trash2 size={16} />
            {loading ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
