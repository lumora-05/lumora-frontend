import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock3, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import {
  CLOSED_ORDER_STATUSES,
  formatKitchenTime,
  kitchenOrderId,
  kitchenOrderProgress,
  kitchenOrderedAt,
  kitchenStatusMeta,
  kitchenTableName,
  unwrapList,
} from '../../utils/kitchenData';

const FILTERS = [
  ['ALL', 'Tất cả'],
  ['CHO_BEP', 'Mới'],
  ['DANG_NAU', 'Đang chế biến'],
  ['HOAN_THANH', 'Hoàn thành'],
];

export default function KitchenOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');

  async function load() {
    try {
      const response = await orderApi.getAll();
      setOrders(unwrapList(response).filter((order) => !CLOSED_ORDER_STATUSES.has(String(order?.trangThai || '').toUpperCase())));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được danh sách đơn hàng'));
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orders
      .map((order) => ({ order, progress: kitchenOrderProgress(order) }))
      .filter(({ progress }) => filter === 'ALL' || progress.status === filter)
      .filter(({ order }) => !q || `${kitchenOrderId(order)} ${kitchenTableName(order)}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(kitchenOrderedAt(b.order) || 0) - new Date(kitchenOrderedAt(a.order) || 0));
  }, [orders, keyword, filter]);

  const counts = useMemo(() => orders.reduce((result, order) => {
    const status = kitchenOrderProgress(order).status;
    result.ALL += 1;
    if (result[status] !== undefined) result[status] += 1;
    return result;
  }, { ALL: 0, CHO_BEP: 0, DANG_NAU: 0, HOAN_THANH: 0 }), [orders]);

  return (
    <section className="kitchen-page">
      <div className="kitchen-card kitchen-orders-card">
        <div className="kitchen-list-toolbar">
          <div className="kitchen-queue-tabs">
            {FILTERS.map(([value, label]) => (
              <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                {label}<span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="kitchen-modern-search">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo bàn hoặc mã đơn..." />
          </label>
        </div>

        <div className="kitchen-table-scroll">
          <table className="kitchen-list-table">
            <thead>
              <tr><th>Mã đơn</th><th>Bàn</th><th>Số món</th><th>Tiến độ</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {rows.map(({ order, progress }) => {
                const meta = kitchenStatusMeta(progress.status);
                const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
                return (
                  <tr key={kitchenOrderId(order)}>
                    <td><b>#{kitchenOrderId(order)}</b></td>
                    <td>{kitchenTableName(order)}</td>
                    <td>{progress.total}</td>
                    <td>
                      <div className="kitchen-progress-cell">
                        <span><i style={{ width: `${percent}%` }} /></span>
                        <small>{progress.done}/{progress.total} món hoàn thành</small>
                      </div>
                    </td>
                    <td><span className={`kitchen-state-pill ${meta.tone}`}>{meta.label}</span></td>
                    <td><span className="kitchen-time-cell"><Clock3 size={15} />{formatKitchenTime(kitchenOrderedAt(order))}</span></td>
                    <td><Link className="kitchen-table-action" to={`/kitchen/orders/${kitchenOrderId(order)}`}>Xem chi tiết <ChevronRight size={16} /></Link></td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan="7" className="kitchen-table-empty">Không có đơn hàng phù hợp.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
