import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deliveryApi } from '../../api/deliveryApi';
import { orderApi } from '../../api/orderApi';
import OrderItemCancellationModal from '../../components/order/OrderItemCancellationModal';
import { useAuth } from '../../hooks/useAuth';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  DELIVERY_ORDER_STATUSES,
  deliveryAreaLabel,
  deliveryData,
  deliveryOrderId,
  deliveryPaymentLabel,
  deliveryStatusClass,
  deliveryStatusLabel,
  displayOrderCode,
  isDeliveryFinished,
  unwrapDeliveryList,
  unwrapDeliveryResponse,
} from '../../utils/delivery';
import { formatDate } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { formatDistanceMeters, formatDurationSeconds } from '../../utils/mapUtils';

function currentRole(user) {
  return String(user?.role || user?.tenVaiTro || user?.vaiTro?.tenVaiTro || '')
    .replace('ROLE_', '')
    .toUpperCase();
}

function initialActionForm() {
  return {
    transactionCode: '',
    paymentNote: '',
    reason: '',
    handoverNote: '',
    refundTransactionCode: '',
    refundNote: '',
  };
}

function foodName(item) {
  return item?.monAn?.tenMonAn || item?.tenMonAn || 'Món ăn';
}

function foodId(item) {
  return item?.monAn?.maMonAn ?? item?.maMonAn ?? foodName(item);
}

function groupItems(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = `${foodId(item)}::${String(item?.ghiChu || '').trim()}::${Number(item?.donGia || 0)}`;
    const row = grouped.get(key) || {
      key,
      tenMonAn: foodName(item),
      donGia: Number(item?.donGia || 0),
      quantity: 0,
      statuses: {},
      note: item?.ghiChu || '',
      items: [],
    };
    const quantity = Number(item?.soLuong || 1);
    row.quantity += quantity;
    const status = String(item?.trangThaiMon || 'CHO_BEP').toUpperCase();
    row.statuses[status] = (row.statuses[status] || 0) + quantity;
    row.items.push(item);
    grouped.set(key, row);
  });
  return [...grouped.values()];
}

function itemProgressLabel(statuses) {
  return Object.entries(statuses || {})
    .map(([status, count]) => `${deliveryStatusLabel(status)}: ${count}`)
    .join(' · ');
}

function selectedStatus(order) {
  return String(deliveryData(order)?.trangThaiGiaoHang || '').toUpperCase();
}

const CASHIER_ACTION_STATUSES = new Set([
  'CHO_THANH_TOAN',
  'CHO_XAC_NHAN',
  'CHO_TAI_XE_NHAN',
  'CHO_BAN_GIAO',
  'CHO_KHACH_NHAN',
  'CHO_DOI_SOAT',
  'GIAO_THAT_BAI',
]);

const DELIVERY_PAGE_SIZE = 10;

function orderPlacedAt(order) {
  const value = new Date(order?.thoiGianDat || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function cashierSortGroup(order) {
  const status = selectedStatus(order);
  if (CASHIER_ACTION_STATUSES.has(status)) return 0;
  if (isDeliveryFinished(status)) return 2;
  return 1;
}

function compareCashierOrders(a, b) {
  const groupA = cashierSortGroup(a);
  const groupB = cashierSortGroup(b);
  if (groupA !== groupB) return groupA - groupB;

  const timeA = orderPlacedAt(a);
  const timeB = orderPlacedAt(b);
  // Đơn đang cần xử lý: đơn chờ lâu hơn lên trước. Đơn đã kết thúc: mới nhất lên trước.
  return groupA === 2 ? timeB - timeA : timeA - timeB;
}

export default function DeliveryOrderManage() {
  const { user } = useAuth();
  const role = currentRole(user);
  const canManage = ['ADMIN', 'CASHIER'].includes(role);
  const toast = useToast();
  const socketEvent = useWebSocket(['/topic/delivery-orders', '/topic/cashier/delivery-orders']);
  const [status, setStatus] = useState(() => (role === 'CASHIER' ? 'DANG_XU_LY' : 'ALL'));
  const [keyword, setKeyword] = useState('');
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialActionForm);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await deliveryApi.list(status === 'DANG_XU_LY' ? 'ALL' : status);
      setOrders(unwrapDeliveryList(response));
    } catch (requestError) {
      const message = errorMessageOf(requestError, 'Không thể tải danh sách đơn đặt online.');
      setError(message);
      if (silent) toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status, toast]);

  const openDetail = useCallback(async (id, { silent = false } = {}) => {
    if (!silent) setDetailLoading(true);
    try {
      const response = await deliveryApi.detail(id);
      setSelected(unwrapDeliveryResponse(response));
      if (!silent) setForm(initialActionForm());
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Không thể tải chi tiết đơn đặt online.'));
    } finally {
      if (!silent) setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!socketEvent) return;
    loadOrders({ silent: true });
    const eventOrderId = socketEvent?.body?.data?.maDonHang
      ?? socketEvent?.body?.maDonHang
      ?? socketEvent?.data?.maDonHang;
    if (selected && Number(eventOrderId) === Number(deliveryOrderId(selected))) {
      openDetail(deliveryOrderId(selected), { silent: true });
    }
  }, [socketEvent]);

  const visibleOrders = useMemo(() => {
    if (status !== 'DANG_XU_LY') return orders;
    return orders.filter((order) => !isDeliveryFinished(selectedStatus(order)));
  }, [orders, status]);

  const filteredOrders = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    const matched = !query ? visibleOrders : visibleOrders.filter((order) => {
      const delivery = deliveryData(order);
      return [
        displayOrderCode(order),
        delivery.maVanChuyen,
        delivery.tenNguoiNhan,
        delivery.soDienThoaiNhan,
        delivery.diaChiGiaoHang,
        delivery.donViVanChuyen,
        delivery.tenNguoiGiao,
      ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query));
    });
    return [...matched].sort(compareCashierOrders);
  }, [keyword, visibleOrders]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / DELIVERY_PAGE_SIZE));
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * DELIVERY_PAGE_SIZE;
    return filteredOrders.slice(start, start + DELIVERY_PAGE_SIZE);
  }, [currentPage, filteredOrders]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return [...pages]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, status]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const counters = useMemo(() => ({
    total: visibleOrders.length,
    pending: visibleOrders.filter((item) => ['CHO_THANH_TOAN', 'CHO_XAC_NHAN'].includes(selectedStatus(item))).length,
    preparing: visibleOrders.filter((item) => ['CHO_DEN_GIO', 'DANG_CHUAN_BI'].includes(selectedStatus(item))).length,
    delivery: visibleOrders.filter((item) => ['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'CHO_KHACH_NHAN', 'DANG_GIAO', 'CHO_DOI_SOAT'].includes(selectedStatus(item))).length,
  }), [visibleOrders]);

  async function runAction(key, action, successMessage) {
    if (!selected) return;
    setActionLoading(key);
    try {
      const response = await action();
      const value = unwrapDeliveryResponse(response);
      setSelected(value);
      setForm(initialActionForm());
      toast.success(messageOf(response, successMessage));
      await loadOrders({ silent: true });
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Thao tác đơn đặt online thất bại.'));
    } finally {
      setActionLoading('');
    }
  }

  async function cancelDeliveryItem(payload) {
    if (!cancelTarget || !selected) return;
    const itemId = cancelTarget?.maChiTiet ?? cancelTarget?.maChiTietDonHang ?? cancelTarget?.id;
    if (itemId == null) {
      toast.error('Không xác định được mã món cần hủy.');
      return;
    }
    setCancelLoading(true);
    try {
      const response = await orderApi.cancelItem(itemId, payload);
      toast.success(messageOf(response, 'Đã hủy món và tính lại đơn đặt online.'));
      setCancelTarget(null);
      await openDetail(deliveryOrderId(selected), { silent: true });
      await loadOrders({ silent: true });
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Không thể hủy món giao hàng.'));
    } finally {
      setCancelLoading(false);
    }
  }

  const selectedDelivery = deliveryData(selected);
  const selectedItems = groupItems(selected?.chiTietDonHang || selected?.items || []);
  const currentStatus = selectedStatus(selected);
  const paymentStatus = String(selectedDelivery?.trangThaiThanhToan || '').toUpperCase();
  const isVietQr = String(selectedDelivery?.phuongThucThanhToan || '').toUpperCase() === 'VIETQR';
  const isCod = String(selectedDelivery?.phuongThucThanhToan || '').toUpperCase() === 'COD';
  const canAdminCancelDeliveryItem = role === 'ADMIN' && ['CHO_THANH_TOAN', 'CHO_XAC_NHAN', 'CHO_DEN_GIO', 'DANG_CHUAN_BI'].includes(currentStatus);

  return (
    <section className="delivery-manage-page">
      <div className="delivery-manage-summary">
        <article><span><ShoppingBag size={22} /></span><div><small>Tổng đơn hiển thị</small><strong>{counters.total}</strong></div></article>
        <article><span><Clock3 size={22} /></span><div><small>Chờ xử lý/xác nhận</small><strong>{counters.pending}</strong></div></article>
        <article><span><PackageCheck size={22} /></span><div><small>Đang chuẩn bị</small><strong>{counters.preparing}</strong></div></article>
        <article><span><Truck size={22} /></span><div><small>Chờ/giao hàng</small><strong>{counters.delivery}</strong></div></article>
      </div>

      <div className="delivery-manage-toolbar">
        <label><Search size={19} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã đơn, mã vận đơn, khách nhận..." /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="DANG_XU_LY">Đang xử lý</option>
          {DELIVERY_ORDER_STATUSES.map((item) => <option key={item} value={item}>{deliveryStatusLabel(item)}</option>)}
        </select>
        <button type="button" onClick={() => loadOrders()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={18} /> Làm mới</button>
      </div>

      <div className="delivery-manage-table-card">
        {loading ? <div className="delivery-manage-state"><LoaderCircle className="spin" size={31} /><strong>Đang tải đơn đặt online...</strong></div> : null}
        {!loading && error ? <div className="delivery-manage-state error"><AlertTriangle size={31} /><strong>{error}</strong><button type="button" onClick={() => loadOrders()}>Thử lại</button></div> : null}
        {!loading && !error ? (
          <>
          <div className="delivery-manage-table-wrap">
            <table className="delivery-manage-table">
              <thead><tr><th>Mã đơn</th><th>Khách nhận</th><th>Địa chỉ</th><th>Thanh toán</th><th>Tổng tiền</th><th>Trạng thái</th><th>Mã vận đơn</th><th></th></tr></thead>
              <tbody>
                {!filteredOrders.length ? <tr><td colSpan="8"><div className="delivery-table-empty">Không có đơn đặt online phù hợp.</div></td></tr> : null}
                {pagedOrders.map((order) => {
                  const delivery = deliveryData(order);
                  const deliveryStatus = delivery.trangThaiGiaoHang;
                  return (
                    <tr key={deliveryOrderId(order)}>
                      <td><strong className="delivery-code">{displayOrderCode(order)}</strong><small>{formatDate(order.thoiGianDat)}</small></td>
                      <td><strong>{delivery.tenNguoiNhan}</strong><small>{delivery.soDienThoaiNhan}</small></td>
                      <td className="delivery-address-cell"><span>{delivery.diaChiGiaoHang}</span><small>{deliveryAreaLabel(delivery.khuVucGiaoHang)}</small></td>
                      <td><span className={`delivery-payment-badge ${deliveryStatusClass(delivery.trangThaiThanhToan)}`}>{String(delivery.phuongThucThanhToan || '').toUpperCase() === 'COD' && selectedStatus(order) === 'CHO_DOI_SOAT' ? 'Chờ đối soát COD' : deliveryPaymentLabel(delivery.trangThaiThanhToan)}</span><small>{delivery.phuongThucThanhToan}</small></td>
                      <td><strong>{formatMoney(order.tongTien)}</strong></td>
                      <td><span className={`delivery-order-badge ${deliveryStatusClass(deliveryStatus)}`}>{deliveryStatusLabel(deliveryStatus)}</span></td>
                      <td><span>{delivery.maVanChuyen || 'Chưa tạo'}</span></td>
                      <td><button className="delivery-view-button" type="button" onClick={() => openDetail(deliveryOrderId(order))}><Eye size={17} /> Xem</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length ? (
            <div className="delivery-manage-pagination">
              <span>
                Hiển thị {(currentPage - 1) * DELIVERY_PAGE_SIZE + 1}–{Math.min(currentPage * DELIVERY_PAGE_SIZE, filteredOrders.length)} / {filteredOrders.length} đơn
              </span>
              <div className="delivery-manage-pagination-controls">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>‹ Trước</button>
                {paginationPages.map((page, index) => {
                  const previousPage = paginationPages[index - 1];
                  return (
                    <span key={page} className="delivery-manage-page-item">
                      {previousPage && page - previousPage > 1 ? <i>…</i> : null}
                      <button
                        type="button"
                        className={page === currentPage ? 'active' : ''}
                        onClick={() => setCurrentPage(page)}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Sau ›</button>
              </div>
            </div>
          ) : null}
          </>
        ) : null}
      </div>

      {selected || detailLoading ? (
        <div className="delivery-detail-backdrop" role="dialog" aria-modal="true">
          <div className="delivery-detail-modal">
            {detailLoading && !selected ? <div className="delivery-manage-state"><LoaderCircle className="spin" size={32} /><strong>Đang tải chi tiết...</strong></div> : null}
            {selected ? (
              <>
                <div className="delivery-detail-head">
                  <div><span>ĐƠN ĐẶT ONLINE</span><h2>{displayOrderCode(selected)}</h2><p>Đặt lúc {formatDate(selected.thoiGianDat)}</p></div>
                  <div className={`delivery-order-badge ${deliveryStatusClass(currentStatus)}`}>{deliveryStatusLabel(currentStatus)}</div>
                  <button type="button" onClick={() => setSelected(null)} aria-label="Đóng"><X size={21} /></button>
                </div>

                <div className="delivery-detail-body">
                  <div className="delivery-detail-column">
                    <section className="delivery-detail-section">
                      <h3><UserRound size={19} /> Thông tin nhận hàng</h3>
                      <div className="delivery-detail-info-grid">
                        <p><small>Người nhận</small><strong>{selectedDelivery.tenNguoiNhan}</strong></p>
                        <p><small>Số điện thoại</small><strong>{selectedDelivery.soDienThoaiNhan}</strong></p>
                        {selectedDelivery.emailNguoiNhan ? <p className="wide"><small>Email</small><strong>{selectedDelivery.emailNguoiNhan}</strong></p> : null}
                        <p className="wide"><small>Địa chỉ</small><strong>{selectedDelivery.diaChiGiaoHang}</strong></p>
                        <p><small>Thời gian nhận</small><strong>{selectedDelivery.loaiThoiGianNhan === 'HEN_GIO' && selectedDelivery.thoiGianNhanMongMuon ? formatDate(selectedDelivery.thoiGianNhanMongMuon) : 'Giao sớm nhất'}</strong></p>
                        <p><small>Khu vực</small><strong>{deliveryAreaLabel(selectedDelivery.khuVucGiaoHang)}</strong></p>
                        <p><small>Phí giao</small><strong>{formatMoney(selectedDelivery.phiGiaoHang)}</strong></p>
                        {selectedDelivery.quangDuongMet ? <p><small>Quãng đường giao hàng</small><strong>{formatDistanceMeters(selectedDelivery.quangDuongMet)}</strong></p> : null}
                        {selectedDelivery.thoiGianDuKienGiay ? <p><small>Thời gian dự kiến</small><strong>{formatDurationSeconds(selectedDelivery.thoiGianDuKienGiay)}</strong></p> : null}
                        {selectedDelivery.ghiChuGiaoHang ? <p className="wide"><small>Ghi chú giao hàng</small><strong>{selectedDelivery.ghiChuGiaoHang}</strong></p> : null}
                        {selected?.ghiChu ? <p className="wide"><small>Ghi chú đơn</small><strong>{selected.ghiChu}</strong></p> : null}
                      </div>
                    </section>

                    <section className="delivery-detail-section">
                      <h3><ShoppingBag size={19} /> Danh sách món</h3>
                      <div className="delivery-detail-items">
                        {selectedItems.map((item) => {
                          const cancellable = item.items?.find((entry) => !['DA_HUY', 'DA_HOAN_THANH', 'DA_PHUC_VU'].includes(String(entry?.trangThaiMon || '').toUpperCase()));
                          return (
                            <div key={item.key}>
                              <span>{item.quantity}×</span>
                              <div><strong>{item.tenMonAn}</strong><small>{itemProgressLabel(item.statuses)}</small>{item.note ? <em>{item.note}</em> : null}</div>
                              <b>{formatMoney(item.donGia * item.quantity)}</b>
                              {canAdminCancelDeliveryItem && cancellable ? <button type="button" className="delivery-item-cancel-button" onClick={() => setCancelTarget(cancellable)}><XCircle size={15} /> Hủy 1 suất</button> : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {selectedDelivery.maVanChuyen ? (
                      <section className="delivery-detail-section">
                        <h3><Truck size={19} /> Vận chuyển</h3>
                        <div className="delivery-detail-info-grid">
                          <p><small>Mã vận đơn đối tác</small><strong>{selectedDelivery.maVanChuyen}</strong></p>
                          <p><small>Đơn vị vận chuyển</small><strong>{selectedDelivery.donViVanChuyen || 'Đang chờ điều phối'}</strong></p>
                          <p><small>Tài xế được điều phối</small><strong>{selectedDelivery.tenNguoiGiao || 'Đang chờ điều phối'}</strong></p>
                          <p><small>Số điện thoại tài xế</small><strong>{selectedDelivery.soDienThoaiNguoiGiao || '—'}</strong></p>
                          {selectedDelivery.ghiChuBanGiao ? <p className="wide"><small>Ghi chú bàn giao</small><strong>{selectedDelivery.ghiChuBanGiao}</strong></p> : null}
                          {selectedDelivery.trangThaiDoiTac ? <p><small>Đối tác báo</small><strong>{deliveryStatusLabel(selectedDelivery.trangThaiDoiTac)}</strong></p> : null}
                          {selectedDelivery.lyDoDoiTac ? <p className="wide"><small>Phản hồi đối tác</small><strong>{selectedDelivery.lyDoDoiTac}</strong></p> : null}
                          {selectedDelivery.lyDoGiaoThatBai ? <p className="wide"><small>Lý do giao thất bại</small><strong>{selectedDelivery.lyDoGiaoThatBai}</strong></p> : null}
                        </div>
                      </section>
                    ) : null}
                  </div>

                  <aside className="delivery-detail-side">
                    <section className="delivery-detail-section">
                      <h3><CreditCard size={19} /> Thanh toán</h3>
                      <p className="delivery-detail-payment-line"><span>{selectedDelivery.phuongThucThanhToan}</span><b className={deliveryStatusClass(selectedDelivery.trangThaiThanhToan)}>{isCod && currentStatus === 'CHO_DOI_SOAT' ? 'Chờ đối soát COD' : deliveryPaymentLabel(selectedDelivery.trangThaiThanhToan)}</b></p>
                      <div className="delivery-detail-money"><p><span>Tạm tính</span><strong>{formatMoney(selected.tamTinh)}</strong></p><p><span>Giảm giá</span><strong>-{formatMoney(selected.tienGiam)}</strong></p><p><span>Phí giao hàng</span><strong>{formatMoney(selectedDelivery.phiGiaoHang)}</strong></p>{Number(selectedDelivery.soTienDaHoan || 0) > 0 ? <p><span>Đã hoàn khách</span><strong>{formatMoney(selectedDelivery.soTienDaHoan)}</strong></p> : null}{Number(selectedDelivery.soTienCanHoan || 0) > 0 ? <p><span>Cần hoàn thêm</span><strong>{formatMoney(selectedDelivery.soTienCanHoan)}</strong></p> : null}<div><span>Tổng cộng</span><strong>{formatMoney(selected.tongTien)}</strong></div></div>
                    </section>

                    {canManage ? (
                      <section className="delivery-detail-section delivery-actions-panel">
                        <h3>Thao tác nghiệp vụ</h3>

                        {isVietQr && currentStatus === 'CHO_THANH_TOAN' && paymentStatus === 'CHO_THANH_TOAN' ? (
                          <div className="delivery-action-block"><label>Mã giao dịch VietQR *<input value={form.transactionCode} onChange={(event) => setForm((current) => ({ ...current, transactionCode: event.target.value }))} maxLength={100} placeholder="Ví dụ: MB202608060001" /></label><label>Ghi chú xác nhận<input value={form.paymentNote} onChange={(event) => setForm((current) => ({ ...current, paymentNote: event.target.value }))} maxLength={500} placeholder="Đã kiểm tra tài khoản" /></label><small>Sau khi ghi nhận thanh toán, đơn chuyển sang bước chờ nhà hàng xác nhận. Bếp chưa nhận món ở bước này.</small><button type="button" disabled={Boolean(actionLoading) || !form.transactionCode.trim()} onClick={() => runAction('payment', () => deliveryApi.confirmVietQr(deliveryOrderId(selected), { maGiaoDich: form.transactionCode.trim(), ghiChu: form.paymentNote.trim() || null }), 'Đã ghi nhận VietQR; đơn đang chờ nhà hàng xác nhận')}><Banknote size={17} />{actionLoading === 'payment' ? 'Đang xử lý...' : 'Ghi nhận đã nhận tiền'}</button></div>
                        ) : null}

                        {currentStatus === 'CHO_XAC_NHAN' ? (
                          <div className="delivery-action-block">
                            <strong>Đơn đang chờ nhà hàng xác nhận</strong>
                            <small>Kiểm tra thông tin người nhận, địa chỉ, món và thanh toán trước khi chuyển đơn sang bếp.</small>
                            <button className="success" type="button" disabled={Boolean(actionLoading)} onClick={() => runAction('confirm-order', () => deliveryApi.confirm(deliveryOrderId(selected)), 'Đã xác nhận đơn đặt online')}><CheckCircle2 size={17} />{actionLoading === 'confirm-order' ? 'Đang xác nhận...' : 'Xác nhận đơn'}</button>
                            <label>Lý do từ chối<textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={500} placeholder="Ví dụ: Món tạm hết hoặc nhà hàng không thể phục vụ đơn này..." /></label>
                            <button className="danger" type="button" disabled={Boolean(actionLoading) || !form.reason.trim()} onClick={() => runAction('reject-order', () => deliveryApi.reject(deliveryOrderId(selected), { lyDo: form.reason.trim() }), 'Đã từ chối đơn đặt online')}><XCircle size={17} />{actionLoading === 'reject-order' ? 'Đang từ chối...' : 'Từ chối đơn'}</button>
                          </div>
                        ) : null}

                        {currentStatus === 'CHO_DEN_GIO' ? (
                          <div className="delivery-action-block"><strong>Đơn hẹn giờ đã được xác nhận</strong><small>Hệ thống sẽ tự chuyển đơn xuống bếp vào thời điểm phù hợp để kịp thời gian nhận mà khách đã chọn.</small></div>
                        ) : null}

                        {paymentStatus === 'CHO_HOAN_TIEN' && Number(selectedDelivery.soTienCanHoan || 0) > 0 ? (
                          <div className="delivery-action-block danger"><strong>Cần hoàn khách: {formatMoney(selectedDelivery.soTienCanHoan)}</strong><label>Mã giao dịch hoàn tiền *<input value={form.refundTransactionCode} onChange={(event) => setForm((current) => ({ ...current, refundTransactionCode: event.target.value }))} maxLength={100} placeholder="Ví dụ: REFUND20260809001" /></label><label>Ghi chú hoàn tiền<input value={form.refundNote} onChange={(event) => setForm((current) => ({ ...current, refundNote: event.target.value }))} maxLength={500} placeholder="Hoàn do hủy món/đơn" /></label><button type="button" disabled={Boolean(actionLoading) || !form.refundTransactionCode.trim()} onClick={() => runAction('refund', () => deliveryApi.confirmRefund(deliveryOrderId(selected), { maGiaoDich: form.refundTransactionCode.trim(), ghiChu: form.refundNote.trim() || null }), 'Đã ghi nhận hoàn tiền cho khách')}><Banknote size={17} />{actionLoading === 'refund' ? 'Đang xử lý...' : 'Xác nhận đã hoàn tiền'}</button></div>
                        ) : null}

                        {['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO'].includes(currentStatus) ? (
                          <div className="delivery-action-block">
                            <div className="delivery-assignment-card"><span><Truck size={21} /></span><div><strong>{selectedDelivery.donViVanChuyen || 'Đối tác vận chuyển đang điều phối'}</strong><small>{selectedDelivery.maVanChuyen ? `Mã vận đơn: ${selectedDelivery.maVanChuyen}` : 'Đang chờ cấp mã vận đơn'}</small><small>{selectedDelivery.tenNguoiGiao ? `Tài xế: ${selectedDelivery.tenNguoiGiao}${selectedDelivery.soDienThoaiNguoiGiao ? ` · ${selectedDelivery.soDienThoaiNguoiGiao}` : ''}` : 'Đang chờ thông tin tài xế'}</small></div></div>
                            <label>Ghi chú bàn giao<textarea value={form.handoverNote} onChange={(event) => setForm((current) => ({ ...current, handoverNote: event.target.value }))} maxLength={500} placeholder="Ví dụ: Đã bàn giao đủ món và đồ uống" /></label>
                            <small>Hệ thống điều phối tài xế theo thời điểm món dự kiến sẵn sàng; chỉ bàn giao khi toàn bộ món đã hoàn tất.</small>
                            <button type="button" disabled={Boolean(actionLoading) || !selectedDelivery.maVanChuyen || !selectedDelivery.tenNguoiGiao || paymentStatus === 'CHO_HOAN_TIEN'} onClick={() => runAction('handover', () => deliveryApi.handover(deliveryOrderId(selected), { ghiChuBanGiao: form.handoverNote.trim() || null }), 'Đã bàn giao đơn cho tài xế')}><Truck size={17} />{actionLoading === 'handover' ? 'Đang xử lý...' : 'Bàn giao cho tài xế'}</button>
                          </div>
                        ) : null}

                        {currentStatus === 'CHO_KHACH_NHAN' ? (
                          <div className="delivery-action-block"><strong>Đơn đã sẵn sàng để khách đến lấy</strong><small>Toàn bộ món đã hoàn thành. Xác nhận khi khách đã nhận đủ món tại nhà hàng.</small><button className="success" type="button" disabled={Boolean(actionLoading) || paymentStatus === 'CHO_HOAN_TIEN'} onClick={() => runAction('pickup-complete', () => deliveryApi.complete(deliveryOrderId(selected)), 'Đã xác nhận khách nhận món tại nhà hàng')}><CheckCircle2 size={17} />{actionLoading === 'pickup-complete' ? 'Đang xử lý...' : 'Xác nhận khách đã nhận'}</button></div>
                        ) : null}

                        {currentStatus === 'DANG_GIAO' ? (
                          <div className="delivery-action-block"><strong>Đối tác vận chuyển đang giao</strong><small>Trạng thái thật sẽ đi vào webhook. Hai nút dưới đây chỉ mô phỏng callback của đối tác để trình diễn đồ án.</small><button className="success" type="button" disabled={Boolean(actionLoading)} onClick={() => runAction('provider-success', () => deliveryApi.simulateProviderResult(deliveryOrderId(selected), { trangThai: 'GIAO_THANH_CONG', lyDo: null }), 'Đối tác đã báo giao thành công')}><CheckCircle2 size={17} />{actionLoading === 'provider-success' ? 'Đang mô phỏng...' : 'Demo webhook: giao thành công'}</button><label>Lý do giao thất bại<textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={500} placeholder="Không liên lạc được với người nhận..." /></label><button className="danger" type="button" disabled={Boolean(actionLoading) || !form.reason.trim()} onClick={() => runAction('provider-fail', () => deliveryApi.simulateProviderResult(deliveryOrderId(selected), { trangThai: 'GIAO_THAT_BAI', lyDo: form.reason.trim() }), 'Đối tác đã báo giao thất bại')}><XCircle size={17} />{actionLoading === 'provider-fail' ? 'Đang mô phỏng...' : 'Demo webhook: giao thất bại'}</button></div>
                        ) : null}

                        {currentStatus === 'CHO_DOI_SOAT' && isCod ? (
                          <div className="delivery-action-block"><strong>Chờ đối soát COD</strong><small>Đối tác vận chuyển đã báo giao thành công và đã thu hộ tiền từ khách. Chỉ xác nhận khi nhà hàng đã thực sự nhận được khoản COD từ đơn vị vận chuyển.</small><button className="success" type="button" disabled={Boolean(actionLoading) || paymentStatus === 'CHO_HOAN_TIEN'} onClick={() => runAction('complete', () => deliveryApi.complete(deliveryOrderId(selected)), 'Đã xác nhận đối soát COD')}><CheckCircle2 size={17} />{actionLoading === 'complete' ? 'Đang xử lý...' : 'Xác nhận đã đối soát COD'}</button></div>
                        ) : null}

                        {currentStatus === 'CHO_DOI_SOAT' && isVietQr ? (
                          <div className="delivery-action-block"><strong>Đơn VietQR cũ đang chờ ghi nhận nội bộ</strong><small>Trạng thái này chỉ dùng để tương thích dữ liệu đã tạo trước bản cập nhật. Đơn VietQR mới sẽ tự hoàn tất khi đối tác báo giao thành công.</small><button className="success" type="button" disabled={Boolean(actionLoading) || paymentStatus === 'CHO_HOAN_TIEN'} onClick={() => runAction('complete', () => deliveryApi.complete(deliveryOrderId(selected)), 'Đã ghi nhận hóa đơn')}><CheckCircle2 size={17} />{actionLoading === 'complete' ? 'Đang xử lý...' : 'Ghi nhận hóa đơn'}</button></div>
                        ) : null}

                        {currentStatus === 'GIAO_THAT_BAI' ? (
                          <div className="delivery-action-block"><button type="button" disabled={Boolean(actionLoading)} onClick={() => runAction('retry', () => deliveryApi.retry(deliveryOrderId(selected)), 'Đã yêu cầu đối tác vận chuyển điều phối lại tài xế')}><RefreshCw size={17} />{actionLoading === 'retry' ? 'Đang xử lý...' : 'Điều phối lại tài xế'}</button></div>
                        ) : null}

                        {!['CHO_THANH_TOAN', 'CHO_XAC_NHAN', 'CHO_DEN_GIO', 'CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'CHO_KHACH_NHAN', 'DANG_GIAO', 'CHO_DOI_SOAT', 'GIAO_THAT_BAI'].includes(currentStatus) && paymentStatus !== 'CHO_HOAN_TIEN' ? <p className="delivery-no-action">Đơn đang được bếp xử lý hoặc đã kết thúc. Trạng thái sẽ tự động cập nhật.</p> : null}
                      </section>
                    ) : <section className="delivery-detail-section"><h3>Chế độ theo dõi</h3><p className="delivery-no-action">Bếp theo dõi thông tin giao hàng tại đây và cập nhật từng suất món trên Bảng chế biến. Bếp chỉ nhận đơn sau khi nhà hàng đã xác nhận; với đơn hẹn giờ, hệ thống chỉ chuyển món vào đúng thời điểm cần chuẩn bị. Thu ngân hoặc quản trị viên xử lý bước xác nhận, thanh toán, bàn giao và ngoại lệ giao hàng.</p></section>}
                  </aside>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <OrderItemCancellationModal
        open={Boolean(cancelTarget)}
        item={cancelTarget}
        loading={cancelLoading}
        actor="admin"
        onClose={() => setCancelTarget(null)}
        onSubmit={cancelDeliveryItem}
      />
    </section>
  );
}
