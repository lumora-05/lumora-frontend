import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Ban,
  Check,
  CircleDot,
  Clock3,
  CreditCard,
  LoaderCircle,
  MapPin,
  Plus,
  ReceiptText,
  RefreshCw,
  TicketPercent,
  X,
  UtensilsCrossed
} from 'lucide-react';
import CustomerHeader from '../../components/customer/CustomerHeader';
import CustomerConfirmModal from '../../components/customer/CustomerConfirmModal';
import OrderItemCancellationModal from '../../components/order/OrderItemCancellationModal';
import { orderApi } from '../../api/orderApi';
import { promotionApi } from '../../api/promotionApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatMoney } from '../../utils/formatMoney';
import {
  canCustomerRequestCancellation,
  cancellationReasonLabel,
  isCancelledItem,
  isPendingCancellation,
} from '../../utils/orderCancellation';

const STATUS_LABEL = {
  CHO_XAC_NHAN: 'Đang chuyển xuống bếp',
  DA_XAC_NHAN: 'Đã chuyển xuống bếp',
  DANG_CHUAN_BI: 'Đang chuẩn bị',
  DANG_CHE_BIEN: 'Đang chế biến',
  SAN_SANG: 'Sẵn sàng phục vụ',
  SAN_SANG_PHUC_VU: 'Sẵn sàng phục vụ',
  DA_HOAN_THANH: 'Sẵn sàng phục vụ',
  DA_PHUC_VU: 'Đã phục vụ',
  CHO_THANH_TOAN: 'Chờ thanh toán',
  SAN_SANG_THANH_TOAN: 'Chờ thanh toán',
  DA_THANH_TOAN: 'Đã thanh toán',
  DA_HUY: 'Đã hủy'
};

const ITEM_STATUS_LABEL = {
  CHO_BEP: 'Chờ bếp',
  DANG_NAU: 'Đang chế biến',
  DANG_CHE_BIEN: 'Đang chế biến',
  YEU_CAU_HUY: 'Chờ duyệt hủy',
  DA_HUY: 'Đã hủy',
  HOAN_THANH: 'Sẵn sàng phục vụ',
  DA_HOAN_THANH: 'Sẵn sàng phục vụ',
  SAN_SANG: 'Sẵn sàng phục vụ',
  SAN_SANG_PHUC_VU: 'Sẵn sàng phục vụ',
  DA_PHUC_VU: 'Đã phục vụ',
};

const STEPS = [
  { label: 'Đã chuyển xuống bếp', description: 'Đơn hàng đã được gửi trực tiếp đến bộ phận bếp' },
  { label: 'Đang chế biến', description: 'Bếp đang chuẩn bị món ăn' },
  { label: 'Sẵn sàng phục vụ', description: 'Bếp đã hoàn thành và đang chờ nhân viên mang món ra' },
  { label: 'Đã phục vụ', description: 'Món ăn đã được mang đến bàn' },
  { label: 'Đã hoàn tất', description: 'Đơn hàng đã được thanh toán' }
];

const CANNOT_ADD_STATUSES = new Set([
  'CHO_THANH_TOAN',
  'SAN_SANG_THANH_TOAN',
  'DA_THANH_TOAN',
  'DA_HUY'
]);

function statusStep(status) {
  if (status === 'DA_THANH_TOAN') return 4;
  if (['DA_PHUC_VU', 'CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'].includes(status)) return 3;
  if (['SAN_SANG', 'SAN_SANG_PHUC_VU', 'DA_HOAN_THANH'].includes(status)) return 2;
  if (['DANG_CHUAN_BI', 'DANG_CHE_BIEN'].includes(status)) return 1;
  return 0;
}

function formatDateTime(value) {
  if (!value) return 'Vừa tạo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa tạo';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export default function OrderSuccess() {
  const { qrToken, orderId } = useParams();
  const location = useLocation();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [updatingPromotion, setUpdatingPromotion] = useState(false);
  const [error, setError] = useState('');
  const orderTopic = `/topic/customer/orders/${orderId}`;
  const socketEvent = useWebSocket([orderTopic]);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setError('');
      const response = await orderApi.customerTracking(orderId);
      const data = response?.data || response;
      setOrder(data);
      setPromotionCode(data?.maCodeKhuyenMai || data?.khuyenMai?.maCode || '');
    } catch (err) {
      setError(err?.message || 'Không thể tải thông tin đơn hàng lúc này.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (socketEvent?.topic === orderTopic) load();
  }, [socketEvent, orderTopic, load]);

  const currentStatus = order?.trangThai || 'CHO_XAC_NHAN';
  const activeStep = statusStep(currentStatus);
  const subtotal = Number(order?.tamTinh ?? order?.tongTien ?? 0);
  const discount = Number(order?.tienGiam || 0);
  const total = Number(order?.tongTien || 0);
  const appliedPromotionCode = order?.maCodeKhuyenMai || order?.khuyenMai?.maCode || '';
  const tableName = order?.banAn?.tenBan || order?.tenBan || 'Bàn';
  const canAddMore = !CANNOT_ADD_STATUSES.has(currentStatus);
  const canRequestPayment = currentStatus === 'DA_PHUC_VU';
  const paymentPending = ['CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'].includes(currentStatus);
  const canEditPromotion = ['DA_PHUC_VU', 'CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'].includes(currentStatus);
  const paid = currentStatus === 'DA_THANH_TOAN';
  const statusText = STATUS_LABEL[currentStatus] || currentStatus || 'Đang cập nhật';

  const pageMessage = useMemo(() => {
    if (location.state?.isAdditionalCall) return `Lượt gọi thêm ${location.state?.callNumber || ''} đã được gửi trực tiếp xuống bếp.`;
    if (location.state && location.state.isAdditionalCall === false) return 'Đơn hàng đã được gửi thành công và chuyển trực tiếp xuống bếp.';
    return 'Theo dõi tiến trình xử lý đơn hàng theo thời gian thực.';
  }, [location.state]);

  async function applyPromotion() {
    const code = promotionCode.trim().toUpperCase();
    if (!canEditPromotion || updatingPromotion) return;
    if (!code) {
      toast.error('Vui lòng nhập mã khuyến mãi.');
      return;
    }

    try {
      setUpdatingPromotion(true);
      const response = await promotionApi.customerApply(order?.maDonHang || orderId, code);
      const updated = response?.data || response;
      if (updated?.maDonHang) setOrder(updated);
      else await load();
      setPromotionCode(code);
      toast.success(`Đã áp dụng mã ${code}.`);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể áp dụng mã khuyến mãi.'));
    } finally {
      setUpdatingPromotion(false);
    }
  }

  async function removePromotion() {
    if (!appliedPromotionCode || !canEditPromotion || updatingPromotion) return;
    try {
      setUpdatingPromotion(true);
      const response = await promotionApi.customerRemove(order?.maDonHang || orderId);
      const updated = response?.data || response;
      if (updated?.maDonHang) setOrder(updated);
      else await load();
      setPromotionCode('');
      toast.success('Đã gỡ mã khuyến mãi.');
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể gỡ mã khuyến mãi.'));
    } finally {
      setUpdatingPromotion(false);
    }
  }

  async function requestItemCancellation(payload) {
    if (!cancelTarget || cancelLoading) return;
    try {
      setCancelLoading(true);
      const itemId = cancelTarget?.maChiTiet ?? cancelTarget?.maChiTietDonHang ?? cancelTarget?.id;
      const response = await orderApi.customerRequestItemCancellation(qrToken, order?.maDonHang || orderId, itemId, payload);
      toast.success(response?.message || 'Đã gửi yêu cầu hủy món đến nhân viên phục vụ.');
      setCancelTarget(null);
      await load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể gửi yêu cầu hủy món.'));
    } finally {
      setCancelLoading(false);
    }
  }

  function requestPayment() {
    if (!canRequestPayment || requestingPayment) return;
    setPaymentConfirmOpen(true);
  }

  async function confirmRequestPayment() {
    if (!canRequestPayment || requestingPayment) return;

    try {
      setRequestingPayment(true);
      await orderApi.customerRequestPayment(order?.maDonHang || orderId);
      setPaymentConfirmOpen(false);
      toast.success('Đã gửi yêu cầu thanh toán đến nhân viên.');
      await load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể gửi yêu cầu thanh toán. Vui lòng gọi nhân viên phục vụ.'));
    } finally {
      setRequestingPayment(false);
    }
  }

  return (
    <main className="customer-flow-page">
      <CustomerHeader tableName={tableName} />

      <section className="customer-tracking-container">
        <div className="customer-page-heading customer-tracking-heading">
          <div>
            <span><ReceiptText size={17} /> Đơn hàng</span>
            <h1>Theo dõi đơn hàng</h1>
            <p>{pageMessage}</p>
          </div>
          <div className="customer-live-status"><CircleDot size={15} /> {statusText}</div>
        </div>

        {loading ? (
          <div className="customer-menu-access-state">
            <LoaderCircle className="spin" size={32} />
            <h2>Đang tải đơn hàng...</h2>
          </div>
        ) : error || !order ? (
          <div className="customer-menu-access-state error">
            <RefreshCw size={34} />
            <h2>Chưa thể tải đơn hàng</h2>
            <p>{error || 'Không tìm thấy đơn hàng.'}</p>
            <button type="button" onClick={load}>Thử lại</button>
          </div>
        ) : (
          <div className="customer-tracking-layout">
            <section className="customer-order-info-card">
              <div className="customer-card-heading">
                <span>Thông tin đơn hàng</span>
                <strong>#{order?.maDonHang || orderId}</strong>
              </div>

              <div className="customer-order-meta-list">
                <p><span>Mã đơn hàng</span><b>DH{String(order?.maDonHang || orderId).padStart(6, '0')}</b></p>
                <p><span>Bàn</span><b>{tableName}</b></p>
                <p><span>Thời gian đặt</span><b>{formatDateTime(order?.thoiGianDat || order?.createdAt)}</b></p>
              </div>

              <div className="customer-order-items-box">
                <div className="customer-order-items-heading">
                  <span><UtensilsCrossed size={18} /> Món đã gọi</span>
                  <small>{(order?.chiTietDonHang || []).length} dòng món</small>
                </div>
                <div className="customer-order-items-list">
                  {(order?.chiTietDonHang || []).map((item, index) => {
                    const itemId = item?.maChiTiet ?? item?.maChiTietDonHang ?? item?.id ?? index;
                    const itemStatus = String(item?.trangThaiMon || 'CHO_BEP').toUpperCase();
                    const pendingCancellation = isPendingCancellation(item);
                    const cancelled = isCancelledItem(item);
                    const statusLabel = ITEM_STATUS_LABEL[itemStatus] || itemStatus;
                    return (
                      <article className={`customer-order-item-row ${cancelled ? 'cancelled' : ''}`} key={itemId}>
                        <div className="customer-order-item-main">
                          <strong>{item?.monAn?.tenMonAn || item?.tenMonAn || item?.tenMon || 'Món ăn'}</strong>
                          <span>× {item?.soLuong || 0}{item?.ghiChu ? ` · ${item.ghiChu}` : ''}</span>
                          {(pendingCancellation || cancelled) ? (
                            <small>{item?.lyDoHuy || cancellationReasonLabel(item?.maLyDoHuy)}{item?.ghiChuHuy ? ` · ${item.ghiChuHuy}` : ''}</small>
                          ) : null}
                        </div>
                        <div className="customer-order-item-side">
                          <span className={`customer-order-item-status ${cancelled ? 'cancelled' : pendingCancellation ? 'pending-cancel' : ''}`}>{statusLabel}</span>
                          <b>{cancelled ? 'Không tính tiền' : formatMoney((item?.donGia || item?.monAn?.gia || 0) * (item?.soLuong || 0))}</b>
                          {canCustomerRequestCancellation(item) ? (
                            <button type="button" onClick={() => setCancelTarget(item)}><Ban size={15} /> Yêu cầu hủy</button>
                          ) : pendingCancellation ? <em>Đang chờ nhân viên duyệt</em> : null}
                        </div>
                      </article>
                    );
                  })}
                  {!(order?.chiTietDonHang || []).length ? <p className="customer-order-items-empty">Đơn hàng chưa có món.</p> : null}
                </div>
              </div>

              <div className="customer-promotion-box">
                <div className="customer-promotion-heading">
                  <span><TicketPercent size={18} /> Khuyến mãi</span>
                  {appliedPromotionCode ? (
                    <span className="customer-applied-promotion">
                      {appliedPromotionCode}
                      <button type="button" onClick={removePromotion} disabled={!canEditPromotion || updatingPromotion} title="Gỡ mã khuyến mãi"><X size={14} /></button>
                    </span>
                  ) : null}
                </div>
                <div className="customer-promotion-form">
                  <input
                    value={promotionCode}
                    onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => { if (event.key === 'Enter') applyPromotion(); }}
                    disabled={!canEditPromotion || updatingPromotion}
                    maxLength="50"
                    placeholder="Nhập mã khuyến mãi"
                  />
                  <button type="button" onClick={applyPromotion} disabled={!canEditPromotion || updatingPromotion}>
                    {updatingPromotion ? 'Đang xử lý...' : appliedPromotionCode ? 'Đổi mã' : 'Áp dụng'}
                  </button>
                </div>
                <small>{canEditPromotion ? 'Mỗi đơn chỉ áp dụng một mã. Mã mới sẽ thay thế mã hiện tại.' : 'Có thể áp dụng mã sau khi món đã được phục vụ.'}</small>
              </div>

              <div className="customer-order-price-list">
                <p><span>Tạm tính</span><b>{formatMoney(subtotal)}</b></p>
                <p><span>Phí phục vụ</span><b>{formatMoney(0)}</b></p>
                {discount > 0 ? <p className="discount"><span>Khuyến mãi {appliedPromotionCode ? `(${appliedPromotionCode})` : ''}</span><b>-{formatMoney(discount)}</b></p> : null}
                <p className="total"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></p>
              </div>

              <div className="customer-order-actions">
                {canAddMore ? (
                  <Link className="add-more" to={`/table/${qrToken}`}><Plus size={19} /> Gọi thêm món</Link>
                ) : (
                  <button className="add-more" type="button" disabled><Plus size={19} /> Không thể gọi thêm</button>
                )}

                <button
                  className="request-payment"
                  type="button"
                  disabled={!canRequestPayment || requestingPayment}
                  onClick={requestPayment}
                  title={!canRequestPayment && !paymentPending && !paid ? 'Chỉ yêu cầu thanh toán sau khi món đã được phục vụ' : undefined}
                >
                  <CreditCard size={19} />
                  {requestingPayment
                    ? 'Đang gửi yêu cầu...'
                    : paid
                      ? 'Đã thanh toán'
                      : paymentPending
                        ? 'Đã yêu cầu thanh toán'
                        : 'Yêu cầu thanh toán'}
                </button>
              </div>
            </section>

            <section className="customer-order-timeline-card">
              <div className="customer-card-heading">
                <span>Trạng thái đơn hàng</span>
                <small>Cập nhật tự động</small>
              </div>

              <div className="customer-order-timeline">
                {STEPS.map((step, index) => {
                  const completed = index < activeStep || (index === activeStep && paid);
                  const active = index === activeStep && !paid;
                  return (
                    <div className={`customer-timeline-step ${completed ? 'completed' : ''} ${active ? 'active' : ''}`} key={step.label}>
                      <span className="customer-timeline-dot">{completed ? <Check size={15} /> : null}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="customer-tracking-note">
                <Clock3 size={18} />
                <span>Trạng thái sẽ tự động thay đổi khi nhân viên và bếp cập nhật đơn hàng.</span>
              </div>
            </section>
          </div>
        )}
      </section>

      <CustomerConfirmModal
        open={paymentConfirmOpen}
        loading={requestingPayment}
        title="Xác nhận yêu cầu thanh toán"
        description={`Bạn muốn gửi yêu cầu thanh toán cho đơn DH${String(order?.maDonHang || orderId).padStart(6, '0')}? Nhân viên sẽ đến hỗ trợ tại ${tableName}.`}
        confirmText="Gửi yêu cầu"
        cancelText="Quay lại"
        onClose={() => !requestingPayment && setPaymentConfirmOpen(false)}
        onConfirm={confirmRequestPayment}
      />

      <OrderItemCancellationModal
        open={Boolean(cancelTarget)}
        item={cancelTarget}
        loading={cancelLoading}
        actor="customer"
        onClose={() => !cancelLoading && setCancelTarget(null)}
        onSubmit={requestItemCancellation}
      />
    </main>
  );
}
