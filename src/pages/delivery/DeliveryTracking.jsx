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
  Store,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { deliveryApi } from '../../api/deliveryApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
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
import { formatDistanceMeters, formatDurationSeconds } from '../../utils/googleMaps';

const BASE_STEPS = [
  { code: 'CHO_XAC_NHAN', label: 'Chờ xác nhận', icon: Store },
  { code: 'DANG_CHUAN_BI', label: 'Đang chuẩn bị', icon: ChefHat },
  { code: 'CHO_TAI_XE_NHAN', label: 'Chờ tài xế nhận', icon: PackageCheck },
  { code: 'DANG_GIAO', label: 'Đang giao', icon: Truck },
  { code: 'CHO_DOI_SOAT', label: 'Chờ đối soát', icon: PackageCheck },
  { code: 'HOAN_THANH', label: 'Hoàn thành', icon: Check },
];

const VIETQR_PAYMENT_STEP = { code: 'CHO_THANH_TOAN', label: 'Chờ thanh toán', icon: CreditCard };

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
  const initialOrder = location.state?.order || savedOrder(trackingCode);
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

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
    const status = order?.trangThaiGiaoHang;
    if (!order || isDeliveryFinished(status)) return undefined;
    const timer = window.setInterval(() => loadOrder({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  const steps = useMemo(() => {
    const paymentMethod = String(order?.phuongThucThanhToan || '').toUpperCase();
    if (paymentMethod !== 'VIETQR') return BASE_STEPS;
    return [BASE_STEPS[0], VIETQR_PAYMENT_STEP, ...BASE_STEPS.slice(1)];
  }, [order?.phuongThucThanhToan]);

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
        <DeliveryPublicHeader compact />
        <section className="delivery-public-container delivery-lookup-single">
          <Link to="/delivery/lookup"><ArrowLeft size={18} /> Tra cứu đơn khác</Link>
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
  const canCancel = status === 'CHO_XAC_NHAN' || (status === 'CHO_THANH_TOAN' && paymentStatus === 'CHO_THANH_TOAN');
  const showQrButton = String(order.phuongThucThanhToan || '').toUpperCase() === 'VIETQR'
    && status === 'CHO_THANH_TOAN'
    && paymentStatus === 'CHO_THANH_TOAN';
  const failureReason = order.lyDoTuChoi || order.lyDoGiaoThatBai;

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader compact />
      <section className="delivery-public-container delivery-tracking-page">
        <div className="delivery-tracking-top">
          <div>
            <Link to="/delivery"><ArrowLeft size={18} /> Tiếp tục đặt món</Link>
            <span>Theo dõi giao hàng</span>
            <h1>Đơn <button type="button" onClick={() => copyText(order.maDonHangHienThi, 'Đã sao chép mã đơn.')}>{order.maDonHangHienThi}<Copy size={16} /></button></h1>
            <p>Đặt lúc {formatDate(order.thoiGianDat)} · Tự động cập nhật mỗi 15 giây</p>
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
                  <div key={`${item.maMonAn}-${item.ghiChu || ''}-${index}`}><span>{item.soLuong}×</span><div><strong>{item.tenMonAn}</strong><small>{progressText(item)}</small>{item.ghiChu ? <em>{item.ghiChu}</em> : null}</div><b>{formatMoney(item.thanhTien)}</b></div>
                ))}
              </div>
            </section>

            <section className="delivery-info-card">
              <div className="delivery-info-title"><MapPin size={20} /><div><h2>Thông tin nhận hàng</h2><p>{deliveryAreaLabel(order.khuVucGiaoHang)}</p></div></div>
              <div className="delivery-recipient-grid">
                <p><UserRound size={17} /><span><small>Người nhận</small><strong>{order.tenNguoiNhan}</strong></span></p>
                <p><Phone size={17} /><span><small>Số điện thoại</small><strong>{order.soDienThoaiNhanChe}</strong></span></p>
                <p className="wide"><MapPin size={17} /><span><small>Địa chỉ</small><strong>{order.diaChiGiaoHang}</strong></span></p>
                {order.googleMaps && order.quangDuongMet ? <p><Truck size={17} /><span><small>Quãng đường Google Maps</small><strong>{formatDistanceMeters(order.quangDuongMet)}</strong></span></p> : null}
                {order.googleMaps && order.thoiGianDuKienGiay ? <p><Clock3 size={17} /><span><small>Thời gian di chuyển dự kiến</small><strong>{formatDurationSeconds(order.thoiGianDuKienGiay)}</strong></span></p> : null}
                {order.ghiChuGiaoHang ? <p className="wide"><Clock3 size={17} /><span><small>Ghi chú giao hàng</small><strong>{order.ghiChuGiaoHang}</strong></span></p> : null}
              </div>
            </section>

            {order.maVanChuyen ? (
              <section className="delivery-info-card">
                <div className="delivery-info-title"><PackageCheck size={20} /><div><h2>Thông tin vận chuyển</h2><p>GrabExpress (Demo) có thể điều phối tài xế khi bếp gần hoàn tất; chỉ bàn giao sau khi toàn bộ món sẵn sàng</p></div></div>
                <div className="delivery-recipient-grid">
                  <p><PackageCheck size={17} /><span><small>Mã vận đơn</small><strong><button type="button" onClick={() => copyText(order.maVanChuyen, 'Đã sao chép mã vận đơn.')}>{order.maVanChuyen} <Copy size={14} /></button></strong></span></p>
                  <p><Truck size={17} /><span><small>Đơn vị vận chuyển</small><strong>{order.donViVanChuyen || 'GrabExpress (Demo) đang điều phối'}</strong></span></p>
                  {order.tenNguoiGiao ? <p><UserRound size={17} /><span><small>Tài xế</small><strong>{order.tenNguoiGiao}</strong></span></p> : null}
                  {order.soDienThoaiNguoiGiaoChe ? <p><Phone size={17} /><span><small>Liên hệ tài xế</small><strong>{order.soDienThoaiNguoiGiaoChe}</strong></span></p> : null}
                  {order.trangThaiDoiTac ? <p><Truck size={17} /><span><small>Đối tác cập nhật</small><strong>{deliveryStatusLabel(order.trangThaiDoiTac)}</strong></span></p> : null}
                  {order.lyDoDoiTac ? <p className="wide"><AlertTriangle size={17} /><span><small>Phản hồi đối tác</small><strong>{order.lyDoDoiTac}</strong></span></p> : null}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="delivery-payment-card">
            <div className="delivery-info-title"><CreditCard size={20} /><div><h2>Thanh toán</h2><p>{order.phuongThucThanhToan === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Thanh toán khi nhận hàng'}</p></div></div>
            <div className="delivery-payment-status"><span className={deliveryStatusClass(order.trangThaiThanhToan)}>{deliveryPaymentLabel(order.trangThaiThanhToan)}</span></div>
            <div className="delivery-track-money"><p><span>Tạm tính</span><strong>{formatMoney(order.tamTinh)}</strong></p><p><span>Giảm giá</span><strong>-{formatMoney(order.tienGiam)}</strong></p><p><span>Phí giao hàng</span><strong>{formatMoney(order.phiGiaoHang)}</strong></p>{Number(order.soTienDaHoan || 0) > 0 ? <p><span>Đã hoàn tiền</span><strong>{formatMoney(order.soTienDaHoan)}</strong></p> : null}{Number(order.soTienCanHoan || 0) > 0 ? <p><span>Đang chờ hoàn</span><strong>{formatMoney(order.soTienCanHoan)}</strong></p> : null}<div><span>Tổng cộng</span><strong>{formatMoney(order.tongThanhToan)}</strong></div></div>

            {status === 'CHO_THANH_TOAN' && order.thoiGianHetHanThanhToan ? <div className="delivery-eta warning"><Clock3 size={19} /><span><small>Hạn thanh toán VietQR</small><strong>{formatDate(order.thoiGianHetHanThanhToan)}</strong></span></div> : null}
            {paymentStatus === 'CHO_HOAN_TIEN' ? <div className="delivery-refund-notice"><AlertTriangle size={18} /><span>Nhà hàng đang hoàn {formatMoney(order.soTienCanHoan)}. Trạng thái sẽ cập nhật sau khi thu ngân xác nhận giao dịch hoàn tiền.</span></div> : null}

            {order.thoiGianSanSang ? <div className="delivery-eta"><Clock3 size={19} /><span><small>Sẵn sàng bàn giao</small><strong>{formatDate(order.thoiGianSanSang)}</strong></span></div> : null}
            {order.thoiGianBanGiao ? <div className="delivery-eta"><Truck size={19} /><span><small>Đã bàn giao</small><strong>{formatDate(order.thoiGianBanGiao)}</strong></span></div> : null}
            {order.thoiGianGiaoThanhCong ? <div className="delivery-eta"><Check size={19} /><span><small>Giao thành công</small><strong>{formatDate(order.thoiGianGiaoThanhCong)}</strong></span></div> : null}

            {showQrButton ? <button className="delivery-qr-button" type="button" onClick={generateQr} disabled={qrLoading}>{qrLoading ? <LoaderCircle className="spin" size={18} /> : <CreditCard size={18} />} Tạo mã VietQR</button> : null}
            {qr ? <div className="delivery-qr-box"><img src={qr.qrUrl} alt="Mã VietQR thanh toán đơn giao hàng" /><strong>{formatMoney(qr.amount)}</strong><small>{qr.bankName} · {qr.accountNo}</small><small>Nội dung: {qr.addInfo}</small></div> : null}

            {canCancel ? (
              <div className="delivery-cancel-box"><strong>Cần hủy đơn?</strong><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Nhập lý do hủy trước khi bếp tiếp nhận" /><button type="button" onClick={cancelOrder} disabled={canceling}>{canceling ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />} Hủy đơn</button></div>
            ) : null}

            <a className="delivery-support-phone" href={`tel:${import.meta.env.VITE_RESTAURANT_PHONE || '0979792909'}`}><Phone size={18} /> Liên hệ nhà hàng</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
