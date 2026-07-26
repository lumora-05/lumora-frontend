import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import {
  canonicalKitchenStatus,
  flattenKitchenOrders,
  formatKitchenDate,
  formatKitchenTime,
  kitchenCallNumber,
  kitchenOrderId,
  kitchenOrderedAt,
  kitchenTableName,
  unwrapList,
} from '../../utils/kitchenData';

const PAGE_SIZE = 10;

export default function KitchenHistory() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    orderApi.getAll()
      .then((response) => setItems(flattenKitchenOrders(unwrapList(response), { includeClosed: true })))
      .catch((error) => toast.error(errorMessageOf(error, 'Không tải được lịch sử chế biến')))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = `${kitchenOrderId(item)}-${kitchenCallNumber(item)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });

    const q = keyword.trim().toLowerCase();
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return [...map.entries()]
      .map(([key, list]) => ({ key, list, first: list[0] }))
      .filter(({ list }) => list.length > 0 && list.every((item) => canonicalKitchenStatus(item) === 'HOAN_THANH'))
      .filter(({ first }) => {
        if (!q) return true;
        return `${kitchenOrderId(first)} ${kitchenTableName(first)} ${kitchenCallNumber(first)}`.toLowerCase().includes(q);
      })
      .filter(({ first }) => {
        const time = new Date(kitchenOrderedAt(first) || 0).getTime();
        return (!fromTime || time >= fromTime) && (!toTime || time <= toTime);
      })
      .sort((a, b) => new Date(kitchenOrderedAt(b.first) || 0) - new Date(kitchenOrderedAt(a.first) || 0));
  }, [items, keyword, fromDate, toDate]);

  useEffect(() => setPage(1), [keyword, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section className="kitchen-page">
      <div className="kitchen-card kitchen-history-card">
        <div className="kitchen-history-heading">
          <div className="kitchen-section-intro completed">
            <span><CheckCircle2 size={20} /></span>
            <div><h3>Phiếu đã hoàn thành</h3><p>{rows.length} phiếu bếp đã được xử lý xong</p></div>
          </div>
          <div className="kitchen-history-filters">
            <label className="kitchen-modern-search"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm bàn hoặc mã đơn..." /></label>
            <label className="kitchen-date-filter"><span>Từ ngày</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label className="kitchen-date-filter"><span>Đến ngày</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
          </div>
        </div>

        <div className="kitchen-table-scroll">
          <table className="kitchen-list-table kitchen-history-table kitchen-action-table">
            <thead><tr><th>Mã đơn</th><th>Bàn</th><th>Lượt gọi</th><th>Số món</th><th>Ngày</th><th>Thời gian</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="kitchen-table-empty">Đang tải lịch sử chế biến...</td></tr> : null}
              {!loading && pagedRows.map(({ key, list, first }) => {
                const call = kitchenCallNumber(first);
                return (
                  <tr key={key}>
                    <td data-label="Mã đơn"><b>#{kitchenOrderId(first)}</b></td>
                    <td data-label="Bàn">{kitchenTableName(first)}</td>
                    <td data-label="Lượt gọi">{call > 1 ? `Gọi thêm #${call}` : 'Lượt đầu'}</td>
                    <td data-label="Số món">{list.reduce((sum, item) => sum + Number(item?.soLuong || 1), 0)}</td>
                    <td data-label="Ngày"><span className="kitchen-time-cell"><CalendarDays size={15} />{formatKitchenDate(kitchenOrderedAt(first))}</span></td>
                    <td data-label="Thời gian">{formatKitchenTime(kitchenOrderedAt(first))}</td>
                    <td data-label="Thao tác"><Link className="kitchen-table-action" to={`/kitchen/orders/${kitchenOrderId(first)}?call=${call}&readonly=1`}>Xem chi tiết <ChevronRight size={16} /></Link></td>
                  </tr>
                );
              })}
              {!loading && !pagedRows.length ? <tr><td colSpan="7" className="kitchen-table-empty">Chưa có lịch sử phù hợp.</td></tr> : null}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 ? (
          <div className="kitchen-history-pagination">
            <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, rows.length)} trong {rows.length} phiếu</span>
            <div>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={17} />Trước</button>
              <strong>{currentPage}/{pageCount}</strong>
              <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Sau<ChevronRight size={17} /></button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
