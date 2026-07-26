import { useEffect, useState } from 'react';
import {
  Ban,
  CalendarDays,
  ChefHat,
  CircleCheckBig,
  ClipboardList,
  Clock3,
  Eye,
  Printer,
  Search,
  XCircle,
} from 'lucide-react';
import { orderApi } from '../../api/orderApi';
import { formatMoney } from '../../utils/formatMoney';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import { imageUrl } from '../../utils/imageUrl';
import { useDebounce } from '../../hooks/useDebounce';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import OrderItemCancellationModal from '../../components/order/OrderItemCancellationModal';
import CancellationRequestsModal from '../../components/order/CancellationRequestsModal';
import {
  canStaffCancelItem,
  cancellationReasonLabel,
  isCancelledItem,
  isPendingCancellation,
  unwrapCancellationRequests,
} from '../../utils/orderCancellation';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'CHO_XAC_NHAN', label: 'Chờ xác nhận' },
  { value: 'DA_XAC_NHAN', label: 'Đã xác nhận' },
  { value: 'DANG_CHUAN_BI', label: 'Đang chuẩn bị' },
  { value: 'DANG_CHE_BIEN', label: 'Đang chế biến' },
  { value: 'SAN_SANG', label: 'Sẵn sàng' },
  { value: 'SAN_SANG_PHUC_VU', label: 'Sẵn sàng phục vụ' },
  { value: 'DA_HOAN_THANH', label: 'Hoàn thành chế biến' },
  { value: 'DA_PHUC_VU', label: 'Đã phục vụ' },
  { value: 'CHO_THANH_TOAN', label: 'Chờ thanh toán' },
  { value: 'SAN_SANG_THANH_TOAN', label: 'Sẵn sàng thanh toán' },
  { value: 'DA_THANH_TOAN', label: 'Đã thanh toán' },
  { value: 'DA_HUY', label: 'Đã hủy' },
];

const ADMIN_CANCELLABLE_STATUSES = new Set([
  'CHO_XAC_NHAN',
  'DA_XAC_NHAN',
  'DANG_CHUAN_BI',
  'DANG_CHE_BIEN',
  'SAN_SANG',
  'SAN_SANG_PHUC_VU',
  'DA_HOAN_THANH',
]);

const DATE_OPTIONS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày qua' },
  { value: 'all', label: 'Tất cả thời gian' },
];

function toApiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateRangeParams(filter) {
  if (filter === 'all') return {};
  const now = new Date();
  const to = toApiDate(now);
  if (filter === 'today') return { from: to, to };
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 6);
  return { from: toApiDate(fromDate), to };
}

function unwrapList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function orderId(row) {
  return row?.maDonHang ?? row?.id;
}

function itemId(item) {
  return item?.maChiTiet ?? item?.maChiTietDonHang ?? item?.id;
}

function tableName(row) {
  return row?.banAn?.tenBan || row?.tenBan || (row?.maBan ? `Bàn ${row.maBan}` : '—');
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusMeta(code) {
  switch (code) {
    case 'CHO_XAC_NHAN':
      return { label: 'Chờ xác nhận', tone: 'pending' };
    case 'DA_XAC_NHAN':
      return { label: 'Đã xác nhận', tone: 'preparing' };
    case 'DANG_CHUAN_BI':
      return { label: 'Đang chuẩn bị', tone: 'preparing' };
    case 'DANG_CHE_BIEN':
      return { label: 'Đang chế biến', tone: 'preparing' };
    case 'SAN_SANG':
    case 'SAN_SANG_PHUC_VU':
    case 'DA_HOAN_THANH':
      return { label: code === 'DA_HOAN_THANH' ? 'Hoàn thành chế biến' : 'Sẵn sàng phục vụ', tone: 'serving' };
    case 'DA_PHUC_VU':
      return { label: 'Đã phục vụ', tone: 'serving' };
    case 'CHO_THANH_TOAN':
      return { label: 'Chờ thanh toán', tone: 'pending' };
    case 'SAN_SANG_THANH_TOAN':
      return { label: 'Sẵn sàng thanh toán', tone: 'pending' };
    case 'DA_THANH_TOAN':
      return { label: 'Đã thanh toán', tone: 'completed' };
    case 'DA_HUY':
      return { label: 'Đã hủy', tone: 'cancelled' };
    default:
      return { label: code || 'Không xác định', tone: 'neutral' };
  }
}

function paymentMeta(row) {
  const raw = row?.trangThaiThanhToan || row?.thanhToan || row?.paymentStatus;
  if (raw === 'DA_THANH_TOAN' || raw === 'PAID' || row?.trangThai === 'DA_THANH_TOAN') {
    return { label: 'Đã thanh toán', tone: 'paid' };
  }
  if (['CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'].includes(row?.trangThai)) {
    return { label: 'Chờ thanh toán', tone: 'unpaid' };
  }
  return { label: 'Chưa thanh toán', tone: 'unpaid' };
}

function canAdminCancel(order) {
  if (!ADMIN_CANCELLABLE_STATUSES.has(order?.trangThai)) return false;
  const items = Array.isArray(order?.chiTietDonHang) ? order.chiTietDonHang : [];
  return !items.some((item) => item?.trangThaiMon === 'DA_PHUC_VU');
}

function isInRange(row, dateFilter) {
  if (dateFilter === 'all') return true;
  const source = row?.thoiGianDat || row?.createdAt || row?.ngayTao;
  if (!source) return dateFilter === 'all';
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  if (dateFilter === 'today') {
    return date.toDateString() === now.toDateString();
  }
  if (dateFilter === '7days') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return date >= start && date <= now;
  }
  return true;
}

function itemImage(item) {
  const src = item?.monAn?.hinhAnh || item?.monAn?.anhMon || item?.hinhAnh || item?.anh;
  return src ? imageUrl(src) : '';
}

function printOrder(order) {
  if (!order) return;
  const popup = window.open('', '_blank', 'width=820,height=900');
  if (!popup) return;
  const items = (order.chiTietDonHang || [])
    .filter((item) => String(item?.trangThaiMon || '').toUpperCase() !== 'DA_HUY')
    .map((item) => `
      <tr>
        <td>${item?.monAn?.tenMonAn || item?.tenMon || 'Món ăn'}</td>
        <td style="text-align:center">${item?.soLuong || 0}</td>
        <td style="text-align:right">${formatMoney(item?.donGia || item?.monAn?.gia || 0)}</td>
        <td style="text-align:right">${formatMoney((item?.donGia || item?.monAn?.gia || 0) * (item?.soLuong || 0))}</td>
      </tr>`)
    .join('');
  popup.document.write(`
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>Hóa đơn ${orderId(order)}</title>
        <style>
          *{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:28px;color:#111827}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:left}th{background:#f8fafc} .meta{display:grid;grid-template-columns:140px 1fr;gap:10px 18px;margin-top:18px}.meta b{font-weight:700}.total{display:flex;justify-content:space-between;margin-top:22px;font-size:20px;font-weight:800}.muted{color:#64748b} @media print{body{padding:0}}
        </style>
      </head>
      <body>
        <h1>LUMORA</h1>
        <div class="muted">Hóa đơn đơn hàng #${orderId(order)}</div>
        <div class="meta">
          <span>Bàn</span><b>${tableName(order)}</b>
          <span>Thời gian</span><b>${formatDateTime(order?.thoiGianDat || order?.createdAt)}</b>
          <span>Trạng thái đơn</span><b>${statusMeta(order?.trangThai).label}</b>
          <span>Thanh toán</span><b>${paymentMeta(order).label}</b>
          <span>Ghi chú</span><b>${order?.ghiChu || 'Không có ghi chú'}</b>
        </div>
        <table>
          <thead>
            <tr><th>Món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
        <div class="total"><span>Tổng tiền</span><span>${formatMoney(order?.tongTien || 0)}</span></div>
        <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script>
      </body>
    </html>
  `);
  popup.document.close();
}

export default function OrderManage() {
  const toast = useToast();
  const socketEvent = useWebSocket(['/topic/orders', '/topic/payments', '/topic/admin/cancellations']);
  const [rows, setRows] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [stats, setStats] = useState({ total: 0, pending: 0, serving: 0, completed: 0 });
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [itemCancelTarget, setItemCancelTarget] = useState(null);
  const [itemCancelLoading, setItemCancelLoading] = useState(false);
  const [cancelRequests, setCancelRequests] = useState([]);
  const [cancelRequestsOpen, setCancelRequestsOpen] = useState(false);
  const [cancelRequestsLoading, setCancelRequestsLoading] = useState(false);
  const [cancelProcessingId, setCancelProcessingId] = useState(null);
  const debouncedKeyword = useDebounce(keyword, 350);

  async function load(preferredId) {
    try {
      const commonParams = {
        keyword: debouncedKeyword.trim() || undefined,
        ...dateRangeParams(dateFilter),
      };
      const response = await orderApi.getPage({
        ...commonParams,
        page,
        size,
        status: statusFilter,
      });
      const result = normalizePage(response, size);
      if (result.totalPages > 0 && page >= result.totalPages) {
        setPage(result.totalPages - 1);
        return;
      }

      const list = result.content;
      setRows(list);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setNumberOfElements(result.numberOfElements);

      if (statusFilter === 'ALL') {
        const [pendingResponse, servingResponse, completedResponse] = await Promise.all([
          orderApi.getPage({ ...commonParams, page: 0, size: 1, status: 'CHO_XAC_NHAN' }),
          orderApi.getPage({ ...commonParams, page: 0, size: 1, status: 'DA_PHUC_VU' }),
          orderApi.getPage({ ...commonParams, page: 0, size: 1, status: 'DA_THANH_TOAN' }),
        ]);
        setStats({
          total: result.totalElements,
          pending: normalizePage(pendingResponse, 1).totalElements,
          serving: normalizePage(servingResponse, 1).totalElements,
          completed: normalizePage(completedResponse, 1).totalElements,
        });
      } else {
        setStats({
          total: result.totalElements,
          pending: statusFilter === 'CHO_XAC_NHAN' ? result.totalElements : 0,
          serving: statusFilter === 'DA_PHUC_VU' ? result.totalElements : 0,
          completed: statusFilter === 'DA_THANH_TOAN' ? result.totalElements : 0,
        });
      }

      const preferredExists = preferredId != null && list.some((item) => String(orderId(item)) === String(preferredId));
      const selectedExists = selectedId != null && list.some((item) => String(orderId(item)) === String(selectedId));
      const fallbackId = preferredExists
        ? preferredId
        : selectedExists
          ? selectedId
          : (list[0] ? orderId(list[0]) : null);
      if (fallbackId != null) {
        setSelectedId(fallbackId);
        loadDetail(fallbackId);
      } else {
        setSelectedId(null);
        setSelectedOrder(null);
      }
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không tải được danh sách đơn hàng'));
    }
  }

  async function loadDetail(id) {
    if (id == null) return;
    try {
      const response = await orderApi.getById(id);
      setSelectedOrder(response?.data || response || null);
    } catch {
      const fallback = rows.find((item) => String(orderId(item)) === String(id));
      setSelectedOrder(fallback || null);
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
    loadCancellationRequests();
  }, []);

  useEffect(() => {
    load();
  }, [page, size, debouncedKeyword, statusFilter, dateFilter]);

  useEffect(() => {
    if (['/topic/orders', '/topic/payments', '/topic/admin/cancellations'].includes(socketEvent?.topic)) {
      load(selectedId);
      loadCancellationRequests();
    }
  }, [socketEvent]);

  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, numberOfElements, totalElements);

  function askCancelOrder(order) {
    setCancelTarget(order);
  }

  function closeCancelModal() {
    if (cancelLoading) return;
    setCancelTarget(null);
  }

  async function confirmCancelOrder() {
    const targetId = orderId(cancelTarget);
    if (targetId == null) return;
    setCancelLoading(true);
    try {
      const response = await orderApi.updateStatus(targetId, { trangThai: 'DA_HUY' });
      toast.success(messageOf(response, 'Hủy đơn hàng thành công'));
      setCancelTarget(null);
      load(targetId);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Hủy đơn hàng thất bại'));
    } finally {
      setCancelLoading(false);
    }
  }

  async function submitItemCancellation(payload) {
    const id = itemId(itemCancelTarget);
    if (!id || itemCancelLoading) return;
    try {
      setItemCancelLoading(true);
      const response = await orderApi.cancelItem(id, payload);
      toast.success(messageOf(response, 'Đã hủy món'));
      setItemCancelTarget(null);
      await Promise.all([load(selectedId), loadCancellationRequests()]);
      if (selectedId) await loadDetail(selectedId);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể hủy món'));
    } finally {
      setItemCancelLoading(false);
    }
  }

  async function processCancellation(request, action, note = '') {
    const id = request?.maChiTiet ?? itemId(request);
    if (!id || cancelProcessingId) return;
    try {
      setCancelProcessingId(id);
      const response = action === 'approve'
        ? await orderApi.approveCancellation(id, { ghiChu: note.trim() || null })
        : await orderApi.rejectCancellation(id, { ghiChu: note.trim() || null });
      toast.success(messageOf(response, action === 'approve' ? 'Đã duyệt hủy món' : 'Đã từ chối yêu cầu hủy'));
      await Promise.all([load(selectedId), loadCancellationRequests()]);
      if (selectedId) await loadDetail(selectedId);
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

  const detail = selectedOrder || rows.find((row) => String(orderId(row)) === String(selectedId)) || null;
  const detailStatus = statusMeta(detail?.trangThai);
  const detailPayment = paymentMeta(detail);

  return (
    <section className="order-admin-page">
      <div className="order-admin-toolbar">
        <label className="order-admin-search">
          <Search size={20} />
          <input
            placeholder="Tìm kiếm mã đơn, bàn..."
            value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setPage(0); }}
          />
        </label>

        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        <label className="order-admin-date-filter">
          <CalendarDays size={18} />
          <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(0); }}>
            {DATE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <button type="button" className={`order-admin-cancel-requests ${cancelRequests.length ? 'has-items' : ''}`} onClick={openCancellationRequests}>
          <Ban size={17} /> Yêu cầu hủy <span>{cancelRequests.length}</span>
        </button>
      </div>

      <div className="order-admin-stats">
        <article className="order-admin-stat-card">
          <div className="icon total"><ClipboardList size={24} /></div>
          <div>
            <span>Tổng đơn</span>
            <strong>{stats.total}</strong>
            <small>Đơn hôm nay</small>
          </div>
        </article>

        <article className="order-admin-stat-card">
          <div className="icon pending"><Clock3 size={24} /></div>
          <div>
            <span>Chờ xác nhận</span>
            <strong>{stats.pending}</strong>
            <small>Đơn chờ xử lý</small>
          </div>
        </article>

        <article className="order-admin-stat-card">
          <div className="icon serving"><ChefHat size={24} /></div>
          <div>
            <span>Đã phục vụ</span>
            <strong>{stats.serving}</strong>
            <small>Đơn đã mang ra bàn</small>
          </div>
        </article>

        <article className="order-admin-stat-card">
          <div className="icon completed"><CircleCheckBig size={24} /></div>
          <div>
            <span>Đã thanh toán</span>
            <strong>{stats.completed}</strong>
            <small>Đơn đã kết thúc</small>
          </div>
        </article>
      </div>

      <div className="order-admin-layout">
        <div className="order-admin-table-card">
          <div className="order-admin-section-head">
            <h3>Danh sách đơn hàng</h3>
          </div>

          <div className="order-admin-table-wrap">
            <table className="order-admin-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Bàn</th>
                  <th>Thời gian</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = statusMeta(row?.trangThai);
                  const payment = paymentMeta(row);
                  const isActive = String(orderId(row)) === String(selectedId);
                  return (
                    <tr
                      key={orderId(row)}
                      className={isActive ? 'active' : ''}
                      onClick={() => {
                        setSelectedId(orderId(row));
                        loadDetail(orderId(row));
                      }}
                    >
                      <td><strong>DH{orderId(row)}</strong></td>
                      <td>{tableName(row)}</td>
                      <td>{formatTime(row?.thoiGianDat || row?.createdAt)}</td>
                      <td>{formatMoney(row?.tongTien || 0)}</td>
                      <td>
                        <span className={`order-admin-badge ${status.tone}`}>{status.label}</span>
                      </td>
                      <td>
                        <span className={`order-admin-badge payment ${payment.tone}`}>{payment.label}</span>
                      </td>
                      <td>
                        <div className="order-admin-actions" onClick={(event) => event.stopPropagation()}>
                          <button type="button" title="Xem chi tiết" onClick={() => { setSelectedId(orderId(row)); loadDetail(orderId(row)); }}>
                            <Eye size={17} />
                          </button>
                          <button
                            type="button"
                            className="danger"
                            title="Hủy đơn"
                            onClick={() => askCancelOrder(row)}
                            disabled={!canAdminCancel(row)}
                          >
                            <XCircle size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="order-admin-empty">Không có đơn hàng phù hợp</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="order-admin-footer">
            <span>Hiển thị {displayRange.from} đến {displayRange.to} của {totalElements} đơn hàng</span>
            <div className="order-admin-pagination">
              <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>‹</button>
              {pageItems.map((item) => (
                <button type="button" key={item} className={item === page ? 'current' : ''} onClick={() => setPage(item)}>{item + 1}</button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={totalPages === 0 || page >= totalPages - 1}>›</button>
            </div>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
              <option value="10">10 / trang</option>
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
            </select>
          </div>
        </div>

        <aside className="order-admin-detail-card">
          <div className="order-admin-section-head detail">
            <h3>Chi tiết đơn hàng</h3>
          </div>

          {detail ? (
            <>
              <div className="order-admin-detail-meta">
                <span>Mã đơn</span>
                <strong>DH{orderId(detail)}</strong>
                <span>Bàn</span>
                <strong>{tableName(detail)}</strong>
                <span>Thời gian</span>
                <strong>{formatDateTime(detail?.thoiGianDat || detail?.createdAt)}</strong>
              </div>

              <div className="order-admin-detail-items">
                <h4>Món đã gọi</h4>
                {(detail?.chiTietDonHang || []).map((item) => {
                  const pendingCancellation = isPendingCancellation(item);
                  const cancelled = isCancelledItem(item);
                  const processing = String(cancelProcessingId) === String(itemId(item));
                  return (
                    <div key={itemId(item) || `${item?.monAn?.tenMonAn}-${item?.soLuong}`} className={`order-admin-detail-item ${cancelled ? 'cancelled' : ''}`}>
                      {itemImage(item)
                        ? <img src={itemImage(item)} alt={item?.monAn?.tenMonAn || 'Món ăn'} />
                        : <div className="placeholder">🍽</div>}
                      <span className="qty">{item?.soLuong || 0}</span>
                      <div className="info">
                        <b>{item?.monAn?.tenMonAn || item?.tenMon || 'Món ăn'}</b>
                        <small className={`order-admin-item-status ${cancelled ? 'cancelled' : pendingCancellation ? 'pending' : ''}`}>
                          {cancelled ? 'Đã hủy' : pendingCancellation ? 'Chờ duyệt hủy' : item?.trangThaiMon || 'Chờ xử lý'}
                        </small>
                        {(pendingCancellation || cancelled) ? <em>{item?.lyDoHuy || cancellationReasonLabel(item?.maLyDoHuy)}{item?.ghiChuHuy ? ` · ${item.ghiChuHuy}` : ''}</em> : null}
                        <div className="order-admin-item-actions">
                          {pendingCancellation ? (
                            <>
                              <button type="button" className="approve" disabled={Boolean(cancelProcessingId)} onClick={() => processCancellation(item, 'approve')}>{processing ? 'Đang xử lý...' : 'Duyệt hủy'}</button>
                              <button type="button" className="reject" disabled={Boolean(cancelProcessingId)} onClick={() => processCancellation(item, 'reject')}>Từ chối</button>
                            </>
                          ) : canStaffCancelItem(item) ? (
                            <button type="button" className="cancel" onClick={() => setItemCancelTarget(item)}><Ban size={13} /> Hủy món</button>
                          ) : null}
                        </div>
                      </div>
                      <strong>{cancelled ? 'Không tính tiền' : formatMoney((item?.donGia || item?.monAn?.gia || 0) * (item?.soLuong || 0))}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="order-admin-detail-summary">
                <div>
                  <span>Tổng tiền</span>
                  <strong>{formatMoney(detail?.tongTien || 0)}</strong>
                </div>
                <div>
                  <span>Ghi chú</span>
                  <strong>{detail?.ghiChu || 'Không có ghi chú'}</strong>
                </div>
                <div>
                  <span>Trạng thái đơn</span>
                  <b className={`order-admin-badge ${detailStatus.tone}`}>{detailStatus.label}</b>
                </div>
                <div>
                  <span>Thanh toán</span>
                  <b className={`order-admin-badge payment ${detailPayment.tone}`}>{detailPayment.label}</b>
                </div>
              </div>

              <div className="order-admin-detail-actions">
                <button type="button" onClick={() => printOrder(detail)}>
                  <Printer size={18} /> In hóa đơn
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={!canAdminCancel(detail)}
                  onClick={() => askCancelOrder(detail)}
                >
                  <XCircle size={18} /> Hủy đơn
                </button>
              </div>
            </>
          ) : (
            <div className="order-admin-empty detail">Chọn một đơn hàng để xem chi tiết</div>
          )}
        </aside>
      </div>
      <ConfirmActionModal
        open={Boolean(cancelTarget)}
        onClose={closeCancelModal}
        onConfirm={confirmCancelOrder}
        loading={cancelLoading}
        title="Xác nhận hủy đơn hàng"
        description="Bạn có chắc chắn muốn hủy đơn hàng này không?"
        itemName={cancelTarget ? `#DH${orderId(cancelTarget)}` : ''}
        warning="Đơn hàng sẽ được chuyển sang trạng thái đã hủy. Hành động này có thể ảnh hưởng đến quy trình phục vụ và thanh toán."
        confirmText="Hủy đơn hàng"
      />

      <OrderItemCancellationModal
        open={Boolean(itemCancelTarget)}
        item={itemCancelTarget}
        loading={itemCancelLoading}
        actor="admin"
        onClose={() => !itemCancelLoading && setItemCancelTarget(null)}
        onSubmit={submitItemCancellation}
      />

      <CancellationRequestsModal
        open={cancelRequestsOpen}
        requests={cancelRequests}
        loading={cancelRequestsLoading}
        processingId={cancelProcessingId}
        isAdmin
        onClose={() => !cancelProcessingId && setCancelRequestsOpen(false)}
        onApprove={(request, note) => processCancellation(request, 'approve', note)}
        onReject={(request, note) => processCancellation(request, 'reject', note)}
      />
    </section>
  );
}
