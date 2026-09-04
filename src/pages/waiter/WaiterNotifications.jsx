import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { orderCreatedAt, orderGroup, orderId, tableNameOfOrder, unwrapList, waitLabel } from '../../utils/waiterData';

const META = {
  KITCHEN: { icon: ReceiptText, tone: 'blue', title: 'Đơn đã chuyển xuống bếp', text: 'Khách vừa gửi đơn và đơn đã được chuyển đến bếp.' },
  READY: { icon: CheckCircle2, tone: 'green', title: 'Món đã sẵn sàng phục vụ', text: 'Bếp đã hoàn thành món, cần mang ra bàn.' },
  PAYMENT: { icon: CreditCard, tone: 'orange', title: 'Bàn đang chờ thanh toán', text: 'Khách đã yêu cầu thanh toán.' },
};
function notificationGroup(order) {
  const status = String(order?.trangThai || '').toUpperCase();
  if (['CHO_XAC_NHAN', 'DA_XAC_NHAN'].includes(status)) return 'KITCHEN';
  return orderGroup(order);
}

export default function WaiterNotifications() {
  const toast = useToast();
  const event = useWebSocket(['/topic/orders', '/topic/kitchen']);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('ALL');

  async function load() {
    try { setOrders(unwrapList(await orderApi.getWaiterActive())); }
    catch (error) { toast.error(errorMessageOf(error, 'Không tải được thông báo')); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (event?.topic === '/topic/orders' || event?.topic === '/topic/kitchen') load(); }, [event]);

  const notifications = useMemo(() => orders
    .map((order) => ({ order, group: notificationGroup(order) }))
    .filter((item) => META[item.group] && (filter === 'ALL' || item.group === filter))
    .sort((a, b) => new Date(orderCreatedAt(a.order) || 0) - new Date(orderCreatedAt(b.order) || 0)), [orders, filter]);

  return <section className="waiter-page"><div className="waiter-card waiter-notification-page">
    <div className="waiter-order-tabs notification-tabs">{[['ALL','Tất cả'],['KITCHEN','Đơn đã gửi bếp'],['READY','Món sẵn sàng'],['PAYMENT','Chờ thanh toán']].map(([value,label])=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <div className="notification-group"><h3>Thông báo và việc cần xử lý ({notifications.length})</h3>{notifications.map(({order,group})=>{const meta=META[group]; const Icon=meta.icon; return <article key={orderId(order)} className="unread"><span className={`notification-icon ${meta.tone}`}><Icon size={22}/></span><div><h4>{meta.title} · {tableNameOfOrder(order)}</h4><p>{meta.text} Mã đơn #{orderId(order)}.</p></div><time><Clock3 size={14}/> {waitLabel(orderCreatedAt(order))}</time><Link to={`/waiter/orders/${orderId(order)}`}>Xem</Link></article>;})}{!notifications.length?<div className="waiter-queue-empty">Không có thông báo mới.</div>:null}</div>
  </div></section>;
}
