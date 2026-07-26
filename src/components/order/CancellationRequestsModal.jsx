import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, Loader2, X, XCircle } from 'lucide-react';
import { cancellationReasonLabel, cancellationSourceLabel } from '../../utils/orderCancellation';

function formatDateTime(value) {
  if (!value) return 'Không rõ thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CancellationRequestsModal({
  open,
  requests = [],
  loading = false,
  processingId = null,
  isAdmin = false,
  onClose,
  onApprove,
  onReject,
}) {
  const [notes, setNotes] = useState({});

  useEffect(() => {
    if (open) setNotes({});
  }, [open]);

  if (!open) return null;

  function noteFor(id) {
    return notes[id] || '';
  }

  function updateNote(id, value) {
    setNotes((current) => ({ ...current, [id]: value }));
  }

  return (
    <div className="cancel-requests-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !processingId && onClose?.()}>
      <section className="cancel-requests-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="cancel-requests-eyebrow">Xử lý nghiệp vụ</span>
            <h3>Yêu cầu hủy món</h3>
            <p>Kiểm tra lý do và trạng thái chế biến trước khi phê duyệt.</p>
          </div>
          <button type="button" onClick={() => !processingId && onClose?.()} disabled={Boolean(processingId)} aria-label="Đóng"><X size={20} /></button>
        </header>

        <div className="cancel-requests-body">
          {loading ? (
            <div className="cancel-requests-state"><Loader2 className="spin" size={28} /><span>Đang tải yêu cầu...</span></div>
          ) : requests.length === 0 ? (
            <div className="cancel-requests-state done"><Check size={28} /><span>Không có yêu cầu hủy đang chờ.</span></div>
          ) : requests.map((request) => {
            const id = request?.maChiTiet;
            const processing = String(processingId) === String(id);
            const waiterCannotProcess = !isAdmin && String(request?.trangThaiTruocHuy || '').toUpperCase() !== 'CHO_BEP';
            return (
              <article className="cancel-request-card" key={id}>
                <div className="cancel-request-main">
                  <div className="cancel-request-title">
                    <div>
                      <strong>{request?.tenBan || `Bàn ${request?.maBan || '—'}`}</strong>
                      <span>Đơn #{request?.maDonHang}</span>
                    </div>
                    <span className="cancel-request-status">Chờ duyệt</span>
                  </div>

                  <h4>{request?.tenMonAn || 'Món ăn'} <small>× {request?.soLuong || 0}</small></h4>
                  <div className="cancel-request-meta">
                    <p><span>Lý do</span><b>{request?.lyDoHuy || cancellationReasonLabel(request?.maLyDoHuy)}</b></p>
                    {request?.ghiChuHuy ? <p><span>Ghi chú</span><b>{request.ghiChuHuy}</b></p> : null}
                    <p><span>Người yêu cầu</span><b>{request?.tenNguoiYeuCauHuy || cancellationSourceLabel(request?.nguonYeuCauHuy)}</b></p>
                    <p><span>Trạng thái trước hủy</span><b>{request?.trangThaiTruocHuy || 'Không xác định'}</b></p>
                  </div>
                  <small className="cancel-request-time"><Clock3 size={14} />{formatDateTime(request?.thoiGianYeuCauHuy)}</small>
                </div>

                <div className="cancel-request-actions">
                  <label>
                    <span>Ghi chú xử lý</span>
                    <input
                      value={noteFor(id)}
                      onChange={(event) => updateNote(id, event.target.value)}
                      maxLength={255}
                      disabled={Boolean(processingId)}
                      placeholder="Không bắt buộc"
                    />
                  </label>
                  {waiterCannotProcess ? (
                    <div className="cancel-request-admin-note"><AlertTriangle size={16} />Món đã bắt đầu chế biến, chỉ admin được duyệt hủy.</div>
                  ) : null}
                  <div>
                    <button type="button" className="reject" onClick={() => onReject?.(request, noteFor(id))} disabled={Boolean(processingId) || waiterCannotProcess}>
                      {processing ? <Loader2 size={16} className="spin" /> : <XCircle size={16} />} Từ chối
                    </button>
                    <button type="button" className="approve" onClick={() => onApprove?.(request, noteFor(id))} disabled={Boolean(processingId) || waiterCannotProcess}>
                      {processing ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Duyệt hủy
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
