import { AlertTriangle, BellRing, Clock3, Flame } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  canonicalKitchenStatus,
  flattenKitchenOrders,
  formatKitchenWait,
  kitchenCallNumber,
  kitchenItemId,
  kitchenItemName,
  kitchenOrderId,
  kitchenOrderedAt,
  kitchenTableName,
  kitchenWaitMinutes,
  unwrapList,
} from '../../utils/kitchenData';

export default function KitchenNotifications() {
  const toast = useToast();
  const event = useWebSocket(['/topic/kitchen', '/topic/orders']);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await orderApi.getKitchenActive();
      setItems(flattenKitchenOrders(unwrapList(response)));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được thông báo bếp'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (event?.topic === '/topic/kitchen' || event?.topic === '/topic/orders') load(false);
  }, [event]);

  const alerts = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const key = `${kitchenOrderId(item)}-${kitchenCallNumber(item)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    return [...groups.values()]
      .map((list) => {
        const first = list[0];
        const waiting = list.filter((item) => canonicalKitchenStatus(item) === 'CHO_BEP');
        const cooking = list.filter((item) => canonicalKitchenStatus(item) === 'DANG_NAU');
        const minutes = kitchenWaitMinutes(kitchenOrderedAt(first), now);
        if (!waiting.length && !cooking.length) return null;
        const overdue = minutes >= 15;
        return {
          key: `${kitchenOrderId(first)}-${kitchenCallNumber(first)}`,
          first,
          waiting,
          cooking,
          overdue,
          minutes,
          totalParts: list.reduce((sum, item) => sum + Number(item?.soLuong || 1), 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.minutes - a.minutes);
  }, [items, now]);

  return (
    <section className="kitchen-page">
      <div className="kitchen-notification-head">
        <div><h2>Thông báo vận hành</h2><p>Dữ liệu được cập nhật theo tình trạng thực tế của bếp</p></div>
        <span><BellRing size={18} />{alerts.length} phiếu cần theo dõi</span>
      </div>

      <div className="kitchen-notification-list dynamic">
        {loading ? <div className="kitchen-list-empty">Đang tải thông báo...</div> : null}
        {!loading && alerts.map(({ key, first, waiting, cooking, overdue, totalParts }) => {
          const call = kitchenCallNumber(first);
          return (
            <article key={key} className={overdue ? 'urgent' : ''}>
              <span className={`notification-icon ${overdue ? 'red' : waiting.length ? 'orange' : 'blue'}`}>
                {overdue ? <AlertTriangle size={21} /> : waiting.length ? <BellRing size={21} /> : <Flame size={21} />}
              </span>
              <div className="kitchen-notification-content">
                <div>
                  <h3>{overdue ? 'Phiếu đang chờ lâu' : waiting.length ? 'Có món chưa bắt đầu' : 'Phiếu đang chế biến'}</h3>
                  <span className={overdue ? 'urgent' : ''}><Clock3 size={14} />{formatKitchenWait(kitchenOrderedAt(first), now)}</span>
                </div>
                <p><b>{kitchenTableName(first)}</b> · Đơn #{kitchenOrderId(first)} · {call > 1 ? `Lượt gọi thêm #${call}` : 'Lượt gọi đầu'}</p>
                <small>
                  {waiting.length ? `${waiting.length} món mới` : ''}
                  {waiting.length && cooking.length ? ' · ' : ''}
                  {cooking.length ? `${cooking.length} món đang chế biến` : ''}
                  {` · ${totalParts} phần`}
                </small>
                {waiting.length <= 3 && waiting.length > 0 ? <em>{waiting.map(kitchenItemName).join(', ')}</em> : null}
              </div>
              <Link to={`/kitchen/orders/${kitchenOrderId(first)}?call=${call}`}>Xử lý ngay</Link>
            </article>
          );
        })}
        {!loading && !alerts.length ? <div className="kitchen-notification-empty"><BellRing size={28} /><h3>Không có phiếu cần cảnh báo</h3><p>Tất cả món hiện đã được xử lý.</p></div> : null}
      </div>
    </section>
  );
}
