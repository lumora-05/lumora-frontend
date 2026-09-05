import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChefHat,
  Clock3,
  Copy,
  CreditCard,
  KeyRound,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { deliveryApi } from '../../api/deliveryApi';
import { reviewApi } from '../../api/reviewApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  deliveryAreaLabel,
  deliveryPaymentLabel,
  deliveryStatusClass,
  deliveryStatusLabel,
  isDeliveryFinished,
  unwrapDeliveryResponse,
} from '../../utils/delivery';
import { formatDate } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import { formatDistanceMeters, formatDurationSeconds } from '../../utils/mapUtils';
import { useLanguage } from '../../context/LanguageContext';
import { localizedFoodName } from '../../utils/localizedContent';
import { usePublicContentTranslations } from '../../hooks/usePublicContentTranslations';

const ORDER_PLACED_STEP = { code: 'DA_DAT', label: 'Đã đặt hàng', icon: ShoppingBag };

const BASE_STEPS = [
  { code: 'CHO_XAC_NHAN', label: 'Chờ nhà hàng xác nhận', icon: Clock3 },
  { code: 'DANG_CHUAN_BI', label: 'Đang chuẩn bị', icon: ChefHat },
  { code: 'CHO_TAI_XE_NHAN', label: 'Chờ tài xế đến nhận', icon: PackageCheck },
  { code: 'DANG_GIAO', label: 'Đang giao', icon: Truck },
  { code: 'HOAN_THANH', label: 'Đã giao', icon: Check },
];

const PICKUP_STEPS = [
  { code: 'CHO_XAC_NHAN', label: 'Chờ nhà hàng xác nhận', icon: Clock3 },
  { code: 'DANG_CHUAN_BI', label: 'Đang chuẩn bị', icon: ChefHat },
  { code: 'CHO_KHACH_NHAN', label: 'Sẵn sàng nhận món', icon: PackageCheck },
  { code: 'HOAN_THANH', label: 'Đã nhận món', icon: Check },
];

const VIETQR_PAYMENT_STEP = { code: 'CHO_THANH_TOAN', label: 'Chờ thanh toán', icon: CreditCard };
const SCHEDULED_STEP = { code: 'CHO_DEN_GIO', label: 'Đã xác nhận · chờ đến giờ', icon: Clock3 };

function savedOrder(token) {
  try {
    return JSON.parse(sessionStorage.getItem(`lumora_delivery_order_${token}`) || 'null');
  } catch {
    return null;
  }
}

function progressText(item) {
  const parts = [];
  if (Number(item?.soLuongChoBep || 0) > 0) parts.push(`Chờ bếp ${item.soLuongChoBep}`);
  if (Number(item?.soLuongDangCheBien || 0) > 0) parts.push(`Đang chế biến ${item.soLuongDangCheBien}`);
  if (Number(item?.soLuongHoanThanh || 0) > 0) parts.push(`Hoàn thành ${item.soLuongHoanThanh}`);
  if (Number(item?.soLuongDaHuy || 0) > 0) parts.push(`Đã hủy ${item.soLuongDaHuy}`);
  return parts.join(' · ') || item?.ghiChu || 'Đang chờ cập nhật';
}

export default function DeliveryTracking() {
  const { trackingCode = '' } = useParams();
  const location = useLocation();
  const toast = useToast();
  const { language } = useLanguage();
  const initialOrder = location.state?.order || savedOrder(trackingCode);
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const qrAutoRequestKeyRef = useRef('');
  const qrRequestIdRef = useRef(0);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(() => localStorage.getItem(`lumora_delivery_review_${trackingCode}`) === '1');
  usePublicContentTranslations({ language, foods: order?.items });
  const deliverySocketEvent = useWebSocket(trackingCode ? [`/topic/customer/delivery/${trackingCode}`] : []);

  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!trackingCode) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await deliveryApi.track(trackingCode);
      const value = unwrapDeliveryResponse(response);
      setOrder(value);
      sessionStorage.setItem('lumora_delivery_last_token', trackingCode);
      sessionStorage.setItem(`lumora_delivery_order_${trackingCode}`, JSON.stringify(value));
    } catch (requestError) {
      setError(errorMessageOf(requestError, 'Không thể tra cứu đơn hàng.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [trackingCode]);

  useEffect(() => {
    loadOrder({ silent: Boolean(order) });
  }, [loadOrder]);

  useEffect(() => {
    if (!deliverySocketEvent) return;
    loadOrder({ silent: true });
  }, [deliverySocketEvent, loadOrder]);

  useEffect(() => {
    if (String(order?.trangThaiThanhToan || '').toUpperCase() !== 'CHO_THANH_TOAN') {
      setQr(null);
    }
  }, [order?.trangThaiThanhToan]);

  useEffect(() => {
    const deliveryStatus = String(order?.trangThaiGiaoHang || '').toUpperCase();
    const paymentStatus = String(order?.trangThaiThanhToan || '').toUpperCase();
    const paymentMethod = String(order?.phuongThucThanhToan || '').toUpperCase();
    const shouldLoadPayOsQr = Boolean(order)
      && paymentMethod === 'VIETQR'
      && deliveryStatus === 'CHO_THANH_TOAN'
      && paymentStatus === 'CHO_THANH_TOAN';

    if (!shouldLoadPayOsQr) {
      qrAutoRequestKeyRef.current = '';
      return undefined;
    }

    const requestKey = `${trackingCode}:${order?.maDonHang || order?.id || ''}`;
    if (qr || qrAutoRequestKeyRef.current === requestKey) return undefined;

    qrAutoRequestKeyRef.current = requestKey;
    const requestId = ++qrRequestIdRef.current;
    setQrLoading(true);

    deliveryApi.createVietQr(trackingCode)
      .then((response) => {
        if (qrRequestIdRef.current === requestId) {
          setQr(unwrapDeliveryResponse(response));
        }
      })
      .catch(() => {
        // Giữ trạng thái không có QR để giao diện hiện nút "Thử tạo lại mã QR".
      })
      .finally(() => {
        if (qrRequestIdRef.current === requestId) {
          setQrLoading(false);
        }
      });

    return () => {
      if (qrRequestIdRef.current === requestId) {
        qrRequestIdRef.current += 1;
      }
    };
  }, [
    trackingCode,
    qr,
    order?.id,
    order?.maDonHang,
    order?.trangThaiGiaoHang,
    order?.trangThaiThanhToan,
    order?.phuongThucThanhToan,
  ]);

  useEffect(() => {
    const status = order?.trangThaiGiaoHang;
    if (!order || isDeliveryFinished(status)) return undefined;
    const timer = window.setInterval(() => loadOrder({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  const steps = useMemo(() => {
    const paymentMethod = String(order?.phuongThucThanhToan || '').toUpperCase();
    const receiveType = String(order?.loaiThoiGianNhan || '').toUpperCase();
    const receiveMethod = String(order?.phuongThucNhanHang || 'GIAO_TAN_NOI').toUpperCase();
    const sourceSteps = receiveMethod === 'TU_DEN_LAY' ? PICKUP_STEPS : BASE_STEPS;
    const base = receiveType === 'HEN_GIO'
      ? [sourceSteps[0], SCHEDULED_STEP, ...sourceSteps.slice(1)]
      : sourceSteps;
    if (paymentMethod !== 'VIETQR') return [ORDER_PLACED_STEP, ...base];
    return [ORDER_PLACED_STEP, VIETQR_PAYMENT_STEP, ...base];
  }, [order?.phuongThucThanhToan, order?.loaiThoiGianNhan, order?.phuongThucNhanHang]);

  const currentStep = useMemo(() => {
    const rawCode = String(order?.trangThaiGiaoHang || '').toUpperCase();
    const code = rawCode === 'CHO_BAN_GIAO' ? 'CHO_TAI_XE_NHAN' : rawCode;
    return steps.findIndex((step) => step.code === code);
  }, [order?.trangThaiGiaoHang, steps]);

  async function generateQr() {
    setQrLoading(true);
    try {
      const response = await deliveryApi.createVietQr(trackingCode);
      setQr(unwrapDeliveryResponse(response));
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Không thể tạo mã VietQR.'));
    } finally {
      setQrLoading(false);
    }
  }

  async function cancelOrder() {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do hủy đơn.');
      return;
    }
    setCanceling(true);
    try {
      const response = await deliveryApi.cancelByCustomer(trackingCode, { lyDo: cancelReason.trim() });
      const value = unwrapDeliveryResponse(response);
      setOrder(value);
      setCancelReason('');
      toast.success('Đã hủy đơn giao hàng.');
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Không thể hủy đơn.'));
    } finally {
      setCanceling(false);
    }
  }

  async function submitReview() {
    if (reviewRating < 1 || reviewRating > 5) {
      toast.error('Vui lòng chọn số sao đánh giá.');
      return;
    }
    setReviewSubmitting(true);
    try {
      await reviewApi.create({
        displayName: String(order?.tenNguoiNhan || 'Khách hàng').slice(0, 50),
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });
      localStorage.setItem(`lumora_delivery_review_${trackingCode}`, '1');
      setReviewSubmitted(true);
      toast.success('Cảm ơn bạn đã gửi đánh giá.');
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Chưa thể gửi đánh giá.'));
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.info(value);
    }
  }

  if (!order) {
    return (
      <main className="delivery-public-page">
        <DeliveryPublicHeader homeStyle />
        <section className="delivery-public-container delivery-lookup-single">
          <Link to="/menu/lookup"><ArrowLeft size={18} /> Tra cứu đơn khác</Link>
          <div className="delivery-lookup-card">
            <span><KeyRound size={34} /></span>
            <h1>Đang tra cứu đơn</h1>
            <p>Mã tra cứu được bảo vệ bằng chuỗi ngẫu nhiên, không dùng mã đơn tăng dần.</p>
            {error ? <div className="delivery-inline-error"><AlertTriangle size={17} />{error}</div> : null}
            <button type="button" onClick={() => loadOrder()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}{loading ? 'Đang tra cứu...' : 'Thử lại'}</button>
          </div>
        </section>
      </main>
    );
  }

  const status = String(order.trangThaiGiaoHang || '').toUpperCase();
  const failed = ['DA_HUY', 'GIAO_THAT_BAI'].includes(status);
  const paymentStatus = String(order.trangThaiThanhToan || '').toUpperCase();
  const canCancel = status === 'CHO_THANH_TOAN' || status === 'CHO_XAC_NHAN';
  const showQrButton = String(order.phuongThucThanhToan || '').toUpperCase() === 'VIETQR'
    && status === 'CHO_THANH_TOAN'
    && paymentStatus === 'CHO_THANH_TOAN';
  const failureReason = order.lyDoTuChoi || order.lyDoGiaoThatBai;
  const paymentMethod = String(order.phuongThucThanhToan || '').toUpperCase();
  const receiveMethod = String(order.phuongThucNhanHang || 'GIAO_TAN_NOI').toUpperCase();
  const receiveType = String(order.loaiThoiGianNhan || '').toUpperCase();
  const isPickupOrder = receiveMethod === 'TU_DEN_LAY';
  const isScheduledOrder = receiveType === 'HEN_GIO';
  const isPayOsPending = !failed && paymentMethod === 'VIETQR' && status === 'CHO_THANH_TOAN' && paymentStatus === 'CHO_THANH_TOAN';
  const paidFlowStatuses = ['CHO_XAC_NHAN', 'CHO_DEN_GIO', 'DANG_CHUAN_BI', 'CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'CHO_KHACH_NHAN', 'DANG_GIAO', 'CHO_DOI_SOAT', 'HOAN_THANH'];
  const isPayOsPaidFlow = !failed && paymentMethod === 'VIETQR' && paymentStatus === 'DA_THANH_TOAN'
    && paidFlowStatuses.includes(status);
  const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.soLuong || 0), 0);

  const compactFlowSteps = (() => {
    const result = [
      { code: 'DA_DAT', label: 'Đã tạo đơn', icon: Check },
      { code: 'DA_THANH_TOAN', label: 'Đã thanh toán', icon: Check },
      { code: 'CHO_XAC_NHAN', label: 'Chờ nhà hàng xác nhận', icon: PackageCheck },
    ];
    if (isScheduledOrder) result.push({ code: 'CHO_DEN_GIO', label: 'Chờ đến giờ chuẩn bị', icon: Clock3 });
    result.push({ code: 'DANG_CHUAN_BI', label: 'Đang chuẩn bị', icon: ChefHat });
    if (isPickupOrder) {
      result.push({ code: 'CHO_KHACH_NHAN', label: 'Sẵn sàng nhận', icon: PackageCheck });
    } else {
      result.push({ code: 'CHO_TAI_XE_NHAN', label: 'Sẵn sàng giao', icon: PackageCheck });
      result.push({ code: 'DANG_GIAO', label: 'Đang giao', icon: Truck });
    }
    result.push({ code: 'HOAN_THANH', label: isPickupOrder ? 'Đã nhận món' : 'Hoàn thành', icon: Check });
    return result;
  })();

  const paidTimelineStatus = status === 'CHO_BAN_GIAO'
    ? 'CHO_TAI_XE_NHAN'
    : status === 'CHO_DOI_SOAT'
      ? 'DANG_GIAO'
      : status;
  const paidProgressIndex = Math.max(0, compactFlowSteps.findIndex((step) => step.code === paidTimelineStatus));

  const paidFlowCopy = (() => {
    if (status === 'CHO_XAC_NHAN') return {
      title: 'Thanh toán thành công, đang chờ nhà hàng xác nhận',
      subtitle: 'Nhà hàng sẽ kiểm tra đơn trước khi chuyển sang khâu chuẩn bị.',
    };
    if (status === 'CHO_DEN_GIO') return {
      title: 'Đơn đã được xác nhận, đang chờ đến giờ chuẩn bị',
      subtitle: 'Hệ thống sẽ chuyển món xuống bếp đúng thời điểm cần chuẩn bị.',
    };
    if (status === 'DANG_CHUAN_BI') return {
      title: 'Nhà hàng đang chuẩn bị món của bạn',
      subtitle: 'Bếp đang chế biến các món trong đơn.',
    };
    if (status === 'CHO_KHACH_NHAN') return {
      title: 'Món đã sẵn sàng để bạn đến nhận',
      subtitle: 'Vui lòng đến Lumora để nhận món theo thông tin đơn hàng.',
    };
    if (['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO'].includes(status)) return {
      title: 'Món đã sẵn sàng để giao',
      subtitle: 'Nhà hàng đang chờ bàn giao đơn cho đơn vị vận chuyển.',
    };
    if (status === 'DANG_GIAO') return {
      title: 'Đơn hàng đang được giao đến bạn',
      subtitle: 'Bạn có thể tiếp tục theo dõi trạng thái giao hàng tại đây.',
    };
    if (status === 'CHO_DOI_SOAT') return {
      title: 'Đơn đã giao, hệ thống đang hoàn tất đối soát',
      subtitle: 'Trạng thái sẽ tự động cập nhật sau khi hoàn tất.',
    };
    if (status === 'HOAN_THANH') return {
      title: isPickupOrder ? 'Bạn đã nhận món thành công' : 'Đơn hàng đã giao thành công',
      subtitle: 'Cảm ơn bạn đã đặt món tại Lumora.',
    };
    return {
      title: 'Đơn hàng đang được xử lý',
      subtitle: 'Trạng thái sẽ tự động cập nhật theo thời gian thực.',
    };
  })();

  if (isPayOsPending) {
    return (
      <main className="delivery-public-page delivery-flow-page">
        <DeliveryPublicHeader homeStyle />
        <section className="delivery-public-container delivery-payflow-page">
          <Link className="delivery-flow-back" to="/menu"><ArrowLeft size={18} /> Quay lại</Link>
          <div className="delivery-payflow-grid">
            <section className="delivery-payflow-main-card">
              <div className="delivery-flow-title">
                <span><PackageCheck size={27} /></span>
                <div><h1>Theo dõi đơn hàng</h1><p>Kiểm tra trạng thái và hoàn tất thanh toán</p></div>
              </div>

              <div className="delivery-flow-order-meta">
                <div><small>Mã đơn hàng</small><strong>{order.maDonHangHienThi || '—'}</strong></div>
                <button type="button" onClick={() => copyText(order.maDonHangHienThi, 'Đã sao chép mã đơn.')} aria-label="Sao chép mã đơn"><Copy size={18} /></button>
                <div className="delivery-flow-meta-status"><small>Trạng thái hiện tại</small><span><Clock3 size={18} /> Chờ thanh toán</span></div>
              </div>

              <div className="delivery-payos-waiting-banner">
                <span>!</span>
                <div><strong>Đang chờ PayOS xác nhận tự động</strong><small>Sau khi bạn quét mã và thanh toán, hệ thống sẽ tự động xác nhận giao dịch.</small></div>
              </div>

              <div className="delivery-flow-timeline four">
                {[
                  { label: 'Đã tạo đơn', icon: Check, state: 'done', sub: formatDate(order.thoiGianDat) },
                  { label: 'Chờ thanh toán', icon: Clock3, state: 'active', sub: 'Đang xử lý...' },
                  { label: 'Chờ nhà hàng xác nhận', icon: PackageCheck, state: '', sub: '' },
                  { label: 'Đang chuẩn bị', icon: ChefHat, state: '', sub: '' },
                ].map(({ label, icon: Icon, state, sub }) => (
                  <div key={label} className={state}>
                    <span><Icon size={19} /></span><strong>{label}</strong>{sub ? <small>{sub}</small> : null}
                  </div>
                ))}
              </div>

              <h2 className="delivery-flow-section-title">Thông tin đơn hàng</h2>
              <div className="delivery-flow-info-list">
                <p><UserRound size={19} /><span>Người nhận</span><strong>{order.tenNguoiNhan || '—'}</strong></p>
                <p><MapPin size={19} /><span>Địa chỉ nhận hàng</span><strong>{order.phuongThucNhanHang === 'TU_DEN_LAY' ? '191 Hoàng Diệu, Phường Hải Châu, Thành phố Đà Nẵng' : order.diaChiGiaoHang || '—'}</strong></p>
                <p><CreditCard size={19} /><span>Tổng tiền</span><strong className="money">{formatMoney(order.tongThanhToan)}</strong></p>
              </div>

              {canCancel ? (
                <details className="delivery-flow-cancel">
                  <summary>Cần hủy đơn?</summary>
                  <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Nhập lý do hủy trước khi nhà hàng xác nhận" />
                  <button type="button" onClick={cancelOrder} disabled={canceling}>{canceling ? <LoaderCircle className="spin" size={16} /> : <XCircle size={16} />} Hủy đơn</button>
                </details>
              ) : null}
            </section>

            <aside className="delivery-payos-card-v2">
              <div className="delivery-payos-card-head"><div><CreditCard size={24} /><h2>Thanh toán VietQR (PayOS)</h2></div><b>PayOS</b></div>
              <div className="delivery-payos-qr-panel">
                {qr?.qrUrl ? <img src={qr.qrUrl} alt="Mã VietQR thanh toán đơn giao hàng" /> : <div className="delivery-payos-qr-loading">{qrLoading ? <LoaderCircle className="spin" size={28} /> : <CreditCard size={28} />}<span>{qrLoading ? 'Đang tạo mã thanh toán...' : 'Chưa tải được mã VietQR'}</span></div>}
                {!qr?.qrUrl && !qrLoading ? <button className="delivery-payos-retry" type="button" onClick={generateQr}><RefreshCw size={16} /> Thử tạo lại mã QR</button> : null}
                <small>Số tiền thanh toán</small>
                <strong>{formatMoney(qr?.amount ?? order.tongThanhToan)}</strong>
                <div className="delivery-payos-transfer-content"><span>Nội dung chuyển khoản</span><div><b>{qr?.addInfo || order.maDonHangHienThi || '—'}</b>{(qr?.addInfo || order.maDonHangHienThi) ? <button type="button" onClick={() => copyText(qr?.addInfo || order.maDonHangHienThi, 'Đã sao chép nội dung chuyển khoản.')}><Copy size={17} /></button> : null}</div></div>
              </div>
              <div className="delivery-payos-guide"><strong>Hướng dẫn thanh toán</strong><ol><li>Mở ứng dụng ngân hàng</li><li>Quét mã QR</li><li>Hoàn tất chuyển khoản</li></ol></div>
              <small className="delivery-payos-note">Mã QR sẽ tự động biến mất sau khi thanh toán thành công.</small>
            </aside>
          </div>
        </section>
      </main>
    );
  }

  if (isPayOsPaidFlow) {
    return (
      <main className="delivery-public-page delivery-flow-page">
        <DeliveryPublicHeader homeStyle />
        <section className="delivery-public-container delivery-paidflow-page">
          <Link className="delivery-flow-back" to="/menu"><ArrowLeft size={18} /> Quay lại trang chủ</Link>
          <div className="delivery-paidflow-heading">
            <div className="delivery-flow-title large"><span><ShoppingBag size={27} /></span><div><h1>Theo dõi đơn hàng</h1><p>Đơn hàng đã được thanh toán thành công</p></div></div>
            <div className="delivery-meal-banner"><img src="/delivery-icons/delivery-bike.png" alt="" aria-hidden="true" /><div><strong>{paidFlowCopy.title}</strong><small>{paidFlowCopy.subtitle}</small></div><span>♡</span></div>
          </div>

          <div className="delivery-paidflow-grid">
            <section className="delivery-paidflow-main-card">
              <div className="delivery-paid-order-head"><div><small>Mã đơn hàng</small><h2>{order.maDonHangHienThi || '—'}</h2><p>Đặt lúc {formatDate(order.thoiGianDat)}</p></div><button type="button" onClick={() => document.getElementById('delivery-paid-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ShoppingBag size={17} /> Chi tiết đơn hàng</button></div>

              <div className="delivery-payos-success-banner"><span><Check size={22} /></span><div><strong>Đã được PayOS xác nhận tự động</strong><small>Thanh toán đã được ghi nhận thành công qua PayOS.</small></div><b>PayOS</b></div>

              <div className="delivery-paid-status-grid">
                <div><span><CreditCard size={23} /></span><p><small>Trạng thái thanh toán</small><strong className="success">Đã thanh toán</strong></p></div>
                <div><span><PackageCheck size={23} /></span><p><small>Trạng thái đơn hàng</small><strong className="waiting">{deliveryStatusLabel(status)}</strong></p></div>
              </div>

              <div className="delivery-flow-timeline paid" style={{ '--delivery-flow-step-count': compactFlowSteps.length }}>
                {compactFlowSteps.map(({ code, label, icon: Icon }, index) => {
                  const state = index < paidProgressIndex ? 'done' : index === paidProgressIndex ? 'active' : '';
                  const sub = index === 0
                    ? formatDate(order.thoiGianDat)
                    : index === 1
                      ? 'Đã ghi nhận'
                      : index === paidProgressIndex
                        ? (code === 'CHO_DEN_GIO' ? 'Đã xác nhận' : code === 'HOAN_THANH' ? 'Đã hoàn tất' : 'Đang xử lý')
                        : '';
                  return <div key={code} className={state}><span><Icon size={19} /></span><strong>{label}</strong>{sub ? <small>{sub}</small> : null}</div>;
                })}
              </div>

              <div className="delivery-paid-info-strip">
                <div><MapPin size={22} /><p><small>{isPickupOrder ? 'Địa điểm nhận' : 'Địa chỉ giao hàng'}</small><strong>{isPickupOrder ? '191 Hoàng Diệu, Phường Hải Châu, Thành phố Đà Nẵng' : order.diaChiGiaoHang || '—'}</strong></p></div>
                <div><CreditCard size={22} /><p><small>Phương thức thanh toán</small><strong>VietQR</strong><span>Thanh toán qua PayOS</span></p></div>
                <div><Clock3 size={22} /><p><small>{isPickupOrder ? 'Dự kiến nhận' : 'Dự kiến giao'}</small><strong>{order.thoiGianNhanDuKienGiay ? formatDurationSeconds(order.thoiGianNhanDuKienGiay) : 'Đang cập nhật'}</strong><span>{status === 'CHO_DEN_GIO' ? 'Đang chờ đến giờ chuẩn bị' : 'Cập nhật theo tiến độ thực tế'}</span></p></div>
              </div>

              <div className="delivery-paid-state-note">
                {status === 'HOAN_THANH' ? <Check size={19} /> : status === 'DANG_GIAO' ? <Truck size={19} /> : status === 'DANG_CHUAN_BI' ? <ChefHat size={19} /> : <Clock3 size={19} />}
                <div><strong>{paidFlowCopy.title}</strong><small>{paidFlowCopy.subtitle}</small></div>
              </div>

              {order.maVanChuyen || order.tenNguoiGiao || order.donViVanChuyen ? (
                <div className="delivery-paid-transport-box">
                  <div><PackageCheck size={18} /><span><small>Mã vận đơn</small><strong>{order.maVanChuyen || 'Đang cập nhật'}</strong></span></div>
                  <div><Truck size={18} /><span><small>Đơn vị vận chuyển</small><strong>{order.donViVanChuyen || 'Đang điều phối'}</strong></span></div>
                  {order.tenNguoiGiao ? <div><UserRound size={18} /><span><small>Người giao</small><strong>{order.tenNguoiGiao}</strong></span></div> : null}
                  {order.soDienThoaiNguoiGiaoChe ? <div><Phone size={18} /><span><small>Liên hệ</small><strong>{order.soDienThoaiNguoiGiaoChe}</strong></span></div> : null}
                </div>
              ) : null}

              {canCancel ? (
                <details className="delivery-flow-cancel compact">
                  <summary>Cần hủy đơn?</summary>
                  <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Nhập lý do hủy trước khi nhà hàng xác nhận" />
                  <button type="button" onClick={cancelOrder} disabled={canceling}>{canceling ? <LoaderCircle className="spin" size={16} /> : <XCircle size={16} />} Hủy đơn</button>
                </details>
              ) : null}
            </section>

            <aside id="delivery-paid-summary" className="delivery-paid-summary-card">
              <div className="delivery-paid-summary-head"><h2>Tóm tắt đơn hàng</h2><span><Check size={16} /> Thanh toán thành công</span></div>
              <strong className="delivery-paid-item-count">{itemCount} món ăn</strong>
              <div className="delivery-paid-items">
                {(order.items || []).map((item, index) => (
                  <article key={`${item.maMonAn}-${index}`}>
                    <div>{item?.hinhAnh ? <img src={imageUrl(item.hinhAnh)} alt={localizedFoodName(item, language, 'Món ăn')} /> : <ShoppingBag size={22} />}</div>
                    <p><strong>{localizedFoodName(item, language, 'Món ăn')}</strong><b>{formatMoney(item.donGia ?? (Number(item.thanhTien || 0) / Math.max(1, Number(item.soLuong || 1))))}</b><small>{item.ghiChu || 'Ghi chú món...'}</small></p>
                    <span>×{item.soLuong}</span><b>{formatMoney(item.thanhTien)}</b>
                  </article>
                ))}
              </div>
              <div className="delivery-paid-summary-money"><p><span>Tạm tính</span><strong>{formatMoney(order.tamTinh)}</strong></p>{Number(order.tienGiam || 0) > 0 ? <p><span>Giảm giá</span><strong>-{formatMoney(order.tienGiam)}</strong></p> : null}<p><span>Phí giao hàng</span><strong>{formatMoney(order.phiGiaoHang)}</strong></p><div><span>Tổng thanh toán</span><strong>{formatMoney(order.tongThanhToan)}</strong></div></div>
              <button type="button" onClick={() => loadOrder({ silent: true })}><RefreshCw className={loading ? 'spin' : ''} size={19} /> {status === 'HOAN_THANH' ? 'Cập nhật trạng thái' : 'Tiếp tục theo dõi'}</button>
              {status === 'HOAN_THANH' ? (
                <div className="delivery-paid-review">
                  <strong>Đánh giá trải nghiệm</strong>
                  {reviewSubmitted ? <small>Cảm ơn bạn đã gửi đánh giá cho LUMORA.</small> : (
                    <>
                      <div className="delivery-review-stars" aria-label="Chọn số sao">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" className={reviewRating >= star ? 'active' : ''} onClick={() => setReviewRating(star)} aria-label={`${star} sao`}><Star size={20} /></button>
                        ))}
                      </div>
                      <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={500} placeholder="Chia sẻ cảm nhận của bạn (không bắt buộc)" />
                      <button type="button" onClick={submitReview} disabled={reviewSubmitting}>{reviewSubmitting ? <LoaderCircle className="spin" size={17} /> : <Star size={17} />}{reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}</button>
                    </>
                  )}
                </div>
              ) : null}
              <small>{status === 'HOAN_THANH' ? 'Cảm ơn bạn đã đặt món tại Lumora.' : 'Chúng tôi sẽ cập nhật trạng thái đơn hàng theo thời gian thực.'}</small>
            </aside>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader homeStyle />
      <section className="delivery-public-container delivery-tracking-page">
        <div className="delivery-tracking-top">
          <div>
            <Link to="/menu"><ArrowLeft size={18} /> Tiếp tục đặt món</Link>
            <span>Theo dõi giao hàng</span>
            <h1>Đơn <button type="button" onClick={() => copyText(order.maDonHangHienThi, 'Đã sao chép mã đơn.')}>{order.maDonHangHienThi}<Copy size={16} /></button></h1>
            <p>Đặt lúc {formatDate(order.thoiGianDat)} · Trạng thái được tự động cập nhật</p>
          </div>
          <div className={`delivery-current-status ${deliveryStatusClass(status)}`}>
            {failed ? <XCircle size={24} /> : <Truck size={24} />}
            <div><small>Trạng thái hiện tại</small><strong>{deliveryStatusLabel(status)}</strong></div>
            <button type="button" onClick={() => loadOrder()} disabled={loading} title="Làm mới"><RefreshCw className={loading ? 'spin' : ''} size={19} /></button>
          </div>
        </div>

        {error ? <div className="delivery-inline-error"><AlertTriangle size={17} />{error}</div> : null}

        {!failed ? (
          <div className="delivery-timeline" style={{ '--delivery-step-count': steps.length }}>
            {steps.map(({ code, label, icon: Icon }, index) => {
              const active = index === currentStep;
              const done = currentStep >= 0 && index < currentStep;
              return (
                <div key={code} className={`${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  <span>{done ? <Check size={18} /> : <Icon size={18} />}</span>
                  <strong>{label}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="delivery-failed-banner"><AlertTriangle size={23} /><div><strong>{deliveryStatusLabel(status)}</strong><span>{failureReason || 'Vui lòng liên hệ nhà hàng để được hỗ trợ.'}</span></div></div>
        )}

        <div className="delivery-tracking-grid">
          <div className="delivery-tracking-main">
            <section className="delivery-info-card">
              <div className="delivery-info-title"><ShoppingBag size={20} /><div><h2>Món đã đặt</h2><p>{order.items?.reduce((sum, item) => sum + Number(item.soLuong || 0), 0) || 0} suất món</p></div></div>
              <div className="delivery-track-items">
                {(order.items || []).map((item, index) => (
                  <div key={`${item.maMonAn}-${item.ghiChu || ''}-${index}`}><span>{item.soLuong}×</span><div><strong>{localizedFoodName(item, language, 'Món ăn')}</strong><small>{progressText(item)}</small>{item.ghiChu ? <em>{item.ghiChu}</em> : null}</div><b>{formatMoney(item.thanhTien)}</b></div>
                ))}
              </div>
            </section>

            <section className="delivery-info-card">
              <div className="delivery-info-title"><MapPin size={20} /><div><h2>Thông tin nhận hàng</h2><p>{deliveryAreaLabel(order.khuVucGiaoHang)}</p></div></div>
              <div className="delivery-recipient-grid">
                <p><UserRound size={17} /><span><small>Người nhận</small><strong>{order.tenNguoiNhan}</strong></span></p>
                <p><Phone size={17} /><span><small>Số điện thoại</small><strong>{order.soDienThoaiNhanChe}</strong></span></p>
                <p className="wide"><MapPin size={17} /><span><small>{order.phuongThucNhanHang === 'TU_DEN_LAY' ? 'Địa điểm nhận' : 'Địa chỉ'}</small><strong>{order.phuongThucNhanHang === 'TU_DEN_LAY' ? '191 Hoàng Diệu, Phường Hải Châu, Thành phố Đà Nẵng' : order.diaChiGiaoHang}</strong></span></p>
                {order.quangDuongMet ? <p><Truck size={17} /><span><small>Quãng đường giao hàng</small><strong>{formatDistanceMeters(order.quangDuongMet)}</strong></span></p> : null}
                {order.loaiThoiGianNhan === 'HEN_GIO' && order.thoiGianNhanMongMuon ? <p><Clock3 size={17} /><span><small>Thời gian nhận đã hẹn</small><strong>{formatDate(order.thoiGianNhanMongMuon)}</strong></span></p> : null}
                {order.loaiThoiGianNhan !== 'HEN_GIO' && order.thoiGianNhanDuKienGiay ? <p><Clock3 size={17} /><span><small>Thời gian nhận dự kiến</small><strong>{formatDurationSeconds(order.thoiGianNhanDuKienGiay)}</strong></span></p> : null}
                {order.ghiChuGiaoHang ? <p className="wide"><Clock3 size={17} /><span><small>Ghi chú giao hàng</small><strong>{order.ghiChuGiaoHang}</strong></span></p> : null}
              </div>
            </section>

            {order.maVanChuyen ? (
              <section className="delivery-info-card">
                <div className="delivery-info-title"><PackageCheck size={20} /><div><h2>Thông tin vận chuyển</h2><p>Grab (Demo) được điều phối theo thời điểm món dự kiến sẵn sàng; chỉ nhận hàng khi toàn bộ món hoàn tất</p></div></div>
                <div className="delivery-recipient-grid">
                  <p><PackageCheck size={17} /><span><small>Mã vận đơn</small><strong><button type="button" onClick={() => copyText(order.maVanChuyen, 'Đã sao chép mã vận đơn.')}>{order.maVanChuyen} <Copy size={14} /></button></strong></span></p>
                  <p><Truck size={17} /><span><small>Đơn vị vận chuyển</small><strong>{order.donViVanChuyen || 'Grab (Demo) đang điều phối'}</strong></span></p>
                  {order.tenNguoiGiao ? <p><UserRound size={17} /><span><small>Tài xế</small><strong>{order.tenNguoiGiao}</strong></span></p> : null}
                  {order.soDienThoaiNguoiGiaoChe ? <p><Phone size={17} /><span><small>Liên hệ tài xế</small><strong>{order.soDienThoaiNguoiGiaoChe}</strong></span></p> : null}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="delivery-payment-card">
            <div className="delivery-info-title"><CreditCard size={20} /><div><h2>Thanh toán</h2><p>{order.phuongThucThanhToan === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Thanh toán khi nhận hàng'}</p></div></div>
            <div className="delivery-payment-status"><span className={deliveryStatusClass(order.trangThaiThanhToan)}>{deliveryPaymentLabel(order.trangThaiThanhToan)}</span></div>
            <div className="delivery-track-money"><p><span>Tạm tính</span><strong>{formatMoney(order.tamTinh)}</strong></p><p><span>Giảm giá</span><strong>-{formatMoney(order.tienGiam)}</strong></p><p><span>Phí giao hàng</span><strong>{formatMoney(order.phiGiaoHang)}</strong></p>{Number(order.soTienDaHoan || 0) > 0 ? <p><span>Đã hoàn tiền</span><strong>{formatMoney(order.soTienDaHoan)}</strong></p> : null}{Number(order.soTienCanHoan || 0) > 0 ? <p><span>Đang chờ hoàn</span><strong>{formatMoney(order.soTienCanHoan)}</strong></p> : null}<div><span>Tổng cộng</span><strong>{formatMoney(order.tongThanhToan)}</strong></div></div>

            {status === 'CHO_THANH_TOAN' && order.thoiGianHetHanThanhToan ? <div className="delivery-eta warning"><Clock3 size={19} /><span><small>Hạn thanh toán VietQR</small><strong>{formatDate(order.thoiGianHetHanThanhToan)}</strong></span></div> : null}
            {paymentStatus === 'CHO_HOAN_TIEN' ? <div className="delivery-refund-notice"><AlertTriangle size={18} /><span>Nhà hàng đang xử lý hoàn {formatMoney(order.soTienCanHoan)}. Vui lòng liên hệ hỗ trợ nếu cần thêm thông tin.</span></div> : null}

            {order.thoiGianSanSang ? <div className="delivery-eta"><Clock3 size={19} /><span><small>Sẵn sàng bàn giao</small><strong>{formatDate(order.thoiGianSanSang)}</strong></span></div> : null}
            {order.thoiGianBanGiao ? <div className="delivery-eta"><Truck size={19} /><span><small>Đã bàn giao</small><strong>{formatDate(order.thoiGianBanGiao)}</strong></span></div> : null}
            {order.thoiGianGiaoThanhCong ? <div className="delivery-eta"><Check size={19} /><span><small>Giao thành công</small><strong>{formatDate(order.thoiGianGiaoThanhCong)}</strong></span></div> : null}

            {showQrButton ? <button className="delivery-qr-button" type="button" onClick={generateQr} disabled={qrLoading}>{qrLoading ? <LoaderCircle className="spin" size={18} /> : <CreditCard size={18} />} Tạo mã VietQR</button> : null}
            {qr ? <div className="delivery-qr-box"><img src={qr.qrUrl} alt="Mã VietQR thanh toán đơn giao hàng" /><strong>{formatMoney(qr.amount)}</strong><small>{qr.bankName} · {qr.accountNo}</small><small>Nội dung: {qr.addInfo}</small><small>Thanh toán sẽ được hệ thống tự động xác nhận sau khi PayOS ghi nhận giao dịch thành công.</small></div> : null}
            {String(order.phuongThucThanhToan || '').toUpperCase() === 'VIETQR' && paymentStatus === 'DA_THANH_TOAN' ? <div className="delivery-eta"><Check size={19} /><span><small>VietQR</small><strong>Đã được PayOS xác nhận tự động</strong></span></div> : null}

            {canCancel ? (
              <div className="delivery-cancel-box"><strong>Cần hủy đơn?</strong><small>Bạn có thể tự hủy khi đơn chưa được nhà hàng xác nhận. Nếu VietQR đã thanh toán, hệ thống sẽ ghi nhận khoản cần hoàn.</small><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Nhập lý do hủy trước khi nhà hàng xác nhận" /><button type="button" onClick={cancelOrder} disabled={canceling}>{canceling ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />} Hủy đơn</button></div>
            ) : null}

            {status === 'HOAN_THANH' ? (
              <>
                <div className="delivery-complete-note"><Check size={18} /><span><strong>Đơn đã giao thành công</strong><small>Cảm ơn bạn đã đặt món tại LUMORA.</small></span></div>
                <div className="delivery-review-box">
                  <strong>Đánh giá trải nghiệm</strong>
                  {reviewSubmitted ? (
                    <small>Cảm ơn bạn đã gửi đánh giá cho LUMORA.</small>
                  ) : (
                    <>
                      <div className="delivery-review-stars" aria-label="Chọn số sao">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" className={reviewRating >= star ? 'active' : ''} onClick={() => setReviewRating(star)} aria-label={`${star} sao`}>
                            <Star size={20} />
                          </button>
                        ))}
                      </div>
                      <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={500} placeholder="Chia sẻ cảm nhận của bạn (không bắt buộc)" />
                      <button type="button" onClick={submitReview} disabled={reviewSubmitting}>
                        {reviewSubmitting ? <LoaderCircle className="spin" size={17} /> : <Star size={17} />}
                        {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}
            <a className="delivery-support-phone" href={`tel:${import.meta.env.VITE_RESTAURANT_PHONE || '0979792909'}`}><Phone size={18} /> Liên hệ nhà hàng</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
