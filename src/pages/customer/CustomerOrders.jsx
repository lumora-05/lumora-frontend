import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, LoaderCircle, RefreshCw, UtensilsCrossed } from 'lucide-react';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { orderApi } from '../../api/orderApi';
import { tableApi } from '../../api/tableApi';
import { useWebSocket } from '../../hooks/useWebSocket';

function unwrapList(response) {
  const data = response?.data ?? response;
  return Array.isArray(data) ? data : [];
}

function toTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return date.getTime();
}

export default function CustomerOrders() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedTableId, setResolvedTableId] = useState(null);
  const tableTopic = resolvedTableId ? `/topic/customer/tables/${resolvedTableId}` : '';
  const socketEvent = useWebSocket([tableTopic || '/topic/customer/tables/pending']);

  const load = useCallback(async () => {
    try {
      setError('');
      const [tableResponse, orderResponse] = await Promise.all([
        tableApi.customerTableByQrToken(qrToken),
        orderApi.customerOpenOrdersByQrToken(qrToken)
      ]);
      const tableData = tableResponse?.data ?? tableResponse;
      const table = tableData?.banAn ?? tableData?.table;
      setResolvedTableId(table?.maBan ?? table?.id ?? null);
      const orders = unwrapList(orderResponse)
        .filter(Boolean)
        .sort((a, b) => toTime(b?.thoiGianDat || b?.createdAt) - toTime(a?.thoiGianDat || a?.createdAt));
      const current = orders[0];
      const id = current?.maDonHang ?? current?.id;
      if (id) {
        navigate(`/table/${qrToken}/orders/${id}`, { replace: true });
        return;
      }
    } catch (err) {
      setError(err?.message || 'Không thể tải đơn hàng đang phục vụ của bàn này.');
    } finally {
      setLoading(false);
    }
  }, [navigate, qrToken]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (socketEvent?.topic === tableTopic) load();
  }, [socketEvent, tableTopic, load]);

  return (
    <main className="customer-flow-page customer-menu-bg-page">
      <CustomerHeader />
      <section className="customer-orders-landing">
        {loading ? (
          <div className="customer-menu-access-state">
            <LoaderCircle className="spin" size={32} />
            <h2>Đang tải đơn hàng...</h2>
          </div>
        ) : error ? (
          <div className="customer-menu-access-state error">
            <RefreshCw size={34} />
            <h2>Chưa thể tải đơn hàng</h2>
            <p>{error}</p>
            <button type="button" onClick={load}>Thử lại</button>
          </div>
        ) : (
          <section className="customer-empty-card">
            <span><ClipboardList size={38} /></span>
            <h2>Chưa có đơn hàng</h2>
            <p>Các món trong giỏ chỉ trở thành đơn hàng sau khi bạn nhấn gửi đơn.</p>
            <Link to={`/table/${qrToken}`}><UtensilsCrossed size={19} /> Xem thực đơn</Link>
          </section>
        )}
      </section>
    </main>
  );
}
