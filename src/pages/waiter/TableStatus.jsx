import { useEffect, useMemo, useState } from 'react';
import { Ban, ChevronRight, Clock3, Link2, Search, UtensilsCrossed } from 'lucide-react';
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

const TABLE_ICON_BY_GROUP = {
  READY: '/waiter-icons/table-chair-ready.png',
  PREPARING: '/waiter-icons/table-chair-preparing.png',
  PAYMENT: '/waiter-icons/table-chair-payment.png',
};

const PREPARING_ITEM_STATUSES = new Set([
  'MOI',
  'CHO_CHE_BIEN',
  'CHO_BEP',
  'DANG_NAU',
  'DANG_CHE_BIEN',
]);

function queueGroup(order) {
  const orderStatusGroup = orderGroup(order);
  if (orderStatusGroup === 'PAYMENT') return 'PAYMENT';

  const rawItems = order?.chiTietDonHang;
  if (!Array.isArray(rawItems)) return orderStatusGroup;

  const activeItems = rawItems.filter((item) => String(item?.trangThaiMon || '').toUpperCase() !== 'DA_HUY');
  if (pendingReadyCount(order) > 0) return 'READY';
  if (activeItems.some((item) => PREPARING_ITEM_STATUSES.has(String(item?.trangThaiMon || item?.trangThai || '').toUpperCase()))) {
    return 'PREPARING';
  }

  return 'OTHER';
}


function latestCall(order) {
  return Math.max(1, ...(order?.chiTietDonHang || []).map(callNumber));
}

function roleOf(user) {
  return String(user?.role || user?.tenVaiTro || user?.vaiTro?.tenVaiTro || '').replace('ROLE_', '').toUpperCase();
}


function sharedPaymentGroupId(order) {
  return String(order?.maNhomThanhToan || '').trim();
}

function buildOrderGroups(orders) {
  const groups = new Map();
  orders.forEach((order) => {
    const sharedId = sharedPaymentGroupId(order);
    const key = sharedId ? `shared:${sharedId}` : `order:${orderId(order)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  });

  return Array.from(groups.entries()).map(([key, rows]) => {
    const sortedRows = [...rows].sort((a, b) => tableNameOfOrder(a).localeCompare(tableNameOfOrder(b), 'vi', { numeric: true }));
    return {
      key,
      rows: sortedRows,
      shared: key.startsWith('shared:') && sortedRows.length > 1,
    };
  });
}

function queueGroupOfRows(rows) {
  const groups = rows.map(queueGroup);
  if (groups.includes('PAYMENT')) return 'PAYMENT';
  if (groups.includes('READY')) return 'READY';
  if (groups.includes('PREPARING')) return 'PREPARING';
  return groups[0] || 'OTHER';
}

function matchesGroupTab(group, tab) {
  const queue = queueGroupOfRows(group.rows);
  if (tab === 'ACTION') return ['READY', 'PAYMENT'].includes(queue);
  return queue === tab;
}

function groupPriority(group) {
  return group.rows
    .map(actionPriority)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])[0] || [99, 0];
}

function groupSearchText(group) {
  return group.rows.map((order) => `${orderId(order) || ''} ${tableNameOfOrder(order)} ${(order.chiTietDonHang || []).map(itemName).join(' ')}`).join(' ');
}

function groupTableLabel(group) {
  return [...new Set(group.rows.map(tableNameOfOrder).filter(Boolean))].join(' + ');
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
  const orderGroups = useMemo(() => buildOrderGroups(activeOrders), [activeOrders]);

  const counts = useMemo(() => TAB_GROUPS.reduce((result, [value]) => {
    result[value] = orderGroups.filter((group) => matchesGroupTab(group, value)).length;
    return result;
  }, {}), [orderGroups]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orderGroups
      .filter((group) => matchesGroupTab(group, tab))
      .filter((group) => !q || groupSearchText(group).toLowerCase().includes(q))
      .sort((a, b) => {
        const [priorityA, timeA] = groupPriority(a);
        const [priorityB, timeB] = groupPriority(b);
        return priorityA - priorityB || timeA - timeB;
      });
  }, [orderGroups, keyword, tab]);


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

  function renderOrderCard(order, nested = false) {
    const id = orderId(order);
    const meta = statusMeta(order.trangThai);
    const group = orderGroup(order);
    const items = (order.chiTietDonHang || []).filter((item) => String(item?.trangThaiMon || '').toUpperCase() !== 'DA_HUY');
    const readyCount = pendingReadyCount(order);
    const call = latestCall(order);
    const createdAt = orderCreatedAt(order);
    const elapsedTone = waitTone(createdAt, group);
    const tableIcon = elapsedTone === 'urgent'
      ? '/waiter-icons/table-chair-action.png'
      : elapsedTone === 'warning'
        ? '/waiter-icons/table-chair-preparing.png'
        : TABLE_ICON_BY_GROUP[group] || '/waiter-icons/table-chair-action.png';
    const buttonLabel = group === 'READY' ? 'Phục vụ món' : group === 'PAYMENT' ? 'Xem yêu cầu' : 'Cập nhật';

    return (
      <article className={`waiter-order-feed-card ${nested ? 'waiter-shared-order-row' : ''} ${meta.tone} ${group === 'READY' ? 'priority-card' : ''} wait-${elapsedTone}`} key={id}>
        <div className="waiter-feed-main">
          <div className="waiter-feed-main-row">
            <div className={`waiter-order-table-icon ${group.toLowerCase()} wait-${elapsedTone}`}>
              <img src={tableIcon} alt="" aria-hidden="true" />
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
          {filtered.map((orderGroup) => {
            if (!orderGroup.shared) return renderOrderCard(orderGroup.rows[0]);

            const totalItems = orderGroup.rows.reduce((sum, order) => sum + itemCount(order), 0);
            return (
              <section className="waiter-shared-order-group" key={orderGroup.key}>
                <div className="waiter-shared-order-head">
                  <div className="waiter-shared-order-title">
                    <span className="waiter-shared-order-icon"><Link2 size={18} /></span>
                    <div>
                      <strong>{groupTableLabel(orderGroup)}</strong>
                      <small>{orderGroup.rows.length} đơn · {totalItems} món</small>
                    </div>
                  </div>
                  <span className="waiter-shared-order-badge">Bàn ghép · Thanh toán chung</span>
                </div>
                <div className="waiter-shared-order-list">
                  {orderGroup.rows.map((order) => renderOrderCard(order, true))}
                </div>
              </section>
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
