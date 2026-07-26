export default function StatisticCard({
  label,
  value,
  note,
  trend,
  icon: Icon,
  tone = 'orange',
  trendTone = 'success',
}) {
  return (
    <article className="dashboard-kpi-card">
      <div className={`dashboard-kpi-icon ${tone}`}>
        {Icon ? <Icon size={25} strokeWidth={2.1} /> : null}
      </div>

      <div className="dashboard-kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>

      {trend ? (
        <div className={`dashboard-kpi-trend ${trendTone}`}>
          <b>▲ {trend.split(' ')[0]}</b>
          <span>{trend.substring(trend.indexOf(' ') + 1)}</span>
        </div>
      ) : null}
    </article>
  );
}
