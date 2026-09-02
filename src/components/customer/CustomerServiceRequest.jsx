import {
  BellRing,
  CheckCircle2,
  Clock3,
  Droplets,
  HandPlatter,
  LoaderCircle,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { serviceRequestApi } from '../../api/serviceRequestApi';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  SERVICE_REQUEST_STATUS,
  SERVICE_REQUEST_TYPES,
  serviceRequestId,
  serviceRequestStatus,
  serviceRequestTime,
  serviceRequestTypeLabel,
  unwrapServiceRequestList,
} from '../../utils/serviceRequests';

const ICONS = {
  GOI_NHAN_VIEN: HandPlatter,
  THEM_NUOC: Droplets,
  THEM_DUNG_CU: Utensils,
  THEM_KHAN_GIAY: Sparkles,
  DON_BAN: Trash2,
  YEU_CAU_KHAC: BellRing,
};

export default function CustomerServiceRequest({ qrToken, tableId }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('GOI_NHAN_VIEN');
  const [content, setContent] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const tableTopic = tableId ? `/topic/customer/tables/${tableId}` : '';
  const serviceTopic = tableId ? `/topic/customer/tables/${tableId}/service-requests` : '';
  const socketEvent = useWebSocket([
    serviceTopic || '/topic/customer/tables/pending/service-requests',
    tableTopic || '/topic/customer/tables/pending',
  ]);

  const load = useCallback(async () => {
    if (!qrToken) return;
    try {
      setLoading(true);
      setRequests(unwrapServiceRequestList(await serviceRequestApi.customerRecent(qrToken)));
    } catch (error) {
      if (open) toast.error(errorMessageOf(error, 'Không thể tải yêu cầu phục vụ.'));
    } finally {
      setLoading(false);
    }
  }, [open, qrToken, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const openFromChatbot = () => {
      setSelectedType('GOI_NHAN_VIEN');
      setOpen(true);
    };
    window.addEventListener('lumora:open-service-request', openFromChatbot);
    return () => window.removeEventListener('lumora:open-service-request', openFromChatbot);
  }, []);

  useEffect(() => {
    if (!socketEvent) return;
    if (socketEvent.topic === serviceTopic || socketEvent.topic === tableTopic) load();
  }, [load, open, serviceTopic, socketEvent, tableTopic]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const activeRequests = useMemo(
    () => requests.filter((item) => ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item))),
    [requests],
  );
  const recentRequests = useMemo(() => requests.slice(0, 6), [requests]);
  const selected = SERVICE_REQUEST_TYPES.find((type) => type.value === selectedType);
  const duplicate = activeRequests.some((item) => item?.loaiYeuCau === selectedType);
  const canSubmit = !submitting
    && !duplicate
    && activeRequests.length < 3
    && (selectedType !== 'YEU_CAU_KHAC' || content.trim().length > 0);

  async function submit() {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const response = await serviceRequestApi.customerCreate(qrToken, {
        loaiYeuCau: selectedType,
        noiDung: content.trim(),
      });
      toast.success(messageOf(response, 'Yêu cầu đã được gửi đến nhân viên phục vụ.'));
      setContent('');
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể gửi yêu cầu phục vụ.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(item) {
    const id = serviceRequestId(item);
    if (!id || serviceRequestStatus(item) !== 'MOI') return;
    try {
      setCancellingId(id);
      const response = await serviceRequestApi.customerCancel(qrToken, id, {
        lyDo: 'Khách không còn cần hỗ trợ',
      });
      toast.success(messageOf(response, 'Đã hủy yêu cầu phục vụ.'));
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể hủy yêu cầu phục vụ.'));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`customer-service-trigger ${activeRequests.length ? 'has-active' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Gọi nhân viên phục vụ"
      >
        <BellRing size={18} />
        
        {activeRequests.length ? <b>{activeRequests.length}</b> : null}
      </button>

      <button
        type="button"
        className={`customer-service-floating ${activeRequests.length ? 'has-active' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Gọi nhân viên phục vụ"
      >
        <BellRing size={21} />
        {activeRequests.length ? <b>{activeRequests.length}</b> : null}
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div className="customer-service-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="customer-service-modal" role="dialog" aria-modal="true" aria-label="Yêu cầu phục vụ tại bàn">
            <header>
              <div>
                <span><BellRing size={18} /></span>
                <div>
                  <h2>Gọi phục vụ</h2>
                  <p>Chọn nội dung cần hỗ trợ tại bàn của bạn.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng"><X size={20} /></button>
            </header>

            <div className="customer-service-body">
              <div className="customer-service-type-grid">
                {SERVICE_REQUEST_TYPES.map((type) => {
                  const Icon = ICONS[type.value] || BellRing;
                  const disabled = activeRequests.some((item) => item?.loaiYeuCau === type.value);
                  return (
                    <button
                      type="button"
                      key={type.value}
                      className={selectedType === type.value ? 'active' : ''}
                      disabled={disabled}
                      onClick={() => setSelectedType(type.value)}
                    >
                      <span><Icon size={19} /></span>
                      <strong>{type.label}</strong>
                      {disabled ? <small>Đã gửi</small> : null}
                    </button>
                  );
                })}
              </div>

              <div className="customer-service-compose">
                <div>
                  <strong>{selected?.label}</strong>
                  <p>{selected?.description}</p>
                </div>
                <label>
                  <span>Ghi chú {selectedType === 'YEU_CAU_KHAC' ? '(bắt buộc)' : '(không bắt buộc)'}</span>
                  <textarea
                    rows="3"
                    maxLength="500"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={selectedType === 'YEU_CAU_KHAC' ? 'Nhập nội dung cần hỗ trợ...' : 'Ví dụ: xin thêm 2 bộ chén đũa...'}
                  />
                </label>
                {duplicate ? <div className="customer-service-notice">Yêu cầu cùng loại đang được xử lý.</div> : null}
                {activeRequests.length >= 3 ? <div className="customer-service-notice">Bàn đang có tối đa 3 yêu cầu chưa hoàn thành.</div> : null}
                <button type="button" className="customer-service-submit" onClick={submit} disabled={!canSubmit}>
                  {submitting ? <LoaderCircle className="spin" size={18} /> : <BellRing size={18} />}
                  {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>

              <div className="customer-service-history">
                <div className="customer-service-section-title">
                  <strong>Yêu cầu gần đây</strong>
                  <span>{activeRequests.length} đang xử lý</span>
                </div>
                {loading ? (
                  <div className="customer-service-empty"><LoaderCircle className="spin" size={22} /> Đang tải yêu cầu...</div>
                ) : recentRequests.length ? (
                  <div className="customer-service-history-list">
                    {recentRequests.map((item) => {
                      const status = serviceRequestStatus(item);
                      const meta = SERVICE_REQUEST_STATUS[status] || { label: status || '—', tone: '' };
                      return (
                        <article key={serviceRequestId(item)}>
                          <span className={`customer-service-status-icon ${meta.tone}`}>
                            {status === 'HOAN_THANH' ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
                          </span>
                          <div>
                            <strong>{serviceRequestTypeLabel(item)}</strong>
                            {item?.noiDung ? <p>{item.noiDung}</p> : null}
                            <small>{serviceRequestTime(item?.thoiGianTao)}</small>
                          </div>
                          <div className="customer-service-history-side">
                            <span className={`customer-service-status ${meta.tone}`}>{meta.label}</span>
                            {status === 'MOI' ? (
                              <button type="button" onClick={() => cancel(item)} disabled={cancellingId === serviceRequestId(item)}>
                                {cancellingId === serviceRequestId(item) ? 'Đang hủy...' : 'Hủy'}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="customer-service-empty">Chưa có yêu cầu phục vụ nào.</div>
                )}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
