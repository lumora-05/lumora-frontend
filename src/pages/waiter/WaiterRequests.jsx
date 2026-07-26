import {
  BellRing,
  CheckCircle2,
  Clock3,
  HandPlatter,
  LoaderCircle,
  Search,
  UserCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { serviceRequestApi } from '../../api/serviceRequestApi';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  SERVICE_REQUEST_STATUS,
  serviceRequestId,
  serviceRequestStatus,
  serviceRequestTableLabel,
  serviceRequestTypeLabel,
  serviceRequestWaitLabel,
  unwrapServiceRequestList,
} from '../../utils/serviceRequests';

const FILTERS = [
  ['ACTIVE', 'Đang xử lý'],
  ['MOI', 'Mới'],
  ['DA_TIEP_NHAN', 'Đã tiếp nhận'],
  ['HOAN_THANH', 'Hoàn thành'],
  ['ALL', 'Tất cả'],
];

export default function WaiterRequests() {
  const toast = useToast();
  const socketEvent = useWebSocket(['/topic/service-requests']);
  const [requests, setRequests] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRequests(unwrapServiceRequestList(await serviceRequestApi.list('ALL')));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải yêu cầu phục vụ.'));
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (socketEvent?.topic === '/topic/service-requests') load();
  }, [load, socketEvent]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return requests
      .filter((item) => filter === 'ALL' || (filter === 'ACTIVE' ? ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item)) : serviceRequestStatus(item) === filter))
      .filter((item) => !q || `${serviceRequestTableLabel(item)} ${serviceRequestTypeLabel(item)} ${item?.noiDung || ''} ${item?.khuVuc || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (Boolean(a?.quaHan) !== Boolean(b?.quaHan)) return a?.quaHan ? -1 : 1;
        return new Date(a?.thoiGianTao || 0) - new Date(b?.thoiGianTao || 0);
      });
  }, [filter, keyword, requests]);

  const stats = useMemo(() => ({
    total: requests.length,
    newCount: requests.filter((item) => serviceRequestStatus(item) === 'MOI').length,
    accepted: requests.filter((item) => serviceRequestStatus(item) === 'DA_TIEP_NHAN').length,
    overdue: requests.filter((item) => item?.quaHan && ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item))).length,
  }), [requests]);

  async function changeStatus(item) {
    const id = serviceRequestId(item);
    const status = serviceRequestStatus(item);
    if (!id || !['MOI', 'DA_TIEP_NHAN'].includes(status)) return;
    try {
      setChangingId(id);
      const response = status === 'MOI'
        ? await serviceRequestApi.accept(id)
        : await serviceRequestApi.complete(id);
      toast.success(messageOf(response, status === 'MOI' ? 'Đã tiếp nhận yêu cầu.' : 'Đã hoàn thành yêu cầu.'));
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật yêu cầu phục vụ.'));
      await load();
    } finally {
      setChangingId(null);
    }
  }

  return (
    <section className="waiter-page waiter-service-page">
      <div className="waiter-service-stats">
        <article><span className="orange"><BellRing size={21} /></span><div><small>Tổng yêu cầu</small><strong>{stats.total}</strong></div></article>
        <article><span className="red"><Clock3 size={21} /></span><div><small>Yêu cầu mới</small><strong>{stats.newCount}</strong></div></article>
        <article><span className="blue"><UserCheck size={21} /></span><div><small>Đã tiếp nhận</small><strong>{stats.accepted}</strong></div></article>
        <article><span className="warning"><Clock3 size={21} /></span><div><small>Quá 5 phút</small><strong>{stats.overdue}</strong></div></article>
      </div>

      <div className="waiter-card waiter-request-card">
        <div className="waiter-orders-toolbar waiter-service-toolbar">
          <div className="waiter-order-tabs">
            {FILTERS.map(([value, label]) => (
              <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
          <label className="waiter-search"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm bàn, khu vực, yêu cầu..." /></label>
        </div>

        <div className="waiter-request-list waiter-service-request-list">
          {loading && !requests.length ? (
            <div className="waiter-service-empty"><LoaderCircle className="spin" size={25} /> Đang tải yêu cầu...</div>
          ) : filtered.length ? filtered.map((item) => {
            const id = serviceRequestId(item);
            const status = serviceRequestStatus(item);
            const meta = SERVICE_REQUEST_STATUS[status] || { label: status || '—', tone: '' };
            const active = ['MOI', 'DA_TIEP_NHAN'].includes(status);
            return (
              <article key={id} className={item?.quaHan && active ? 'overdue' : ''}>
                <span className={`request-icon ${meta.tone}`}><HandPlatter size={22} /></span>
                <div className="waiter-service-request-content">
                  <div className="waiter-service-request-title">
                    <h3>{serviceRequestTableLabel(item)} · {serviceRequestTypeLabel(item)}</h3>
                    {item?.quaHan && active ? <em>Quá hạn</em> : null}
                  </div>
                  <p>{item?.noiDung || 'Khách không để lại ghi chú.'}</p>
                  <small><Clock3 size={14} />{serviceRequestWaitLabel(item)}{item?.khuVuc ? ` · ${item.khuVuc}` : ''}</small>
                  {item?.tenNhanVienTiepNhan ? <span className="waiter-service-assignee"><UserCheck size={14} /> {item.tenNhanVienTiepNhan}</span> : null}
                </div>
                <span className={`waiter-status-badge ${meta.tone}`}>{meta.label}</span>
                {active ? (
                  <button type="button" onClick={() => changeStatus(item)} disabled={changingId === id}>
                    {changingId === id ? <LoaderCircle className="spin" size={16} /> : status === 'MOI' ? <UserCheck size={16} /> : <CheckCircle2 size={16} />}
                    {changingId === id ? 'Đang xử lý...' : status === 'MOI' ? 'Tiếp nhận' : 'Hoàn thành'}
                  </button>
                ) : <span className="waiter-service-finished"><CheckCircle2 size={16} /> Đã kết thúc</span>}
              </article>
            );
          }) : <div className="waiter-service-empty">Không có yêu cầu phù hợp.</div>}
        </div>
      </div>
    </section>
  );
}
