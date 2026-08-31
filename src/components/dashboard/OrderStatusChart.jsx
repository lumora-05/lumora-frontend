import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#ff4d00', '#2f80ed', '#31b957', '#9b5de5', '#b8c0cc'];

export default function OrderStatusChart({ data = [], normalized = false, period = '7days' }) {
  const rows = (Array.isArray(data)
    ? (normalized
      ? data
      : data.map((item) => ({
        name: item?.trangThai || item?.name,
        value: Number(item?.soLuong ?? item?.value ?? 0),
      })))
    : [])
    .filter((item) => Number(item?.value || 0) > 0);

  const total = rows.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <article className="dashboard-card dashboard-order-status-card">
      <div className="dashboard-card-head plain">
        <h3>{period === '30days' ? 'Đơn hàng theo trạng thái · 30 ngày qua' : 'Đơn hàng theo trạng thái · 7 ngày qua'}</h3>
      </div>

      {rows.length === 0 ? (
        <div className="dashboard-empty-state">Chưa có dữ liệu đơn hàng</div>
      ) : (
        <div className="dashboard-donut-layout">
          <div className="dashboard-donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {rows.map((item, index) => (
                    <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="dashboard-donut-center">
              <strong>{total}</strong>
              <span>Tổng đơn</span>
            </div>
          </div>

          <div className="dashboard-status-list">
            {rows.map((item, index) => (
              <div key={`${item.name}-${index}`}>
                <span>
                  <i style={{ background: COLORS[index % COLORS.length] }} />
                  {item.name}
                </span>
                <b>{item.value} ({Math.round((item.value / total) * 1000) / 10}%)</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
