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
  unwrapDeliveryList,
  unwrapDeliveryResponse,
} from '../../utils/delivery';
import { formatDate } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';

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
    };
    const quantity = Number(item?.soLuong || 1);
    row.quantity += quantity;
    const status = String(item?.trangThaiMon || 'CHO_BEP').toUpperCase();
    row.statuses[status] = (row.statuses[status] || 0) + quantity;
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

export default function DeliveryOrderManage() {
  const { user } = useAuth();
  const role = currentRole(user);
  const canManage = ['ADMIN', 'CASHIER'].includes(role);
  const toast = useToast();
  const socketEvent = useWebSocket(['/topic/delivery-orders', '/topic/cashier/delivery-orders']);
  const [status, setStatus] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialActionForm);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await deliveryApi.list(status);
      setOrders(unwrapDeliveryList(response));
    } catch (requestError) {
      const message = errorMessageOf(requestError, 'Không thể tải danh sách đơn giao hàng.');
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
      toast.error(errorMessageOf(requestError, 'Không thể tải chi tiết đơn giao hàng.'));
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

  const filteredOrders = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    if (!query) return orders;
    return orders.filter((order) => {
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
  }, [keyword, orders]);

  const counters = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((item) => selectedStatus(item) === 'CHO_XAC_NHAN').length,
    preparing: orders.filter((item) => selectedStatus(item) === 'DANG_CHUAN_BI').length,
    delivery: orders.filter((item) => ['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'DANG_GIAO'].includes(selectedStatus(item))).length,
  }), [orders]);

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
      toast.error(errorMessageOf(requestError, 'Thao tác đơn giao hàng thất bại.'));
    } finally {
      setActionLoading('');
    }
  }

  const selectedDelivery = deliveryData(selected);
  const selectedItems = groupItems(selected?.chiTietDonHang || selected?.items || []);
  const currentStatus = selectedStatus(selected);
  const paymentStatus = String(selectedDelivery?.trangThaiThanhToan || '').toUpperCase();
  const isVietQr = String(selectedDelivery?.phuongThucThanhToan || '').toUpperCase() === 'VIETQR';
  const confirmBlocked = isVietQr && paymentStatus !== 'DA_THANH_TOAN';

  return (
    <section className="delivery-manage-page">
      <div className="delivery-manage-summary">
        <article><span><ShoppingBag size={22} /></span><div><small>Tổng đơn hiển thị</small><strong>{counters.total}</strong></div></article>
        <article><span><Clock3 size={22} /></span><div><small>Chờ xác nhận</small><strong>{counters.pending}</strong></div></article>
        <article><span><PackageCheck size={22} /></span><div><small>Đang chuẩn bị</small><strong>{counters.preparing}</strong></div></article>
        <article><span><Truck size={22} /></span><div><small>Chờ/giao hàng</small><strong>{counters.delivery}</strong></div></article>
      </div>

      <div className="delivery-manage-toolbar">
        <label><Search size={19} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã đơn, mã vận đơn, khách nhận..." /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {DELIVERY_ORDER_STATUSES.map((item) => <option key={item} value={item}>{deliveryStatusLabel(item)}</option>)}
        </select>
        <button type="button" onClick={() => loadOrders()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={18} /> Làm mới</button>
      </div>

      <div className="delivery-manage-table-card">
        {loading ? <div className="delivery-manage-state"><LoaderCircle className="spin" size={31} /><strong>Đang tải đơn giao hàng...</strong></div> : null}
        {!loading && error ? <div className="delivery-manage-state error"><AlertTriangle size={31} /><strong>{error}</strong><button type="button" onClick={() => loadOrders()}>Thử lại</button></div> : null}
        {!loading && !error ? (
          <div className="delivery-manage-table-wrap">
            <table className="delivery-manage-table">
              <thead><tr><th>Mã đơn</th><th>Khách nhận</th><th>Địa chỉ</th><th>Thanh toán</th><th>Tổng tiền</th><th>Trạng thái</th><th>Mã vận đơn</th><th></th></tr></thead>
              <tbody>
                {!filteredOrders.length ? <tr><td colSpan="8"><div className="delivery-table-empty">Không có đơn giao hàng phù hợp.</div></td></tr> : null}
                {filteredOrders.map((order) => {
                  const delivery = deliveryData(order);
                  const deliveryStatus = delivery.trangThaiGiaoHang;
                  return (
                    <tr key={deliveryOrderId(order)}>
                      <td><strong className="delivery-code">{displayOrderCode(order)}</strong><small>{formatDate(order.thoiGianDat)}</small></td>
                      <td><strong>{delivery.tenNguoiNhan}</strong><small>{delivery.soDienThoaiNhan}</small></td>
                      <td className="delivery-address-cell"><span>{delivery.diaChiGiaoHang}</span><small>{deliveryAreaLabel(delivery.khuVucGiaoHang)}</small></td>
                      <td><span className={`delivery-payment-badge ${deliveryStatusClass(delivery.trangThaiThanhToan)}`}>{deliveryPaymentLabel(delivery.trangThaiThanhToan)}</span><small>{delivery.phuongThucThanhToan}</small></td>
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
        ) : null}
      </div>

      {selected || detailLoading ? (
        <div className="delivery-detail-backdrop" role="dialog" aria-modal="true">
          <div className="delivery-detail-modal">
            {detailLoading && !selected ? <div className="delivery-manage-state"><LoaderCircle className="spin" size={32} /><strong>Đang tải chi tiết...</strong></div> : null}
            {selected ? (
              <>
                <div className="delivery-detail-head">
                  <div><span>ĐƠN GIAO HÀNG</span><h2>{displayOrderCode(selected)}</h2><p>Đặt lúc {formatDate(selected.thoiGianDat)}</p></div>
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
                        <p className="wide"><small>Địa chỉ</small><strong>{selectedDelivery.diaChiGiaoHang}</strong></p>
                        <p><small>Khu vực</small><strong>{deliveryAreaLabel(selectedDelivery.khuVucGiaoHang)}</strong></p>
                        <p><small>Phí giao</small><strong>{formatMoney(selectedDelivery.phiGiaoHang)}</strong></p>
                        {selectedDelivery.ghiChuGiaoHang ? <p className="wide"><small>Ghi chú giao hàng</small><strong>{selectedDelivery.ghiChuGiaoHang}</strong></p> : null}
                        {selected?.ghiChu ? <p className="wide"><small>Ghi chú đơn</small><strong>{selected.ghiChu}</strong></p> : null}
                      </div>
                    </section>

                    <section className="delivery-detail-section">
                      <h3><ShoppingBag size={19} /> Danh sách món</h3>
                      <div className="delivery-detail-items">
                        {selectedItems.map((item) => (
                          <div key={item.key}><span>{item.quantity}×</span><div><strong>{item.tenMonAn}</strong><small>{itemProgressLabel(item.statuses)}</small>{item.note ? <em>{item.note}</em> : null}</div><b>{formatMoney(item.donGia * item.quantity)}</b></div>
                        ))}
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
                          {selectedDelivery.lyDoGiaoThatBai ? <p className="wide"><small>Lý do giao thất bại</small><strong>{selectedDelivery.lyDoGiaoThatBai}</strong></p> : null}
                        </div>
                      </section>
                    ) : null}
                  </div>

                  <aside className="delivery-detail-side">
                    <section className="delivery-detail-section">
                      <h3><CreditCard size={19} /> Thanh toán</h3>
                      <p className="delivery-detail-payment-line"><span>{selectedDelivery.phuongThucThanhToan}</span><b className={deliveryStatusClass(selectedDelivery.trangThaiThanhToan)}>{deliveryPaymentLabel(selectedDelivery.trangThaiThanhToan)}</b></p>
                      <div className="delivery-detail-money"><p><span>Tạm tính</span><strong>{formatMoney(selected.tamTinh)}</strong></p><p><span>Giảm giá</span><strong>-{formatMoney(selected.tienGiam)}</strong></p><p><span>Phí giao hàng</span><strong>{formatMoney(selectedDelivery.phiGiaoHang)}</strong></p><div><span>Tổng cộng</span><strong>{formatMoney(selected.tongTien)}</strong></div></div>
                    </section>

                    {canManage ? (
                      <section className="delivery-detail-section delivery-actions-panel">
                        <h3>Thao tác nghiệp vụ</h3>

                        {isVietQr && paymentStatus !== 'DA_THANH_TOAN' && currentStatus !== 'DA_HUY' ? (
                          <div className="delivery-action-block"><label>Mã giao dịch VietQR *<input value={form.transactionCode} onChange={(event) => setForm((current) => ({ ...current, transactionCode: event.target.value }))} maxLength={100} placeholder="Ví dụ: MB202608060001" /></label><label>Ghi chú xác nhận<input value={form.paymentNote} onChange={(event) => setForm((current) => ({ ...current, paymentNote: event.target.value }))} maxLength={500} placeholder="Đã kiểm tra tài khoản" /></label><button type="button" disabled={Boolean(actionLoading) || !form.transactionCode.trim()} onClick={() => runAction('payment', () => deliveryApi.confirmVietQr(deliveryOrderId(selected), { maGiaoDich: form.transactionCode.trim(), ghiChu: form.paymentNote.trim() || null }), 'Đã xác nhận thanh toán VietQR')}><Banknote size={17} />{actionLoading === 'payment' ? 'Đang xử lý...' : 'Xác nhận đã nhận tiền'}</button></div>
                        ) : null}

                        {currentStatus === 'CHO_XAC_NHAN' ? (
                          <div className="delivery-action-block"><button className="success" type="button" disabled={Boolean(actionLoading) || confirmBlocked} onClick={() => runAction('confirm', () => deliveryApi.confirmOrder(deliveryOrderId(selected)), 'Đã xác nhận và chuyển đơn xuống bếp')}><CheckCircle2 size={17} />{actionLoading === 'confirm' ? 'Đang xử lý...' : 'Xác nhận đơn'}</button>{confirmBlocked ? <small>Đơn VietQR phải được xác nhận đã nhận tiền trước khi chuyển xuống bếp.</small> : null}</div>
                        ) : null}

                        {currentStatus === 'CHO_XAC_NHAN' ? (
                          <div className="delivery-action-block danger"><label>Lý do từ chối *<textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={500} placeholder="Ngoài khu vực giao hàng, món tạm hết..." /></label><button type="button" disabled={Boolean(actionLoading) || !form.reason.trim()} onClick={() => runAction('reject', () => deliveryApi.rejectOrder(deliveryOrderId(selected), { lyDo: form.reason.trim() }), 'Đã từ chối đơn giao hàng')}><XCircle size={17} />{actionLoading === 'reject' ? 'Đang xử lý...' : 'Từ chối đơn'}</button></div>
                        ) : null}

                        {['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO'].includes(currentStatus) ? (
                          <div className="delivery-action-block">
                            <div className="delivery-assignment-card">
                              <span><Truck size={21} /></span>
                              <div>
                                <strong>{selectedDelivery.donViVanChuyen || 'GrabExpress (Demo) đang điều phối'}</strong>
                                <small>{selectedDelivery.maVanChuyen ? `Mã vận đơn: ${selectedDelivery.maVanChuyen}` : 'Đang chờ cấp mã vận đơn'}</small>
                                <small>{selectedDelivery.tenNguoiGiao ? `Tài xế: ${selectedDelivery.tenNguoiGiao}${selectedDelivery.soDienThoaiNguoiGiao ? ` · ${selectedDelivery.soDienThoaiNguoiGiao}` : ''}` : 'Đang chờ thông tin tài xế'}</small>
                              </div>
                            </div>
                            <label>Ghi chú bàn giao<textarea value={form.handoverNote} onChange={(event) => setForm((current) => ({ ...current, handoverNote: event.target.value }))} maxLength={500} placeholder="Ví dụ: Đã bàn giao đủ món và đồ uống" /></label>
                            <small>Thông tin mã vận đơn và tài xế được GrabExpress (Demo) mô phỏng điều phối tự động, thu ngân không cần nhập thủ công.</small>
                            <button type="button" disabled={Boolean(actionLoading) || !selectedDelivery.maVanChuyen || !selectedDelivery.tenNguoiGiao} onClick={() => runAction('handover', () => deliveryApi.handover(deliveryOrderId(selected), { ghiChuBanGiao: form.handoverNote.trim() || null }), 'Đã bàn giao đơn cho tài xế')}><Truck size={17} />{actionLoading === 'handover' ? 'Đang xử lý...' : 'Bàn giao cho tài xế'}</button>
                          </div>
                        ) : null}

                        {currentStatus === 'DANG_GIAO' ? (
                          <><div className="delivery-action-block"><button className="success" type="button" disabled={Boolean(actionLoading)} onClick={() => runAction('complete', () => deliveryApi.complete(deliveryOrderId(selected)), 'Đã xác nhận giao thành công')}><CheckCircle2 size={17} />{actionLoading === 'complete' ? 'Đang xử lý...' : 'Giao thành công'}</button></div><div className="delivery-action-block danger"><label>Lý do giao thất bại *<textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={500} placeholder="Không liên lạc được với người nhận..." /></label><button type="button" disabled={Boolean(actionLoading) || !form.reason.trim()} onClick={() => runAction('fail', () => deliveryApi.fail(deliveryOrderId(selected), { lyDo: form.reason.trim() }), 'Đã ghi nhận giao thất bại')}><XCircle size={17} />{actionLoading === 'fail' ? 'Đang xử lý...' : 'Giao thất bại'}</button></div></>
                        ) : null}

                        {currentStatus === 'GIAO_THAT_BAI' ? (
                          <div className="delivery-action-block"><button type="button" disabled={Boolean(actionLoading)} onClick={() => runAction('retry', () => deliveryApi.retry(deliveryOrderId(selected)), 'Đã yêu cầu GrabExpress (Demo) điều phối lại tài xế')}><RefreshCw size={17} />{actionLoading === 'retry' ? 'Đang xử lý...' : 'Điều phối lại tài xế'}</button></div>
                        ) : null}

                        {!['CHO_XAC_NHAN', 'CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'DANG_GIAO', 'GIAO_THAT_BAI'].includes(currentStatus) && !(isVietQr && paymentStatus !== 'DA_THANH_TOAN') ? <p className="delivery-no-action">Đơn đang được bếp xử lý hoặc đã kết thúc. Trạng thái sẽ tự động cập nhật.</p> : null}
                      </section>
                    ) : <section className="delivery-detail-section"><h3>Chế độ theo dõi</h3><p className="delivery-no-action">Bếp theo dõi thông tin giao hàng tại đây và cập nhật từng suất món trên Bảng chế biến. Thu ngân hoặc quản trị viên xử lý xác nhận, bàn giao và kết quả giao.</p></section>}
                  </aside>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
