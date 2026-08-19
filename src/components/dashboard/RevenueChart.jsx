import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../../utils/formatMoney';

export default function RevenueChart({ data = [], period = '7days', onPeriodChange }) {
  const rows = Array.isArray(data)
    ? data.map((item) => ({
      name: item?.ngay || item?.name,
      doanhThu: Number(item?.doanhThu || 0),
    }))
    : [];

  return (
    <article className="dashboard-card dashboard-revenue-card">
      <div className="dashboard-card-head">
        <h3>{period === '30days' ? 'Doanh thu 30 ngày qua' : 'Doanh thu 7 ngày qua'}</h3>
        <select
          value={period}
          onChange={(event) => onPeriodChange?.(event.target.value)}
          aria-label="Khoảng thời gian doanh thu"
        >
          <option value="7days">7 ngày qua</option>
          <option value="30days">30 ngày qua</option>
        </select>
      </div>

      <div className="dashboard-revenue-chart">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state">Chưa có dữ liệu doanh thu</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 12, right: 10, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff4d00" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#ff4d00" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#e4e9f0" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
            />
            <Tooltip
              formatter={(value) => [formatMoney(value), 'Doanh thu']}
              contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 12px 30px rgba(15,23,42,.12)' }}
              labelStyle={{ fontWeight: 800, color: '#334155' }}
            />
            <Area
              type="monotone"
              dataKey="doanhThu"
              stroke="#ff4d00"
              strokeWidth={2.5}
              fill="url(#dashboardRevenueFill)"
              dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#ff4d00' }}
              activeDot={{ r: 6 }}
            />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}
