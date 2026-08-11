import { useEffect, useMemo, useState } from 'react';
import { BellRing, Bike, Clock3, RefreshCw, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { deliveryApi } from '../../api/deliveryApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatMoney } from '../../utils/formatMoney';
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
  unwrapDeliveryList,
} from '../../utils/delivery';

export default function CashierNotifications() {
  const [orders, setOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const event = useWebSocket(['/topic/cashier', '/topic/orders', '/topic/payments']);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [paymentResponse, deliveryResponse] = await Promise.all([
        orderApi.getAll(),
        deliveryApi.list('ALL'),
      ]);
      setOrders(unwrap(paymentResponse));
      setDeliveryOrders(unwrapDeliveryList(deliveryResponse));
    } catch {
      setError('Không tải được thông báo công việc của thu ngân.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (['/topic/cashier', '/topic/orders', '/topic/payments'].includes(event?.topic)) load();
  }, [event]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const waiting = useMemo(() => orders
    .filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai))
    .sort((a, b) => new Date(paymentRequestTimeOf(a) || 0) - new Date(paymentRequestTimeOf(b) || 0)), [orders]);

  const activeDeliveries = useMemo(() => deliveryOrders
    .filter((order) => !['HOAN_THANH', 'DA_HUY'].includes(String(deliveryData(order)?.trangThaiGiaoHang || '').toUpperCase()))
    .sort((a, b) => new Date(a?.thoiGianDat || 0) - new Date(b?.thoiGianDat || 0)), [deliveryOrders]);

  return (
    <section className="page cashier-page cashier-workspace">
      <div className="cashier-page-heading cashier-page-heading-actions">
        <button type="button" className="cashier-reload-button" onClick={load} disabled={loading}><RefreshCw size={17} />Tải lại</button>
      </div>

      {error ? <div className="cashier-load-error"><span>{error}</span><button type="button" onClick={load}>Thử lại</button></div> : null}

      <div className="cashier-notification-list">
        {loading ? <div className="cashier-table-empty cashier-loading-card">Đang tải thông báo...</div> : waiting.length === 0 && activeDeliveries.length === 0 ? (
          <div className="cashier-notification-empty"><BellRing size={34} /><strong>Không có công việc mới</strong><span>Hiện chưa có yêu cầu thanh toán hoặc đơn online cần theo dõi.</span></div>
        ) : waiting.map((order) => {
          const id = orderIdOf(order);
          const elapsed = elapsedInfo(paymentRequestTimeOf(order), now);
          return (
            <article key={id} className={`cashier-notification-card ${elapsed.tone}`}>
              <div className="cashier-notification-icon"><WalletCards size={22} /></div>
              <div className="cashier-notification-content">
                <div><strong>{tableNameOf(order)} yêu cầu thanh toán</strong><span>{documentCode(order)}</span></div>
                <p>Tổng tiền tạm tính: <b>{formatMoney(totalOf(order))}</b></p>
                <small><Clock3 size={14} />{elapsed.label}</small>
              </div>
              <Link to={`/cashier/payment/${id}`}>Xử lý thanh toán</Link>
            </article>
          );
        })}

        {!loading && activeDeliveries.map((order) => {
          const delivery = deliveryData(order);
          const status = String(delivery?.trangThaiGiaoHang || '').toUpperCase();
          return (
            <article key={`delivery-${order?.maDonHang ?? order?.id}`} className="cashier-notification-card">
              <div className="cashier-notification-icon"><Bike size={22} /></div>
              <div className="cashier-notification-content">
                <div><strong>Đơn giao hàng {displayOrderCode(order)}</strong><span>{deliveryStatusLabel(status)}</span></div>
                <p>{delivery?.tenNguoiNhan || 'Khách nhận'} · <b>{formatMoney(order?.tongTien)}</b></p>
                <small><Clock3 size={14} />Thu ngân theo dõi và xử lý thanh toán, bàn giao hoặc ngoại lệ khi cần.</small>
              </div>
              <Link to="/cashier/delivery-orders">Theo dõi đơn</Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
