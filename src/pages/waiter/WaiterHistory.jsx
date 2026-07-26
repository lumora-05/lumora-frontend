import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { itemCount, orderCreatedAt, orderId, statusMeta, tableNameOfOrder, unwrapList } from '../../utils/waiterData';

const FINAL_STATUSES = ['DA_THANH_TOAN', 'DA_HUY'];

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function WaiterHistory() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    orderApi.getAll().then((response) => setOrders(unwrapList(response))).catch((error) => toast.error(errorMessageOf(error, 'Không tải được lịch sử đơn hàng')));
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return orders
      .filter((order) => FINAL_STATUSES.includes(order.trangThai))
      .filter((order) => status === 'ALL' || order.trangThai === status)
      .filter((order) => !q || `${orderId(order) || ''} ${tableNameOfOrder(order)}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(orderCreatedAt(b) || 0) - new Date(orderCreatedAt(a) || 0));
  }, [orders, keyword, status]);

  useEffect(() => { setPage(0); }, [keyword, status, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const rows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <section className="waiter-page">
      <div className="waiter-card waiter-history-card">
        <div className="waiter-history-toolbar">
          <div><h3>Đơn đã kết thúc</h3><p>Chỉ hiển thị các đơn đã thanh toán hoặc đã hủy.</p></div>
          <div className="waiter-history-filters">
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="DA_THANH_TOAN">Đã thanh toán</option><option value="DA_HUY">Đã hủy</option></select>
            <label className="waiter-search"><Search size={18} /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm mã đơn, bàn..." /></label>
          </div>
        </div>
        <div className="waiter-orders-table-wrap">
          <table className="waiter-orders-table">
            <thead><tr><th>STT</th><th>Mã đơn</th><th>Bàn</th><th>Thời gian</th><th>Số món</th><th>Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {rows.map((order, index) => {
                const meta = statusMeta(order.trangThai);
                return <tr key={orderId(order)}><td>{safePage * pageSize + index + 1}</td><td><strong>#{orderId(order)}</strong></td><td>{tableNameOfOrder(order)}</td><td>{formatDateTime(orderCreatedAt(order))}</td><td>{itemCount(order)}</td><td>{formatMoney(order.tongTien || 0)}</td><td><span className={`waiter-status-badge ${meta.tone}`}>{meta.label}</span></td><td><Link className="waiter-monitor-view" to={`/waiter/orders/${orderId(order)}?readonly=1`}><Eye size={17}/><span>Xem</span></Link></td></tr>;
              })}
              {!rows.length ? <tr><td colSpan="8" className="waiter-empty-cell">Không có lịch sử phù hợp.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="waiter-history-pagination">
          <span>Hiển thị {filtered.length ? safePage * pageSize + 1 : 0}–{Math.min((safePage + 1) * pageSize, filtered.length)} trong {filtered.length} đơn</span>
          <div><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value="8">8 / trang</option><option value="10">10 / trang</option><option value="20">20 / trang</option></select><button disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={17}/></button><b>{safePage + 1}/{totalPages}</b><button disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}><ChevronRight size={17}/></button></div>
        </div>
      </div>
    </section>
  );
}
