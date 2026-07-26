import { useEffect, useMemo, useState } from 'react';
import { Clock3, Eye, Printer, RefreshCw, Search, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatMoney } from '../../utils/formatMoney';
import {
  CANCELED_STATUSES,
  PAID_STATUSES,
  PAYMENT_REQUEST_STATUSES,
  dateTimeText,
  documentCode,
  elapsedInfo,
  itemCountOf,
  localDateValue,
  orderIdOf,
  paymentRequestTimeOf,
  paymentTimeOf,
  statusInfo,
  tableNameOf,
  totalOf,
  unwrap,
} from '../../utils/cashier';

const PAGE_SIZE = 8;

function paginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const values = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...values].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push(`gap-${value}`);
    result.push(value);
  });
  return result;
}

export default function CashierHome({ mode = 'queue' }) {
  const historyMode = mode === 'history';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const event = useWebSocket(['/topic/cashier', '/topic/orders', '/topic/payments']);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const response = await orderApi.getAll();
      setOrders(unwrap(response));
    } catch {
      setLoadError('Không tải được dữ liệu. Vui lòng kiểm tra kết nối và thử lại.');
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
  useEffect(() => { setPage(1); }, [mode, query, date, historyStatus]);

  const queueCount = useMemo(
    () => orders.filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai)).length,
    [orders],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (!historyMode) return PAYMENT_REQUEST_STATUSES.includes(order?.trangThai);
        if (historyStatus === 'PAID') return PAID_STATUSES.includes(order?.trangThai);
        if (historyStatus === 'CANCELED') return CANCELED_STATUSES.includes(order?.trangThai);
        return PAID_STATUSES.includes(order?.trangThai) || CANCELED_STATUSES.includes(order?.trangThai);
      })
      .filter((order) => {
        const relevantTime = historyMode ? paymentTimeOf(order) : paymentRequestTimeOf(order);
        return !date || localDateValue(relevantTime) === date;
      })
      .filter((order) => {
        if (!keyword) return true;
        return `${documentCode(order)} ${order?.maDonHang || ''} ${tableNameOf(order)}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        const aTime = new Date(historyMode ? paymentTimeOf(a) : paymentRequestTimeOf(a) || 0).getTime();
        const bTime = new Date(historyMode ? paymentTimeOf(b) : paymentRequestTimeOf(b) || 0).getTime();
        return historyMode ? bTime - aTime : aTime - bTime;
      });
  }, [orders, historyMode, historyStatus, date, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageItems = paginationRange(safePage, totalPages);

  function renderActions(order) {
    const id = orderIdOf(order);
    if (historyMode) {
      return (
        <div className="cashier-row-actions">
          <Link className="cashier-icon-action" to={`/cashier/invoices/${id}`} title="Xem chi tiết"><Eye size={17} /></Link>
          {PAID_STATUSES.includes(order?.trangThai) ? (
            <Link className="cashier-icon-action" to={`/cashier/print/${id}`} title="In lại hóa đơn"><Printer size={17} /></Link>
          ) : null}
        </div>
      );
    }
    return (
      <div className="cashier-row-actions">
        <Link className="cashier-icon-action" to={`/cashier/invoices/${id}`} title="Kiểm tra đơn"><Eye size={17} /></Link>
        <Link className="cashier-pay-now" to={`/cashier/payment/${id}`}><WalletCards size={16} />Thanh toán</Link>
      </div>
    );
  }

  return (
    <section className="page cashier-page cashier-workspace">
      {!historyMode ? (
        <div className="cashier-page-heading cashier-page-heading-actions">
          <span className="cashier-heading-badge"><WalletCards size={17} />{queueCount} yêu cầu đang chờ</span>
        </div>
      ) : null}

      <div className="cashier-filterbar cashier-filterbar-modern">
        <label className="cashier-search cashier-search-wide">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã đơn, hóa đơn hoặc bàn..." />
        </label>
        <input className="cashier-date-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        {historyMode ? (
          <select className="cashier-status-select" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}>
            <option value="ALL">Tất cả giao dịch</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="CANCELED">Đã hủy</option>
          </select>
        ) : (
          <button type="button" className="cashier-reload-button" onClick={load} disabled={loading}><RefreshCw size={17} />Tải lại</button>
        )}
      </div>

      {loadError ? (
        <div className="cashier-load-error">
          <span>{loadError}</span>
          <button type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}

      <div className="cashier-invoice-card cashier-focused-card">
        <div className="cashier-list-summary">
          <div>
            <strong>{historyMode ? 'Giao dịch đã kết thúc' : 'Yêu cầu cần xử lý'}</strong>
            <span>{filtered.length} kết quả</span>
          </div>
          {!historyMode ? <small>Danh sách được sắp theo thời gian yêu cầu tăng dần.</small> : null}
        </div>

        <div className="cashier-table-scroll cashier-desktop-list">
          <table className="cashier-invoice-table">
            <thead>
              <tr>
                <th>{historyMode ? 'Mã hóa đơn' : 'Mã đơn'}</th>
                <th>Bàn</th>
                <th>Số món</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>{historyMode ? 'Thời gian' : 'Thời gian chờ'}</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="cashier-table-empty">Đang tải dữ liệu...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="cashier-table-empty">{historyMode ? 'Chưa có giao dịch phù hợp.' : 'Hiện không có bàn nào yêu cầu thanh toán.'}</td></tr>
              ) : rows.map((order) => {
                const info = statusInfo(order?.trangThai);
                const id = orderIdOf(order);
                const elapsed = elapsedInfo(paymentRequestTimeOf(order), now);
                return (
                  <tr key={id} className={!historyMode && elapsed.tone === 'urgent' ? 'cashier-urgent-row' : ''}>
                    <td><strong className="cashier-invoice-code">{documentCode(order)}</strong></td>
                    <td><strong>{tableNameOf(order)}</strong></td>
                    <td>{itemCountOf(order)}</td>
                    <td><strong>{formatMoney(totalOf(order))}</strong></td>
                    <td><span className={`cashier-state-pill cashier-tone-${info.tone}`}>{info.label}</span></td>
                    <td>
                      {historyMode ? dateTimeText(paymentTimeOf(order)) : (
                        <span className={`cashier-wait-time ${elapsed.tone}`}><Clock3 size={15} />{elapsed.label}</span>
                      )}
                    </td>
                    <td>{renderActions(order)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="cashier-mobile-list">
          {loading ? <div className="cashier-table-empty">Đang tải dữ liệu...</div> : rows.length === 0 ? (
            <div className="cashier-table-empty">{historyMode ? 'Chưa có giao dịch phù hợp.' : 'Hiện không có bàn nào yêu cầu thanh toán.'}</div>
          ) : rows.map((order) => {
            const info = statusInfo(order?.trangThai);
            const id = orderIdOf(order);
            const elapsed = elapsedInfo(paymentRequestTimeOf(order), now);
            return (
              <article key={id} className={`cashier-mobile-item ${!historyMode ? elapsed.tone : ''}`}>
                <header>
                  <div><strong>{tableNameOf(order)}</strong><span>{documentCode(order)}</span></div>
                  <span className={`cashier-state-pill cashier-tone-${info.tone}`}>{info.label}</span>
                </header>
                <div className="cashier-mobile-item-grid">
                  <p><span>Số món</span><b>{itemCountOf(order)}</b></p>
                  <p><span>Tổng tiền</span><b>{formatMoney(totalOf(order))}</b></p>
                  <p className="wide"><span>{historyMode ? 'Thời gian' : 'Thời gian chờ'}</span><b>{historyMode ? dateTimeText(paymentTimeOf(order)) : elapsed.label}</b></p>
                </div>
                <footer>{renderActions(order)}</footer>
              </article>
            );
          })}
        </div>

        <div className="cashier-table-footer">
          <span>Hiển thị {rows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} trong {filtered.length} kết quả</span>
          <div className="cashier-pagination">
            <button disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
            {pageItems.map((item) => typeof item === 'string'
              ? <span key={item}>…</span>
              : <button key={item} className={safePage === item ? 'active' : ''} onClick={() => setPage(item)}>{item}</button>)}
            <button disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
