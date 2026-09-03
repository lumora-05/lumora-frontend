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

function groupRepresentative(rows) {
  return rows.find((order) => String(order?.banAn?.maBan ?? '') === String(order?.banAn?.maBanChinh ?? ''))
    || [...rows].sort((a, b) => Number(orderIdOf(a) || 0) - Number(orderIdOf(b) || 0))[0];
}

function collapseSharedBills(orders) {
  const groups = new Map();
  orders.forEach((order) => {
    const groupId = String(order?.maNhomThanhToan || '').trim();
    const key = groupId ? `group:${groupId}` : `order:${orderIdOf(order)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  });

  return Array.from(groups.values()).map((rows) => {
    if (rows.length <= 1) return rows[0];
    const representative = groupRepresentative(rows);
    const tableLabel = [...new Set(rows.map(tableNameOf).filter(Boolean))].join(' + ');
    const requestTimes = rows.map(paymentRequestTimeOf).filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
    const paymentTimes = rows.map(paymentTimeOf).filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
    return {
      ...representative,
      __sharedBill: true,
      __sharedOrders: rows,
      __tableLabel: tableLabel,
      __itemCount: rows.reduce((sum, order) => sum + itemCountOf(order), 0),
      __total: rows.reduce((sum, order) => sum + totalOf(order), 0),
      __requestTime: requestTimes.length ? new Date(Math.min(...requestTimes)).toISOString() : paymentRequestTimeOf(representative),
      __paymentTime: paymentTimes.length ? new Date(Math.max(...paymentTimes)).toISOString() : paymentTimeOf(representative),
      __orderCodes: rows.map(documentCode).join(' + '),
    };
  });
}

function rowTableName(order) {
  return order?.__tableLabel || tableNameOf(order);
}

function rowItemCount(order) {
  return Number(order?.__itemCount ?? itemCountOf(order));
}

function rowTotal(order) {
  return Number(order?.__total ?? totalOf(order));
}

function rowRequestTime(order) {
  return order?.__requestTime || paymentRequestTimeOf(order);
}

function rowPaymentTime(order) {
  return order?.__paymentTime || paymentTimeOf(order);
}

function rowDocumentCode(order, historyMode) {
  return !historyMode && order?.__sharedBill ? order.__orderCodes : documentCode(order);
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

  const billingRows = useMemo(() => collapseSharedBills(orders), [orders]);
  const queueCount = useMemo(
    () => billingRows.filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai)).length,
    [billingRows],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return billingRows
      .filter((order) => {
        if (!historyMode) return PAYMENT_REQUEST_STATUSES.includes(order?.trangThai);
        if (historyStatus === 'PAID') return PAID_STATUSES.includes(order?.trangThai);
        if (historyStatus === 'CANCELED') return CANCELED_STATUSES.includes(order?.trangThai);
        return PAID_STATUSES.includes(order?.trangThai) || CANCELED_STATUSES.includes(order?.trangThai);
      })
      .filter((order) => {
        const relevantTime = historyMode ? rowPaymentTime(order) : rowRequestTime(order);
        return !date || localDateValue(relevantTime) === date;
      })
      .filter((order) => {
        if (!keyword) return true;
        return `${rowDocumentCode(order, historyMode)} ${order?.maDonHang || ''} ${rowTableName(order)}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        const aTime = new Date(historyMode ? rowPaymentTime(a) : rowRequestTime(a) || 0).getTime();
        const bTime = new Date(historyMode ? rowPaymentTime(b) : rowRequestTime(b) || 0).getTime();
        return historyMode ? bTime - aTime : aTime - bTime;
      });
  }, [billingRows, historyMode, historyStatus, date, query]);

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
                const elapsed = elapsedInfo(rowRequestTime(order), now);
                return (
                  <tr key={id} className={!historyMode && elapsed.tone === 'urgent' ? 'cashier-urgent-row' : ''}>
                    <td><strong className="cashier-invoice-code">{rowDocumentCode(order, historyMode)}</strong></td>
                    <td><strong>{rowTableName(order)}</strong>{order?.__sharedBill ? <small> · Bill chung</small> : null}</td>
                    <td>{rowItemCount(order)}</td>
                    <td><strong>{formatMoney(rowTotal(order))}</strong></td>
                    <td><span className={`cashier-state-pill cashier-tone-${info.tone}`}>{info.label}</span></td>
                    <td>
                      {historyMode ? dateTimeText(rowPaymentTime(order)) : (
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
            const elapsed = elapsedInfo(rowRequestTime(order), now);
            return (
              <article key={id} className={`cashier-mobile-item ${!historyMode ? elapsed.tone : ''}`}>
                <header>
                  <div><strong>{rowTableName(order)}</strong><span>{rowDocumentCode(order, historyMode)}{order?.__sharedBill ? ' · Bill chung' : ''}</span></div>
                  <span className={`cashier-state-pill cashier-tone-${info.tone}`}>{info.label}</span>
                </header>
                <div className="cashier-mobile-item-grid">
                  <p><span>Số món</span><b>{rowItemCount(order)}</b></p>
                  <p><span>Tổng tiền</span><b>{formatMoney(rowTotal(order))}</b></p>
                  <p className="wide"><span>{historyMode ? 'Thời gian' : 'Thời gian chờ'}</span><b>{historyMode ? dateTimeText(rowPaymentTime(order)) : elapsed.label}</b></p>
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
