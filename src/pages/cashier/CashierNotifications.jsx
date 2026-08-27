import { useEffect, useMemo, useState } from 'react';
import { BellRing, Bike, CalendarCheck2, Clock3, PackageCheck, RefreshCw, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deliveryApi } from '../../api/deliveryApi';
import { orderApi } from '../../api/orderApi';
import { reservationApi } from '../../api/reservationApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatMoney } from '../../utils/formatMoney';
import { normalizePage } from '../../utils/pagination';
import {
  currentLocalDate,
  reservationDateTime,
  reservationPreorderChangedAfterApproval,
  reservationPreorderNeedsReview,
  reservationStatus,
} from '../../utils/reservations';
import {
  PAYMENT_REQUEST_STATUSES,
  documentCode,
  elapsedInfo,
  orderIdOf,
  paymentRequestTimeOf,
  tableNameOf,
  totalOf,
  unwrap,
} from '../../utils/cashier';
import {
  deliveryData,
  deliveryStatusLabel,
  displayOrderCode,
  isCashierDeliveryAttention,
  unwrapDeliveryList,
} from '../../utils/delivery';

function onlineStatus(order) {
  return String(deliveryData(order)?.trangThaiGiaoHang || '').toUpperCase();
}

function onlineAttentionTime(order) {
  const status = onlineStatus(order);
  if (['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'CHO_KHACH_NHAN'].includes(status)) {
    return order?.thoiGianSanSang || order?.thoiGianCapNhat || order?.thoiGianDat;
  }
  return order?.thoiGianDat || order?.thoiGianCapNhat;
}

function onlineWorkText(order) {
  const status = onlineStatus(order);
  const code = displayOrderCode(order);
  if (status === 'CHO_THANH_TOAN') return `${code} mới · đang chờ khách thanh toán VietQR`;
  if (status === 'CHO_XAC_NHAN') return `${code} mới · cần kiểm tra và xác nhận`;
  if (status === 'CHO_KHACH_NHAN') return `${code} đã sẵn sàng để khách đến lấy`;
  if (['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO'].includes(status)) return `${code} đã sẵn sàng bàn giao cho tài xế`;
  return `${code} · ${deliveryStatusLabel(status)}`;
}

function onlinePriority(order) {
  const status = onlineStatus(order);
  if (['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'CHO_KHACH_NHAN'].includes(status)) return 0;
  if (status === 'CHO_XAC_NHAN') return 1;
  return 2;
}

export default function CashierNotifications() {
  const [orders, setOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const event = useWebSocket(['/topic/cashier', '/topic/orders', '/topic/payments', '/topic/cashier/reservations']);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [orderResponse, deliveryResponse, pendingReservationResponse, activeReservationResponse] = await Promise.all([
        orderApi.getAll(),
        deliveryApi.list('ALL'),
        reservationApi.list({ status: 'CHO_XAC_NHAN', page: 0, size: 20 }),
        reservationApi.list({ from: currentLocalDate(), page: 0, size: 100 }),
      ]);
      setOrders(unwrap(orderResponse));
      setDeliveryOrders(unwrapDeliveryList(deliveryResponse));
      const pendingReservations = normalizePage(pendingReservationResponse, 20).content;
      const preorderReviews = normalizePage(activeReservationResponse, 100).content
        .filter((item) => reservationStatus(item) !== 'CHO_XAC_NHAN' && reservationPreorderNeedsReview(item));
      const seen = new Set();
      setReservations([...preorderReviews, ...pendingReservations].filter((item) => {
        const key = item?.maDatBan ?? item?.maTraCuu;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    } catch {
      setError('Không tải được thông báo công việc của thu ngân.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (['/topic/cashier', '/topic/orders', '/topic/payments', '/topic/cashier/reservations'].includes(event?.topic)) load();
  }, [event]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const waiting = useMemo(() => orders
    .filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai))
    .sort((a, b) => new Date(paymentRequestTimeOf(a) || 0) - new Date(paymentRequestTimeOf(b) || 0)), [orders]);

  const onlineWaiting = useMemo(() => deliveryOrders
    .filter(isCashierDeliveryAttention)
    .sort((a, b) => {
      const priority = onlinePriority(a) - onlinePriority(b);
      if (priority !== 0) return priority;
      return new Date(onlineAttentionTime(b) || 0) - new Date(onlineAttentionTime(a) || 0);
    }), [deliveryOrders]);

  const hasWork = waiting.length > 0 || onlineWaiting.length > 0 || reservations.length > 0;

  return (
    <section className="page cashier-page cashier-workspace">
      <div className="cashier-page-heading cashier-page-heading-actions">
        <button type="button" className="cashier-reload-button" onClick={load} disabled={loading}><RefreshCw size={17} />Tải lại</button>
      </div>

      {error ? <div className="cashier-load-error"><span>{error}</span><button type="button" onClick={load}>Thử lại</button></div> : null}

      <div className="cashier-notification-list">
        {loading ? <div className="cashier-table-empty cashier-loading-card">Đang tải thông báo...</div> : null}

        {!loading && !hasWork ? (
          <div className="cashier-notification-empty"><BellRing size={34} /><strong>Không có công việc mới</strong><span>Hiện chưa có yêu cầu thanh toán, đơn online hoặc đặt bàn cần xử lý.</span></div>
        ) : null}

        {!loading ? reservations.map((reservation) => {
          const changedAfterApproval = reservationPreorderChangedAfterApproval(reservation);
          const preorderReview = reservationPreorderNeedsReview(reservation);
          const attentionTime = changedAfterApproval
            ? reservation?.thoiGianThayDoiDatMonTruoc
            : preorderReview ? reservation?.thoiGianDatMonTruoc : reservation?.thoiGianTao;
          const elapsed = elapsedInfo(attentionTime, now);
          const title = changedAfterApproval
            ? `Khách vừa thay đổi món ${reservation?.maTraCuu || ''} · cần duyệt lại`
            : preorderReview
              ? `Thực đơn ${reservation?.maTraCuu || ''} đang chờ duyệt`
              : `Đặt bàn ${reservation?.maTraCuu || ''} đang chờ xác nhận`;
          return (
            <article key={`reservation-${reservation?.maDatBan || reservation?.maTraCuu}`} className={`cashier-notification-card ${changedAfterApproval ? 'urgent' : elapsed.tone}`}>
              <div className="cashier-notification-icon"><CalendarCheck2 size={22} /></div>
              <div className="cashier-notification-content">
                <div><strong>{title}</strong><span>{reservationDateTime(reservation?.ngayGioDen)}</span></div>
                <p>{reservation?.hoTenKhach || 'Khách hàng'} · {reservation?.soLuongKhach || 0} khách{reservation?.khuVucMongMuon ? ` · ${reservation.khuVucMongMuon}` : ''}</p>
                <small><Clock3 size={14} />{elapsed.label}</small>
              </div>
              <Link to="/cashier/reservations">{preorderReview ? 'Duyệt thực đơn' : 'Xử lý đặt bàn'}</Link>
            </article>
          );
        }) : null}

        {!loading ? onlineWaiting.map((order) => {
          const status = onlineStatus(order);
          const ready = ['CHO_TAI_XE_NHAN', 'CHO_BAN_GIAO', 'CHO_KHACH_NHAN'].includes(status);
          const elapsed = elapsedInfo(onlineAttentionTime(order), now);
          const delivery = deliveryData(order);
          return (
            <article key={`delivery-${displayOrderCode(order)}`} className={`cashier-notification-card ${ready ? 'urgent' : elapsed.tone}`}>
              <div className="cashier-notification-icon">{ready ? <PackageCheck size={22} /> : <Bike size={22} />}</div>
              <div className="cashier-notification-content">
                <div><strong>{onlineWorkText(order)}</strong><span>{deliveryStatusLabel(status)}</span></div>
                <p>{delivery?.tenNguoiNhan ? `${delivery.tenNguoiNhan} · ` : ''}Tổng tiền: <b>{formatMoney(order?.tongTien)}</b></p>
                <small><Clock3 size={14} />{elapsed.label}</small>
              </div>
              <Link to="/cashier/delivery-orders">Xử lý đơn online</Link>
            </article>
          );
        }) : null}

        {!loading ? waiting.map((order) => {
          const id = orderIdOf(order);
          const elapsed = elapsedInfo(paymentRequestTimeOf(order), now);
          return (
            <article key={`payment-${id}`} className={`cashier-notification-card ${elapsed.tone}`}>
              <div className="cashier-notification-icon"><WalletCards size={22} /></div>
              <div className="cashier-notification-content">
                <div><strong>{tableNameOf(order)} yêu cầu thanh toán</strong><span>{documentCode(order)}</span></div>
                <p>Tổng tiền tạm tính: <b>{formatMoney(totalOf(order))}</b></p>
                <small><Clock3 size={14} />{elapsed.label}</small>
              </div>
              <Link to={`/cashier/payment/${id}`}>Xử lý thanh toán</Link>
            </article>
          );
        }) : null}
      </div>
    </section>
  );
}
