import { useEffect, useMemo, useState } from 'react';
import { Ban, ChevronRight, Clock3, Search, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import CancellationRequestsModal from '../../components/order/CancellationRequestsModal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../context/AuthContext';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import { unwrapCancellationRequests } from '../../utils/orderCancellation';
import {
  actionPriority,
  callNumber,
  formatClock,
  isActiveOrder,
  itemCount,
  itemName,
  orderCreatedAt,
  orderGroup,
  orderId,
  pendingReadyCount,
  statusMeta,
  tableNameOfOrder,
  unwrapList,
  waitLabel,
  waitTone,
} from '../../utils/waiterData';

const TAB_GROUPS = [
  ['ACTION', 'Cần xử lý'],
  ['READY', 'Món sẵn sàng'],
  ['PREPARING', 'Đang chế biến'],
  ['PAYMENT', 'Chờ thanh toán'],
];

function matchesTab(order, tab) {
  const group = orderGroup(order);
  if (tab === 'ACTION') return ['READY', 'PAYMENT'].includes(group);
  return group === tab;
}

function latestCall(order) {
  return Math.max(1, ...(order?.chiTietDonHang || []).map(callNumber));
}

function roleOf(user) {
  return String(user?.role || user?.tenVaiTro || user?.vaiTro?.tenVaiTro || '').replace('ROLE_', '').toUpperCase();
}


function ServiceOrderIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 18v12" />
        <path d="M34 18v12" />
        <path d="M16 20h16" />
        <path d="M13 30h22" />
        <path d="M21 20l-3-6" />
        <path d="M27 20l3-6" />
        <path d="M10 16.5h7v4h-7z" />
        <path d="M31 16.5h7v4h-7z" />
      </g>
    </svg>
  );
}


export default function TableStatus() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('ACTION');
  const [keyword, setKeyword] = useState('');
  const [cancelRequests, setCancelRequests] = useState([]);
  const [cancelRequestsOpen, setCancelRequestsOpen] = useState(false);
  const [cancelRequestsLoading, setCancelRequestsLoading] = useState(false);
  const [cancelProcessingId, setCancelProcessingId] = useState(null);
  const event = useWebSocket(['/topic/orders', '/topic/kitchen', '/topic/admin/cancellations']);
  const { user } = useAuth();
  const isAdmin = roleOf(user) === 'ADMIN';

  async function load() {
    try {
      const response = await orderApi.getAll();
      setOrders(unwrapList(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được danh sách đơn'));
    }
  }

  async function loadCancellationRequests(showLoading = false) {
    try {
      if (showLoading) setCancelRequestsLoading(true);
      const response = await orderApi.cancellationRequests('CHO_DUYET');
      setCancelRequests(unwrapCancellationRequests(response));
    } catch (error) {
      if (showLoading) toast.error(errorMessageOf(error, 'Không tải được yêu cầu hủy món'));
    } finally {
      if (showLoading) setCancelRequestsLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadCancellationRequests();
  }, []);

  useEffect(() => {
    if (['/topic/orders', '/topic/kitchen', '/topic/admin/cancellations'].includes(event?.topic)) {
      load();
      loadCancellationRequests();
    }
  }, [event]);

  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders]);

  const counts = useMemo(() => TAB_GROUPS.reduce((result, [value]) => {
    result[value] = activeOrders.filter((order) => matchesTab(order, value)).length;
    return result;
  }, {}), [activeOrders]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return activeOrders
      .filter((order) => matchesTab(order, tab))
      .filter((order) => !q || `${orderId(order) || ''} ${tableNameOfOrder(order)} ${(order.chiTietDonHang || []).map(itemName).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const [priorityA, timeA] = actionPriority(a);
        const [priorityB, timeB] = actionPriority(b);
        return priorityA - priorityB || timeA - timeB;
      });
  }, [activeOrders, keyword, tab]);


  async function processCancellation(request, action, note) {
    const id = request?.maChiTiet;
    if (!id || cancelProcessingId) return;
    try {
      setCancelProcessingId(id);
      const response = action === 'approve'
        ? await orderApi.approveCancellation(id, { ghiChu: note?.trim() || null })
        : await orderApi.rejectCancellation(id, { ghiChu: note?.trim() || null });
      toast.success(messageOf(response, action === 'approve' ? 'Đã duyệt hủy món' : 'Đã từ chối yêu cầu hủy'));
      await Promise.all([load(), loadCancellationRequests()]);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể xử lý yêu cầu hủy món'));
    } finally {
      setCancelProcessingId(null);
    }
  }

  async function openCancellationRequests() {
    setCancelRequestsOpen(true);
    await loadCancellationRequests(true);
  }

  return (
    <section className="waiter-page waiter-queue-page">
      <div className="waiter-card waiter-queue-card">
        <div className="waiter-queue-toolbar">
          <div className="waiter-queue-tabs">
            {TAB_GROUPS.map(([value, label]) => (
              <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
                {label}<span>{counts[value] || 0}</span>
              </button>
            ))}
          </div>
          <div className="waiter-queue-tools">
            <button type="button" className={`waiter-cancel-requests-button ${cancelRequests.length ? 'has-items' : ''}`} onClick={openCancellationRequests}>
              <Ban size={17} />Yêu cầu hủy<span>{cancelRequests.length}</span>
            </button>
            <label className="waiter-search waiter-queue-search">
              <Search size={18} />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm bàn, mã đơn hoặc món ăn..." />
            </label>
          </div>
        </div>

        <div className="waiter-action-note">
          <strong>Thứ tự ưu tiên:</strong> món đã sẵn sàng → bàn chờ thanh toán → món đang chế biến.
        </div>

        <div className="waiter-order-feed">
          {filtered.map((order) => {
            const id = orderId(order);
            const meta = statusMeta(order.trangThai);
            const group = orderGroup(order);
            const items = (order.chiTietDonHang || []).filter((item) => String(item?.trangThaiMon || '').toUpperCase() !== 'DA_HUY');
            const readyCount = pendingReadyCount(order);
            const call = latestCall(order);
            const createdAt = orderCreatedAt(order);
            const elapsedTone = waitTone(createdAt, group);
            const buttonLabel = group === 'READY' ? 'Phục vụ món' : group === 'PAYMENT' ? 'Xem yêu cầu' : 'Cập nhật';
            return (
              <article className={`waiter-order-feed-card ${meta.tone} ${group === 'READY' ? 'priority-card' : ''}`} key={id}>
                <div className="waiter-feed-main">
                  <div className="waiter-feed-main-row">
                    <div className={`waiter-order-table-icon ${meta.tone}`}>
                      <ServiceOrderIcon />
                    </div>
                    <div className="waiter-feed-main-content">
                      <div className="waiter-feed-title">
                        <div>
                          <strong>{tableNameOfOrder(order)}</strong>
                          <span>#{id}</span>
                          {call > 1 ? <em>Lượt gọi #{call}</em> : null}
                        </div>
                        <span className={`waiter-status-badge ${meta.tone}`}>{meta.label}</span>
                      </div>
                      <div className="waiter-feed-summary">
                        <span><UtensilsCrossed size={16} />{itemCount(order)} món</span>
                        {readyCount > 0 ? <span className="waiter-ready-count">{readyCount} món cần mang ra</span> : null}
                        <p>{items.length ? items.slice(0, 4).map(itemName).join(', ') : 'Chưa có chi tiết món'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="waiter-feed-side">
                  <div className={`waiter-elapsed ${elapsedTone}`}>
                    <Clock3 size={15} />
                    <span><b>{waitLabel(createdAt)}</b><small>Từ {formatClock(createdAt)}</small></span>
                  </div>
                  <Link className="waiter-view-button" to={`/waiter/orders/${id}`}>{buttonLabel} <ChevronRight size={17} /></Link>
                </div>
              </article>
            );
          })}
          {!filtered.length ? <div className="waiter-queue-empty">Không có đơn hàng phù hợp.</div> : null}
        </div>
      </div>

      <CancellationRequestsModal
        open={cancelRequestsOpen}
        requests={cancelRequests}
        loading={cancelRequestsLoading}
        processingId={cancelProcessingId}
        isAdmin={isAdmin}
        onClose={() => !cancelProcessingId && setCancelRequestsOpen(false)}
        onApprove={(request, note) => processCancellation(request, 'approve', note)}
        onReject={(request, note) => processCancellation(request, 'reject', note)}
      />
    </section>
  );
}
