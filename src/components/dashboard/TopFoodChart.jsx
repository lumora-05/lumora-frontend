import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';

export default function TopFoodChart({ data = [], onViewAll }) {
  const rows = Array.isArray(data) ? data : [];

  return (
    <article className="dashboard-card dashboard-top-food-card">
      <div className="dashboard-card-head">
        <h3>Top món bán chạy</h3>
        <button type="button" onClick={onViewAll}>Xem tất cả</button>
      </div>
      <div className="dashboard-table-wrap">
        <table className="dashboard-compact-table">
          <thead>
            <tr>
              <th>Món ăn</th>
              <th>Đã bán</th>
              <th>Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="dashboard-empty-cell" colSpan="3">
                  Chưa có dữ liệu bán hàng
                </td>
              </tr>
            ) : rows.slice(0, 5).map((item, index) => {
              const source = item?.hinhAnh || item?.anhMon || item?.imageUrl || item?.image;
              return (
                <tr key={item?.maMonAn || `${item?.tenMonAn || item?.tenMon || 'mon'}-${index}`}>
                  <td>
                    <span className="dashboard-food-thumb">
                      {source
                        ? <img src={imageUrl(source)} alt={item?.tenMonAn || item?.tenMon || 'Món ăn'} />
                        : <span>🍽️</span>}
                    </span>
                    <b>{item?.tenMonAn || item?.tenMon || 'Món ăn'}</b>
                  </td>
                  <td>{item?.soLuongBan ?? item?.qty ?? 0}</td>
                  <td>{formatMoney(item?.doanhThu || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
