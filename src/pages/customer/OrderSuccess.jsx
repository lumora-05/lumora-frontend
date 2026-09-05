import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Ban,
  Check,
  CircleDot,
  Clock3,
  CreditCard,
  LoaderCircle,
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
import { useLanguage } from '../../context/LanguageContext';
import { localizedFoodName } from '../../utils/localizedContent';
import {
  canCustomerRequestCancellation,
  cancellationReasonLabel,
  isCancelledItem,
  isPendingCancellation,
} from '../../utils/orderCancellation';

const STATUS_LABEL = {
  CHO_XAC_NHAN: 'Chờ nhân viên xác nhận',
  DA_XAC_NHAN: 'Đã xác nhận · chuyển xuống bếp',
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
  CHO_XAC_NHAN: 'Chờ nhân viên xác nhận',
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
  { label: 'Chờ nhân viên xác nhận', description: 'Nhân viên phục vụ đang kiểm tra đơn trước khi chuyển xuống bếp' },
  { label: 'Đã chuyển xuống bếp', description: 'Nhân viên đã xác nhận và chuyển món đến bộ phận bếp' },
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

const PAYMENT_PENDING_STATUSES = new Set(['CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN']);
const PROMOTION_EDIT_STATUSES = new Set(['DA_PHUC_VU', 'CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN']);

function statusStep(status) {
  if (status === 'DA_THANH_TOAN') return 5;
  if (['DA_PHUC_VU', 'CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'].includes(status)) return 4;
  if (['SAN_SANG', 'SAN_SANG_PHUC_VU', 'DA_HOAN_THANH'].includes(status)) return 3;
  if (['DANG_CHUAN_BI', 'DANG_CHE_BIEN'].includes(status)) return 2;
  if (status === 'DA_XAC_NHAN') return 1;
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

function unwrapList(response) {
  const data = response?.data ?? response;
  return Array.isArray(data) ? data.filter(Boolean) : [];
}

function orderIdOf(order) {
  return order?.maDonHang ?? order?.id;
}

function orderStatus(order) {
  return String(order?.trangThai || 'CHO_XAC_NHAN').toUpperCase();
}

function orderTableName(order) {
  return order?.banAn?.tenBan || order?.tenBan || 'Bàn';
}

function groupStatus(orders) {
  const statuses = orders.map(orderStatus);
  if (!statuses.length) return 'CHO_XAC_NHAN';
  if (statuses.every((status) => status === 'DA_THANH_TOAN')) return 'DA_THANH_TOAN';
  if (statuses.some((status) => PAYMENT_PENDING_STATUSES.has(status))) return 'CHO_THANH_TOAN';
  if (statuses.every((status) => status === 'DA_PHUC_VU')) return 'DA_PHUC_VU';
  return statuses.reduce((lowest, status) => (
    statusStep(status) < statusStep(lowest) ? status : lowest
  ), statuses[0]);
}

function earliestOrderTime(orders) {
  const values = orders
    .map((item) => item?.thoiGianDat || item?.createdAt)
    .map((value) => value ? new Date(value) : null)
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return values[0] || null;
}

export default function OrderSuccess() {
  const { language } = useLanguage();
  const { qrToken, orderId } = useParams();
  const location = useLocation();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [serviceOrders, setServiceOrders] = useState([]);
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
    if (!qrToken || !orderId) return;
    try {
      setError('');

      // Backend trả cùng danh sách đơn đang mở cho mọi QR trong nhóm bàn ghép.
      // Ưu tiên danh sách này để QR bàn chính và QR bàn phụ nhìn cùng một phiên phục vụ.
      let groupOrders = [];
      try {
        const groupResponse = await orderApi.customerOpenOrdersByQrToken(qrToken);
        groupOrders = unwrapList(groupResponse);
      } catch {
        // Fallback về endpoint theo dõi đơn cũ để vẫn xem được đơn độc lập/đơn vừa kết thúc.
      }

      if (groupOrders.length) {
        const primaryOrder = groupOrders[0];
        setServiceOrders(groupOrders);
        setOrder(primaryOrder);
        setPromotionCode(primaryOrder?.maCodeKhuyenMai || primaryOrder?.khuyenMai?.maCode || '');
        return;
      }

      const response = await orderApi.customerTracking(qrToken, orderId);
      const data = response?.data || response;
      setOrder(data);
      setServiceOrders(data ? [data] : []);
      setPromotionCode(data?.maCodeKhuyenMai || data?.khuyenMai?.maCode || '');
    } catch (err) {
      setOrder(null);
      setServiceOrders([]);
      setError(err?.message || 'Không thể tải thông tin đơn hàng lúc này.');
    } finally {
      setLoading(false);
    }
  }, [orderId, qrToken]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (socketEvent?.topic === orderTopic) load();
  }, [socketEvent, orderTopic, load]);

  const orders = serviceOrders.length ? serviceOrders : (order ? [order] : []);
  const actionOrder = orders[0] || order;
  const actionOrderId = orderIdOf(actionOrder) || orderId;
  const statuses = orders.map(orderStatus);
  const currentStatus = groupStatus(orders);
  const activeStep = statusStep(currentStatus);
  const subtotal = orders.reduce((sum, item) => sum + Number(item?.tamTinh ?? item?.tongTien ?? 0), 0);
  const discount = orders.reduce((sum, item) => sum + Number(item?.tienGiam || 0), 0);
  const total = orders.reduce((sum, item) => sum + Number(item?.tongTien || 0), 0);
  const appliedPromotionCode = actionOrder?.maCodeKhuyenMai || actionOrder?.khuyenMai?.maCode || '';
  const appliedPromotionCodes = [...new Set(orders
    .map((item) => item?.maCodeKhuyenMai || item?.khuyenMai?.maCode || '')
    .filter(Boolean))];
  const tableNames = [...new Set(orders.map(orderTableName).filter(Boolean))];
  const tableName = tableNames.join(' + ') || orderTableName(actionOrder);
  const isSharedSession = Boolean(actionOrder?.maNhomThanhToan) || tableNames.length > 1;
  const canAddMore = orders.length > 0 && statuses.every((status) => !CANNOT_ADD_STATUSES.has(status));
  const canRequestPayment = orders.length > 0 && statuses.every((status) => status === 'DA_PHUC_VU');
  const paymentPending = statuses.some((status) => PAYMENT_PENDING_STATUSES.has(status));
  const canEditPromotion = orders.length > 0 && statuses.every((status) => PROMOTION_EDIT_STATUSES.has(status));
  const paid = orders.length > 0 && statuses.every((status) => status === 'DA_THANH_TOAN');
  const statusText = STATUS_LABEL[currentStatus] || currentStatus || 'Đang cập nhật';
  const firstOrderTime = earliestOrderTime(orders);
  const totalItemLines = orders.reduce((sum, item) => sum + (item?.chiTietDonHang || []).length, 0);

  const pageMessage = useMemo(() => {
    if (location.state?.isAdditionalCall) return `Lượt gọi thêm ${location.state?.callNumber || ''} đã được gửi và đang chờ nhân viên phục vụ xác nhận.`;
    if (location.state && location.state.isAdditionalCall === false) return 'Đơn hàng đã được gửi thành công và đang chờ nhân viên phục vụ xác nhận.';
    return 'Theo dõi tiến trình xử lý đơn hàng theo thời gian thực.';
  }, [location.state]);

  async function applyPromotion() {
    const code = promotionCode.trim().toUpperCase();
    if (!canEditPromotion || updatingPromotion || !actionOrderId) return;
    if (!code) {
      toast.error('Vui lòng nhập mã khuyến mãi.');
      return;
    }

    try {
      setUpdatingPromotion(true);
      await promotionApi.customerApply(qrToken, actionOrderId, code);
      await load();
      setPromotionCode(code);
      toast.success(`Đã áp dụng mã ${code}.`);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể áp dụng mã khuyến mãi.'));
    } finally {
      setUpdatingPromotion(false);
    }
  }

  async function removePromotion() {
    if (!appliedPromotionCode || !canEditPromotion || updatingPromotion || !actionOrderId) return;
    try {
      setUpdatingPromotion(true);
      await promotionApi.customerRemove(qrToken, actionOrderId);
      await load();
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
      const targetOrderId = cancelTarget?.__orderId || actionOrderId;
      const response = await orderApi.customerRequestItemCancellation(qrToken, targetOrderId, itemId, payload);
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
    if (!canRequestPayment || requestingPayment || !actionOrderId) return;

    try {
      setRequestingPayment(true);
      await orderApi.customerRequestPayment(qrToken, actionOrderId);
      setPaymentConfirmOpen(false);
      toast.success(isSharedSession ? 'Đã gửi yêu cầu thanh toán chung đến nhân viên.' : 'Đã gửi yêu cầu thanh toán đến nhân viên.');
      await load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể gửi yêu cầu thanh toán. Vui lòng gọi nhân viên phục vụ.'));
    } finally {
      setRequestingPayment(false);
    }
  }

  return (
    <main className="customer-flow-page">
      <CustomerHeader tableName={tableName} variant="menu-showcase" />

      <section className="customer-tracking-container">
        <div className="customer-page-heading customer-tracking-heading">
          <div>
            <span><ReceiptText size={17} /> {isSharedSession ? 'Phiên bàn ghép' : 'Đơn hàng'}</span>
            <h1>{isSharedSession ? 'Theo dõi nhóm bàn' : 'Theo dõi đơn hàng'}</h1>
            <p>{isSharedSession ? `QR của các bàn trong nhóm đều xem chung phiên phục vụ ${tableName}.` : pageMessage}</p>
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
                <span>{isSharedSession ? 'Thông tin phiên phục vụ' : 'Thông tin đơn hàng'}</span>
                <strong>{isSharedSession ? `${orders.length} đơn` : `#${actionOrderId}`}</strong>
              </div>

              <div className="customer-order-meta-list">
                <p>
                  <span>{isSharedSession ? 'Các đơn trong nhóm' : 'Mã đơn hàng'}</span>
                  <b>{orders.map((item) => `DH${String(orderIdOf(item)).padStart(6, '0')}`).join(' · ')}</b>
                </p>
                <p><span>Bàn</span><b>{tableName}</b></p>
                <p><span>{isSharedSession ? 'Thời gian bắt đầu' : 'Thời gian đặt'}</span><b>{formatDateTime(firstOrderTime)}</b></p>
              </div>

              <div className="customer-order-items-box">
                <div className="customer-order-items-heading">
                  <span><UtensilsCrossed size={18} /> {isSharedSession ? 'Món đã gọi trong nhóm' : 'Món đã gọi'}</span>
                  <small>{totalItemLines} dòng món</small>
                </div>
                <div className={`customer-order-items-list ${isSharedSession ? 'shared-session' : ''}`}>
                  {orders.map((groupOrder) => {
                    const groupOrderId = orderIdOf(groupOrder);
                    const groupTable = orderTableName(groupOrder);
                    const items = groupOrder?.chiTietDonHang || [];
                    return (
                      <section className="customer-shared-order-block" key={groupOrderId || groupTable}>
                        {isSharedSession ? (
                          <div className="customer-shared-order-head">
                            <div>
                              <strong>{groupTable}</strong>
                              <span>Đơn #{groupOrderId}</span>
                            </div>
                            <small>{STATUS_LABEL[orderStatus(groupOrder)] || orderStatus(groupOrder)}</small>
                          </div>
                        ) : null}

                        <div className="customer-shared-order-items">
                          {items.map((item, index) => {
                            const itemId = item?.maChiTiet ?? item?.maChiTietDonHang ?? item?.id ?? index;
                            const itemStatus = String(item?.trangThaiMon || 'CHO_BEP').toUpperCase();
                            const pendingCancellation = isPendingCancellation(item);
                            const cancelled = isCancelledItem(item);
                            const statusLabel = ITEM_STATUS_LABEL[itemStatus] || itemStatus;
                            return (
                              <article className={`customer-order-item-row ${cancelled ? 'cancelled' : ''}`} key={`${groupOrderId}-${itemId}`}>
                                <div className="customer-order-item-main">
                                  <strong>{localizedFoodName(item?.monAn || item, language, 'Món ăn')}</strong>
                                  <span>× {item?.soLuong || 0}{item?.ghiChu ? ` · ${item.ghiChu}` : ''}</span>
                                  {(pendingCancellation || cancelled) ? (
                                    <small>{item?.lyDoHuy || cancellationReasonLabel(item?.maLyDoHuy)}{item?.ghiChuHuy ? ` · ${item.ghiChuHuy}` : ''}</small>
                                  ) : null}
                                </div>
                                <div className="customer-order-item-side">
                                  <span className={`customer-order-item-status ${cancelled ? 'cancelled' : pendingCancellation ? 'pending-cancel' : ''}`}>{statusLabel}</span>
                                  <b>{cancelled ? 'Không tính tiền' : formatMoney((item?.donGia || item?.monAn?.gia || 0) * (item?.soLuong || 0))}</b>
                                  {canCustomerRequestCancellation(item) ? (
                                    <button
                                      type="button"
                                      onClick={() => setCancelTarget({ ...item, __orderId: groupOrderId, __tableName: groupTable })}
                                    >
                                      <Ban size={15} /> Yêu cầu hủy
                                    </button>
                                  ) : pendingCancellation ? <em>Đang chờ nhân viên duyệt</em> : null}
                                </div>
                              </article>
                            );
                          })}
                          {!items.length ? <p className="customer-order-items-empty">Đơn hàng chưa có món.</p> : null}
                        </div>
                      </section>
                    );
                  })}
                  {!totalItemLines ? <p className="customer-order-items-empty">Phiên phục vụ chưa có món.</p> : null}
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
                <small>{canEditPromotion
                  ? (isSharedSession ? 'Mã được áp dụng trên đơn chính; bill chung sẽ tổng hợp ưu đãi của toàn bộ nhóm.' : 'Mỗi đơn chỉ áp dụng một mã. Mã mới sẽ thay thế mã hiện tại.')
                  : (isSharedSession ? 'Có thể áp dụng mã sau khi toàn bộ món trong nhóm đã được phục vụ.' : 'Có thể áp dụng mã sau khi món đã được phục vụ.')}
                </small>
              </div>

              <div className="customer-order-price-list">
                <p><span>Tạm tính{isSharedSession ? ' cả nhóm' : ''}</span><b>{formatMoney(subtotal)}</b></p>
                <p><span>Phí phục vụ</span><b>{formatMoney(0)}</b></p>
                {discount > 0 ? (
                  <p className="discount">
                    <span>Khuyến mãi {appliedPromotionCodes.length ? `(${appliedPromotionCodes.join(', ')})` : ''}</span>
                    <b>-{formatMoney(discount)}</b>
                  </p>
                ) : null}
                <p className="total"><span>{isSharedSession ? 'Tổng bill chung' : 'Tổng cộng'}</span><strong>{formatMoney(total)}</strong></p>
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
                  title={!canRequestPayment && !paymentPending && !paid ? (isSharedSession ? 'Chỉ yêu cầu thanh toán khi toàn bộ món của nhóm đã được phục vụ' : 'Chỉ yêu cầu thanh toán sau khi món đã được phục vụ') : undefined}
                >
                  <CreditCard size={19} />
                  {requestingPayment
                    ? 'Đang gửi yêu cầu...'
                    : paid
                      ? 'Đã thanh toán'
                      : paymentPending
                        ? 'Đã yêu cầu thanh toán'
                        : isSharedSession
                          ? 'Thanh toán chung'
                          : 'Yêu cầu thanh toán'}
                </button>
              </div>
            </section>

            <section className="customer-order-timeline-card">
              <div className="customer-card-heading">
                <span>{isSharedSession ? 'Trạng thái phiên phục vụ' : 'Trạng thái đơn hàng'}</span>
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
                <span>{isSharedSession ? 'Khi bất kỳ đơn nào trong nhóm thay đổi, màn hình của tất cả QR bàn ghép sẽ tự cập nhật.' : 'Trạng thái sẽ tự động thay đổi khi nhân viên và bếp cập nhật đơn hàng.'}</span>
              </div>
            </section>
          </div>
        )}
      </section>

      <CustomerConfirmModal
        open={paymentConfirmOpen}
        loading={requestingPayment}
        title={isSharedSession ? 'Xác nhận thanh toán chung' : 'Xác nhận yêu cầu thanh toán'}
        description={isSharedSession
          ? `Bạn muốn gửi yêu cầu thanh toán chung cho ${tableName}? Hệ thống sẽ tính toàn bộ ${orders.length} đơn trong nhóm thành một bill.`
          : `Bạn muốn gửi yêu cầu thanh toán cho đơn DH${String(actionOrderId || orderId).padStart(6, '0')}? Nhân viên sẽ đến hỗ trợ tại ${tableName}.`}
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
