import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, Loader2, X } from 'lucide-react';
import { CANCELLATION_REASONS, ITEM_CANCELLATION_STATUS_LABELS } from '../../utils/orderCancellation';

function foodName(item) {
  return item?.monAn?.tenMonAn || item?.tenMonAn || item?.tenMon || 'Món ăn';
}

export default function OrderItemCancellationModal({
  open,
  item,
  loading = false,
  actor = 'staff',
  onClose,
  onSubmit,
}) {
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [validation, setValidation] = useState('');

  useEffect(() => {
    if (!open) return;
    setReasonCode('');
    setNote('');
    setValidation('');
  }, [open, item]);

  if (!open || !item) return null;

  const status = String(item?.trangThaiMon || '').toUpperCase();
  const requestOnly = actor === 'customer' || (actor === 'waiter' && ['DANG_NAU', 'DANG_CHE_BIEN'].includes(status));
  const title = requestOnly ? 'Yêu cầu hủy món' : 'Hủy món';
  const submitText = requestOnly ? 'Gửi yêu cầu hủy' : 'Xác nhận hủy món';

  function close() {
    if (!loading) onClose?.();
  }

  async function submit(event) {
    event.preventDefault();
    if (!reasonCode) {
      setValidation('Vui lòng chọn lý do hủy món.');
      return;
    }
    if (reasonCode === 'LY_DO_KHAC' && !note.trim()) {
      setValidation('Vui lòng nhập nội dung cho lý do khác.');
      return;
    }
    setValidation('');
    await onSubmit?.({ maLyDo: reasonCode, ghiChu: note.trim() || null });
  }

  return (
    <div className="order-cancel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="order-cancel-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="order-cancel-close" onClick={close} disabled={loading} aria-label="Đóng">
          <X size={19} />
        </button>

        <div className="order-cancel-icon"><Ban size={25} /></div>
        <h3>{title}</h3>
        <p className="order-cancel-description">
          {requestOnly
            ? 'Yêu cầu sẽ được nhân viên có quyền kiểm tra trước khi món được hủy.'
            : 'Món sẽ được giữ trong lịch sử đơn nhưng không còn tính vào tổng tiền.'}
        </p>

        <div className="order-cancel-item-summary">
          <div>
            <span>Món ăn</span>
            <strong>{foodName(item)}</strong>
          </div>
          <div>
            <span>Số lượng</span>
            <strong>{item?.soLuong || 0}</strong>
          </div>
          <div>
            <span>Trạng thái</span>
            <strong>{ITEM_CANCELLATION_STATUS_LABELS[status] || status || 'Không xác định'}</strong>
          </div>
        </div>

        <label className="order-cancel-field">
          <span>Lý do hủy <b>*</b></span>
          <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={loading}>
            <option value="">Chọn lý do hủy món</option>
            {CANCELLATION_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
          </select>
        </label>

        <label className="order-cancel-field">
          <span>Ghi chú {reasonCode === 'LY_DO_KHAC' ? <b>*</b> : '(không bắt buộc)'}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
            maxLength={255}
            rows={3}
            placeholder={reasonCode === 'LY_DO_KHAC' ? 'Nhập lý do cụ thể...' : 'Bổ sung thông tin nếu cần...'}
          />
          <small>{note.length}/255</small>
        </label>

        {validation ? <div className="order-cancel-validation"><AlertTriangle size={16} />{validation}</div> : null}

        {actor !== 'admin' && ['DANG_NAU', 'DANG_CHE_BIEN'].includes(status) ? (
          <div className="order-cancel-warning">
            <AlertTriangle size={17} />
            <span>Món đã bắt đầu chế biến. Yêu cầu này cần admin phê duyệt.</span>
          </div>
        ) : null}

        <div className="order-cancel-actions">
          <button type="button" className="secondary" onClick={close} disabled={loading}>Quay lại</button>
          <button type="submit" className="danger" disabled={loading}>
            {loading ? <Loader2 size={17} className="spin" /> : <Ban size={17} />}
            {loading ? 'Đang xử lý...' : submitText}
          </button>
        </div>
      </form>
    </div>
  );
}
