import {
  BellRing,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
  UserCheck,
  X,
  XCircle,
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
  serviceRequestTime,
  serviceRequestTypeLabel,
  unwrapServiceRequestList,
} from '../../utils/serviceRequests';

const FILTERS = [
  ['ACTIVE', 'Đang mở'],
  ['MOI', 'Mới'],
  ['DA_TIEP_NHAN', 'Đã tiếp nhận'],
  ['HOAN_THANH', 'Hoàn thành'],
  ['DA_HUY', 'Đã hủy'],
  ['ALL', 'Tất cả'],
];

export default function ServiceRequestManage() {
  const toast = useToast();
  const socketEvent = useWebSocket(['/topic/admin/service-requests', '/topic/service-requests']);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRequests(unwrapServiceRequestList(await serviceRequestApi.list('ALL')));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách yêu cầu phục vụ.'));
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (socketEvent?.topic === '/topic/admin/service-requests' || socketEvent?.topic === '/topic/service-requests') load();
  }, [load, socketEvent]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return requests
      .filter((item) => filter === 'ALL' || (filter === 'ACTIVE' ? ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item)) : serviceRequestStatus(item) === filter))
      .filter((item) => !q || `${serviceRequestTableLabel(item)} ${serviceRequestTypeLabel(item)} ${item?.noiDung || ''} ${item?.khuVuc || ''} ${item?.tenNhanVienTiepNhan || ''}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b?.thoiGianTao || 0) - new Date(a?.thoiGianTao || 0));
  }, [filter, keyword, requests]);

  const stats = useMemo(() => ({
    total: requests.length,
    open: requests.filter((item) => ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item))).length,
    accepted: requests.filter((item) => serviceRequestStatus(item) === 'DA_TIEP_NHAN').length,
    overdue: requests.filter((item) => item?.quaHan && ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item))).length,
  }), [requests]);

  async function confirmCancel() {
    const id = serviceRequestId(cancelTarget);
    if (!id) return;
    try {
      setCancelling(true);
      const response = await serviceRequestApi.adminCancel(id, { lyDo: cancelReason.trim() });
      toast.success(messageOf(response, 'Đã hủy yêu cầu phục vụ.'));
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể hủy yêu cầu phục vụ.'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="admin-service-page">
      <div className="admin-service-stats">
        <article><span className="orange"><BellRing size={22} /></span><p>Tổng yêu cầu<strong>{stats.total}</strong></p></article>
        <article><span className="red"><Clock3 size={22} /></span><p>Đang mở<strong>{stats.open}</strong></p></article>
        <article><span className="blue"><UserCheck size={22} /></span><p>Đã tiếp nhận<strong>{stats.accepted}</strong></p></article>
        <article><span className="warning"><Clock3 size={22} /></span><p>Quá 5 phút<strong>{stats.overdue}</strong></p></article>
      </div>

      <div className="admin-service-card">
        <div className="admin-service-toolbar">
          <div className="admin-service-tabs">
            {FILTERS.map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          <label><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm bàn, khu vực, nội dung..." /></label>
        </div>

        <div className="admin-service-table-wrap">
          <table className="admin-service-table">
            <thead><tr><th>Bàn</th><th>Yêu cầu</th><th>Thời gian</th><th>Nhân viên tiếp nhận</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading && !requests.length ? <tr><td colSpan="6" className="admin-service-empty"><LoaderCircle className="spin" size={23} /> Đang tải yêu cầu...</td></tr>
                : filtered.length ? filtered.map((item) => {
                  const id = serviceRequestId(item);
                  const status = serviceRequestStatus(item);
                  const meta = SERVICE_REQUEST_STATUS[status] || { label: status || '—', tone: '' };
                  const active = ['MOI', 'DA_TIEP_NHAN'].includes(status);
                  return (
                    <tr key={id} className={item?.quaHan && active ? 'overdue' : ''}>
                      <td><strong>{serviceRequestTableLabel(item)}</strong><small>{item?.khuVuc || 'Chưa có khu vực'}</small></td>
                      <td><b>{serviceRequestTypeLabel(item)}</b><p>{item?.noiDung || 'Không có ghi chú'}</p>{item?.lyDoHuy ? <em>Lý do hủy: {item.lyDoHuy}</em> : null}</td>
                      <td><span>{serviceRequestTime(item?.thoiGianTao)}</span>{item?.quaHan && active ? <small className="overdue-label">Quá hạn</small> : null}</td>
                      <td>{item?.tenNhanVienTiepNhan ? <span className="admin-service-assignee"><UserCheck size={15} />{item.tenNhanVienTiepNhan}</span> : <span className="admin-service-unassigned">Chưa tiếp nhận</span>}</td>
                      <td><span className={`admin-service-status ${meta.tone}`}>{meta.label}</span></td>
                      <td>{active ? <button type="button" className="admin-service-cancel" onClick={() => { setCancelTarget(item); setCancelReason(''); }}><XCircle size={16} /> Hủy</button> : <span className="admin-service-ended"><CheckCircle2 size={16} /> Đã kết thúc</span>}</td>
                    </tr>
                  );
                }) : <tr><td colSpan="6" className="admin-service-empty">Không có yêu cầu phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {cancelTarget ? (
        <div className="admin-service-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !cancelling && setCancelTarget(null)}>
          <section className="admin-service-modal" role="dialog" aria-modal="true">
            <header><div><h3>Hủy yêu cầu phục vụ</h3><p>{serviceRequestTableLabel(cancelTarget)} · {serviceRequestTypeLabel(cancelTarget)}</p></div><button type="button" onClick={() => !cancelling && setCancelTarget(null)}><X size={19} /></button></header>
            <label><span>Lý do hủy</span><textarea rows="4" maxLength="500" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Nhập lý do để nhân viên và khách hàng biết..." /></label>
            <footer><button type="button" onClick={() => setCancelTarget(null)} disabled={cancelling}>Quay lại</button><button type="button" className="danger" onClick={confirmCancel} disabled={cancelling}>{cancelling ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />}{cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}</button></footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
