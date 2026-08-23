import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileBarChart2,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  Utensils,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '../../api/dashboardApi';
import { orderApi } from '../../api/orderApi';
import { formatMoney } from '../../utils/formatMoney';
import { normalizePage } from '../../utils/pagination';
import { imageUrl } from '../../utils/imageUrl';
import { useWebSocket } from '../../hooks/useWebSocket';

const FILTER_OPTIONS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày qua' },
  { value: '30days', label: '30 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' },
];

const STATUS_ITEMS = [
  { code: 'CHO_XAC_NHAN', label: 'Chờ xác nhận', color: '#ff8a3d' },
  { code: 'CHO_DEN_GIO', label: 'Online · chờ đến giờ', color: '#fb923c' },
  { code: 'DA_XAC_NHAN', label: 'Đã chuyển xuống bếp', color: '#f5b82e' },
  { code: 'DANG_CHUAN_BI', label: 'Online · đang chuẩn bị', color: '#38bdf8' },
  { code: 'DANG_CHE_BIEN', label: 'Đang chế biến', color: '#2f80ed' },
  { code: 'SAN_SANG', label: 'Sẵn sàng', color: '#60a5fa' },
  { code: 'SAN_SANG_PHUC_VU', label: 'Sẵn sàng phục vụ', color: '#22c55e' },
  { code: 'DA_HOAN_THANH', label: 'Đã hoàn thành món', color: '#4ade80' },
  { code: 'DA_PHUC_VU', label: 'Đang phục vụ', color: '#31b957' },
  { code: 'SAN_SANG_THANH_TOAN', label: 'Sẵn sàng thanh toán', color: '#eab308' },
  { code: 'CHO_THANH_TOAN', label: 'Chờ thanh toán', color: '#8b5cf6' },
  { code: 'CHO_KHACH_NHAN', label: 'Online · chờ khách nhận', color: '#a855f7' },
  { code: 'CHO_TAI_XE_NHAN', label: 'Online · chờ tài xế', color: '#7c3aed' },
  { code: 'CHO_BAN_GIAO', label: 'Online · chờ bàn giao', color: '#6d28d9' },
  { code: 'DANG_GIAO', label: 'Online · đang giao', color: '#0ea5e9' },
  { code: 'CHO_DOI_SOAT', label: 'Online · chờ đối soát COD', color: '#06b6d4' },
  { code: 'DA_THANH_TOAN', label: 'Hoàn thành tại bàn', color: '#14b8a6' },
  { code: 'HOAN_THANH', label: 'Online · hoàn thành', color: '#10b981' },
  { code: 'GIAO_THAT_BAI', label: 'Online · giao thất bại', color: '#f97316' },
  { code: 'DA_HUY', label: 'Đã hủy', color: '#ef4444' },
];

function toApiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { from: toApiDate(start), to: toApiDate(end) };
}

function rangeFromPreset(preset, customRange) {
  if (preset === 'custom') return customRange;

  const end = new Date();
  const start = new Date(end);

  if (preset === 'today') {
    return { from: toApiDate(end), to: toApiDate(end) };
  }
  if (preset === '30days') {
    start.setDate(start.getDate() - 29);
  } else if (preset === 'month') {
    start.setDate(1);
  } else {
    start.setDate(start.getDate() - 6);
  }

  return { from: toApiDate(start), to: toApiDate(end) };
}

function unwrap(response, fallback) {
  const value = response?.data ?? response;
  return value ?? fallback;
}

function numberOf(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value) {
  if (!value) return '—';
  const raw = String(value);
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}`;
  return raw;
}

function fullDateLabel(value) {
  if (!value) return '—';
  const raw = String(value);
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return raw;
}

function normalizeRevenue(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((item, index) => ({
    key: item?.ngay || item?.date || item?.name || String(index),
    date: item?.ngay || item?.date || item?.name || '',
    name: dateLabel(item?.ngay || item?.date || item?.name),
    revenue: numberOf(item?.doanhThu ?? item?.revenue ?? item?.tongDoanhThu),
    orders: numberOf(item?.soHoaDon ?? item?.invoiceCount ?? item?.soDonHang ?? item?.donHang ?? item?.orderCount ?? item?.totalOrders),
  }));
}

function normalizeTopFoods(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((item, index) => ({
    id: item?.maMonAn ?? item?.id ?? index,
    name: item?.tenMonAn || item?.tenMon || item?.name || 'Món ăn',
    image: item?.hinhAnh || item?.anhMon || item?.imageUrl || item?.image || '',
    quantity: numberOf(item?.soLuongBan ?? item?.soLuongDaBan ?? item?.qty ?? item?.quantity),
    revenue: numberOf(item?.doanhThu ?? item?.revenue),
  }));
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function percent(value) {
  return `${numberOf(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

export default function Report() {
  const socketEvent = useWebSocket();
  const [preset, setPreset] = useState('7days');
  const [customRange, setCustomRange] = useState(initialRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revenueRows, setRevenueRows] = useState([]);
  const [topFoods, setTopFoods] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  const selectedRange = useMemo(
    () => rangeFromPreset(preset, customRange),
    [preset, customRange],
  );

  const rangeValid = Boolean(
    selectedRange.from
    && selectedRange.to
    && selectedRange.from <= selectedRange.to,
  );

  async function loadReport() {
    if (!rangeValid) return;

    setLoading(true);
    setError('');
    const params = { from: selectedRange.from, to: selectedRange.to };

    const results = await Promise.allSettled([
      dashboardApi.revenueChart(params),
      dashboardApi.topFoods(10, params),
      orderApi.getPage({ ...params, page: 0, size: 1, status: 'ALL' }),
      ...STATUS_ITEMS.map((item) => orderApi.getPage({
        ...params,
        page: 0,
        size: 1,
        status: item.code,
      })),
    ]);

    const [revenueResult, foodsResult, totalResult, ...statusResults] = results;

    if (revenueResult.status === 'fulfilled') {
      setRevenueRows(normalizeRevenue(unwrap(revenueResult.value, [])));
    } else {
      setRevenueRows([]);
    }

    if (foodsResult.status === 'fulfilled') {
      setTopFoods(normalizeTopFoods(unwrap(foodsResult.value, [])));
    } else {
      setTopFoods([]);
    }

    if (totalResult.status === 'fulfilled') {
      setTotalOrders(normalizePage(totalResult.value, 1).totalElements);
    } else {
      setTotalOrders(0);
    }

    const nextCounts = {};
    STATUS_ITEMS.forEach((item, index) => {
      const result = statusResults[index];
      nextCounts[item.code] = result?.status === 'fulfilled'
        ? normalizePage(result.value, 1).totalElements
        : 0;
    });
    setStatusCounts(nextCounts);

    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed === results.length) {
      setError('Không thể tải dữ liệu thống kê. Vui lòng kiểm tra kết nối với máy chủ.');
    } else if (failed > 0) {
      setError('Một phần dữ liệu thống kê chưa tải được. Các số liệu còn lại vẫn được hiển thị.');
    }

    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    loadReport();
  }, [selectedRange.from, selectedRange.to, rangeValid]);

  useEffect(() => {
    if (
      socketEvent?.topic === '/topic/dashboard'
      || socketEvent?.topic === '/topic/orders'
      || socketEvent?.topic === '/topic/payments'
    ) {
      loadReport();
    }
  }, [socketEvent]);

  const completedOrders = numberOf(statusCounts.DA_THANH_TOAN) + numberOf(statusCounts.HOAN_THANH);
  const cancelledOrders = numberOf(statusCounts.DA_HUY);
  const totalRevenue = revenueRows.reduce((sum, item) => sum + item.revenue, 0);
  const averageOrder = completedOrders > 0 ? totalRevenue / completedOrders : 0;
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  const statusRows = STATUS_ITEMS
    .map((item) => ({ ...item, value: numberOf(statusCounts[item.code]) }))
    .filter((item) => item.value > 0);

  const chartTotal = statusRows.reduce((sum, item) => sum + item.value, 0);

  function exportCsv() {
    const summaryRows = [
      ['BÁO CÁO THỐNG KÊ LUMORA'],
      ['Từ ngày', fullDateLabel(selectedRange.from)],
      ['Đến ngày', fullDateLabel(selectedRange.to)],
      ['Tổng doanh thu', totalRevenue],
      ['Tổng đơn hàng', totalOrders],
      ['Đơn hoàn thành', completedOrders],
      ['Đơn đã hủy', cancelledOrders],
      ['Giá trị đơn trung bình', Math.round(averageOrder)],
      ['Tỷ lệ hoàn thành', percent(completionRate)],
      ['Tỷ lệ hủy', percent(cancellationRate)],
      [],
      ['THỐNG KÊ THEO NGÀY'],
      ['Ngày', 'Số đơn', 'Doanh thu', 'Giá trị trung bình'],
      ...revenueRows.map((item) => [
        fullDateLabel(item.date),
        item.orders,
        item.revenue,
        item.orders > 0 ? Math.round(item.revenue / item.orders) : 0,
      ]),
      [],
      ['TOP MÓN BÁN CHẠY'],
      ['Món ăn', 'Số lượng bán', 'Doanh thu'],
      ...topFoods.map((item) => [item.name, item.quantity, item.revenue]),
    ];

    const csv = `\uFEFF${summaryRows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thong-ke-lumora-${selectedRange.from}-${selectedRange.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-report-page">
      <div className="admin-report-toolbar">
        <div className="admin-report-periods" role="group" aria-label="Chọn khoảng thống kê">
          {FILTER_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={preset === option.value ? 'active' : ''}
              onClick={() => setPreset(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="admin-report-actions">
          {preset === 'custom' ? (
            <div className="admin-report-custom-range">
              <label>
                <span>Từ</span>
                <input
                  type="date"
                  value={customRange.from}
                  max={customRange.to || undefined}
                  onChange={(event) => setCustomRange((current) => ({
                    ...current,
                    from: event.target.value,
                  }))}
                />
              </label>
              <label>
                <span>Đến</span>
                <input
                  type="date"
                  value={customRange.to}
                  min={customRange.from || undefined}
                  onChange={(event) => setCustomRange((current) => ({
                    ...current,
                    to: event.target.value,
                  }))}
                />
              </label>
            </div>
          ) : (
            <div className="admin-report-range-label">
              <CalendarDays size={18} />
              <span>{fullDateLabel(selectedRange.from)} – {fullDateLabel(selectedRange.to)}</span>
            </div>
          )}

          <button
            type="button"
            className="admin-report-refresh"
            onClick={loadReport}
            disabled={loading || !rangeValid}
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <button
            type="button"
            className="admin-report-export"
            onClick={exportCsv}
            disabled={loading}
          >
            <Download size={18} />
            Xuất CSV
          </button>
        </div>
      </div>

      {!rangeValid ? (
        <div className="admin-report-notice error">
          Ngày bắt đầu không được lớn hơn ngày kết thúc.
        </div>
      ) : null}

      {error ? (
        <div className="admin-report-notice">
          <span>{error}</span>
          <button type="button" onClick={loadReport}>Thử lại</button>
        </div>
      ) : null}

      <div className="admin-report-kpis" aria-busy={loading}>
        <article>
          <span className="admin-report-kpi-icon orange"><CircleDollarSign size={25} /></span>
          <div><small>Tổng doanh thu</small><strong>{formatMoney(totalRevenue)}</strong><p>Trong khoảng đã chọn</p></div>
        </article>
        <article>
          <span className="admin-report-kpi-icon blue"><ReceiptText size={25} /></span>
          <div><small>Tổng đơn hàng</small><strong>{totalOrders.toLocaleString('vi-VN')}</strong><p>{completedOrders.toLocaleString('vi-VN')} đơn hoàn thành</p></div>
        </article>
        <article>
          <span className="admin-report-kpi-icon green"><CheckCircle2 size={25} /></span>
          <div><small>Tỷ lệ hoàn thành</small><strong>{percent(completionRate)}</strong><p>Tính trên tổng số đơn</p></div>
        </article>
        <article>
          <span className="admin-report-kpi-icon purple"><FileBarChart2 size={25} /></span>
          <div><small>Giá trị đơn trung bình</small><strong>{formatMoney(averageOrder)}</strong><p>Trên đơn đã thanh toán</p></div>
        </article>
        <article>
          <span className="admin-report-kpi-icon red"><TrendingDown size={25} /></span>
          <div><small>Tỷ lệ hủy đơn</small><strong>{percent(cancellationRate)}</strong><p>{cancelledOrders.toLocaleString('vi-VN')} đơn đã hủy</p></div>
        </article>
      </div>

      <div className="admin-report-chart-grid">
        <article className="admin-report-card admin-report-revenue-card">
          <div className="admin-report-card-head">
            <div><h3>Biểu đồ doanh thu</h3><p>Doanh thu ghi nhận theo từng ngày</p></div>
            <span>{revenueRows.length} ngày có dữ liệu</span>
          </div>
          <div className="admin-report-chart">
            {loading ? (
              <div className="admin-report-empty">Đang tải dữ liệu...</div>
            ) : revenueRows.length === 0 ? (
              <div className="admin-report-empty">Chưa có dữ liệu doanh thu trong khoảng này.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueRows} margin={{ top: 12, right: 14, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminReportRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff5a12" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ff5a12" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e8edf3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={62}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value) => [formatMoney(value), 'Doanh thu']}
                    labelFormatter={(_, payload) => fullDateLabel(payload?.[0]?.payload?.date)}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 12px 30px rgba(15,23,42,.12)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ff5a12"
                    strokeWidth={2.5}
                    fill="url(#adminReportRevenue)"
                    dot={{ r: 3.5, strokeWidth: 2, fill: '#fff', stroke: '#ff5a12' }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="admin-report-card admin-report-status-card">
          <div className="admin-report-card-head">
            <div><h3>Cơ cấu đơn hàng</h3><p>Tỷ trọng theo từng trạng thái</p></div>
          </div>
          {loading ? (
            <div className="admin-report-empty">Đang tải dữ liệu...</div>
          ) : statusRows.length === 0 ? (
            <div className="admin-report-empty">Chưa có đơn hàng trong khoảng này.</div>
          ) : (
            <div className="admin-report-status-layout">
              <div className="admin-report-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusRows}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={62}
                      outerRadius={91}
                      paddingAngle={1.5}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {statusRows.map((item) => <Cell key={item.code} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} đơn`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div><strong>{chartTotal}</strong><span>Tổng đơn</span></div>
              </div>
              <div className="admin-report-status-list">
                {statusRows.map((item) => (
                  <div key={item.code}>
                    <span><i style={{ background: item.color }} />{item.label}</span>
                    <b>{item.value} <small>({chartTotal ? percent((item.value / chartTotal) * 100) : '0%'})</small></b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <div className="admin-report-detail-grid">
        <article className="admin-report-card admin-report-daily-card">
          <div className="admin-report-card-head">
            <div><h3>Hiệu quả theo ngày</h3><p>Đối chiếu số đơn và doanh thu hằng ngày</p></div>
          </div>
          <div className="admin-report-table-wrap">
            <table className="admin-report-table">
              <thead><tr><th>Ngày</th><th>Số đơn</th><th>Doanh thu</th><th>Trung bình/đơn</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="admin-report-table-empty">Đang tải dữ liệu...</td></tr>
                ) : revenueRows.length === 0 ? (
                  <tr><td colSpan="4" className="admin-report-table-empty">Chưa có dữ liệu phù hợp.</td></tr>
                ) : revenueRows.map((item) => (
                  <tr key={item.key}>
                    <td>{fullDateLabel(item.date)}</td>
                    <td>{item.orders.toLocaleString('vi-VN')}</td>
                    <td><strong>{formatMoney(item.revenue)}</strong></td>
                    <td>{formatMoney(item.orders > 0 ? item.revenue / item.orders : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-report-card admin-report-food-card">
          <div className="admin-report-card-head">
            <div><h3>Top món bán chạy</h3><p>Xếp hạng theo số lượng đã bán</p></div>
            <Utensils size={20} />
          </div>
          <div className="admin-report-food-list">
            {loading ? (
              <div className="admin-report-empty">Đang tải dữ liệu...</div>
            ) : topFoods.length === 0 ? (
              <div className="admin-report-empty">Chưa có dữ liệu món bán chạy.</div>
            ) : topFoods.slice(0, 6).map((item, index) => (
              <div className="admin-report-food-row" key={item.id}>
                <span className={`admin-report-rank rank-${index + 1}`}>{index + 1}</span>
                <span className="admin-report-food-image">
                  {item.image ? <img src={imageUrl(item.image)} alt={item.name} /> : <Utensils size={18} />}
                </span>
                <div><strong title={item.name}>{item.name}</strong><small>{item.quantity.toLocaleString('vi-VN')} phần đã bán</small></div>
                <b>{formatMoney(item.revenue)}</b>
              </div>
            ))}
          </div>
        </article>
      </div>

      <footer className="admin-report-footer">
        <span>
          Dữ liệu từ {fullDateLabel(selectedRange.from)} đến {fullDateLabel(selectedRange.to)}
          {lastUpdated ? ` · Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        <span>© {new Date().getFullYear()} LUMORA</span>
      </footer>
    </section>
  );
}
