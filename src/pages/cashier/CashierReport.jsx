import { useEffect, useMemo, useState } from 'react';
import { Banknote, FileCheck2, ReceiptText, Search } from 'lucide-react';
import { orderApi } from '../../api/orderApi';
import { formatMoney } from '../../utils/formatMoney';
import {
  PAID_STATUSES,
  documentCode,
  localDateValue,
  paymentTimeOf,
  tableNameOf,
  dateTimeText,
  totalOf,
  unwrap,
} from '../../utils/cashier';

const PAGE_SIZE = 10;

export default function CashierReport() {
  const [orders, setOrders] = useState([]);
  const [date, setDate] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await orderApi.getAll();
      setOrders(unwrap(response));
    } catch {
      setError('Không tải được dữ liệu báo cáo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [date, query]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders
      .filter((order) => PAID_STATUSES.includes(order?.trangThai))
      .filter((order) => !date || localDateValue(paymentTimeOf(order)) === date)
      .filter((order) => !keyword || `${documentCode(order)} ${tableNameOf(order)}`.toLowerCase().includes(keyword))
      .sort((a, b) => new Date(paymentTimeOf(b) || 0) - new Date(paymentTimeOf(a) || 0));
  }, [orders, date, query]);

  const revenue = rows.reduce((sum, order) => sum + totalOf(order), 0);
  const average = rows.length ? revenue / rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="page cashier-page cashier-workspace">
      <div className="cashier-filterbar cashier-report-filterbar">
        <label className="cashier-search cashier-search-wide"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hóa đơn hoặc bàn..." /></label>
        <input className="cashier-date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      {error ? <div className="cashier-load-error"><span>{error}</span><button type="button" onClick={load}>Thử lại</button></div> : null}

      <div className="cashier-report-stats">
        <article><ReceiptText /><div><span>Hóa đơn đã thanh toán</span><strong>{rows.length}</strong></div></article>
        <article><Banknote /><div><span>Doanh thu</span><strong>{formatMoney(revenue)}</strong></div></article>
        <article><FileCheck2 /><div><span>Giá trị trung bình</span><strong>{formatMoney(average)}</strong></div></article>
      </div>

      <div className="cashier-invoice-card">
        <div className="cashier-report-title"><h2>Giao dịch đã hoàn tất</h2></div>
        <div className="cashier-table-scroll">
          <table className="cashier-invoice-table">
            <thead><tr><th>Mã hóa đơn</th><th>Bàn</th><th>Thời gian thanh toán</th><th>Tổng tiền</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="4" className="cashier-table-empty">Đang tải dữ liệu...</td></tr> : pageRows.length === 0 ? <tr><td colSpan="4" className="cashier-table-empty">Chưa có giao dịch phù hợp.</td></tr> : pageRows.map((order) => (
                <tr key={order?.maDonHang || order?.id}>
                  <td><strong className="cashier-invoice-code">{documentCode(order)}</strong></td>
                  <td>{tableNameOf(order)}</td>
                  <td>{dateTimeText(paymentTimeOf(order))}</td>
                  <td><strong>{formatMoney(totalOf(order))}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cashier-table-footer">
          <span>Hiển thị {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, rows.length)} trong {rows.length} giao dịch</span>
          <div className="cashier-pagination">
            <button disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
            <span>Trang {safePage}/{totalPages}</span>
            <button disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
