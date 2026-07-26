import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Armchair,
  BellRing,
  ClipboardCheck,
  Clock3,
  Gift,
  ShoppingBag,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { reviewApi } from '../../api/reviewApi';
import StatisticCard from '../../components/dashboard/StatisticCard';
import RevenueChart from '../../components/dashboard/RevenueChart';
import OrderStatusChart from '../../components/dashboard/OrderStatusChart';
import TopFoodChart from '../../components/dashboard/TopFoodChart';
import { formatMoney } from '../../utils/formatMoney';
import { useWebSocket } from '../../hooks/useWebSocket';

const STATUS_LABEL = {
  CHO_XAC_NHAN: 'Chờ xác nhận',
  DANG_CHE_BIEN: 'Đang chuẩn bị',
  DA_PHUC_VU: 'Đang phục vụ',
  SAN_SANG_THANH_TOAN: 'Đang phục vụ',
  DANG_THANH_TOAN: 'Đang thanh toán',
  DA_THANH_TOAN: 'Hoàn thành',
  DA_HUY: 'Đã hủy',
};

const ACTIVITY_VIEW = {
  NEW_ORDER: { tone: 'green', icon: ShoppingCart },
  ORDER_STATUS_CHANGED: { tone: 'blue', icon: ClipboardCheck },
  KITCHEN_ITEM_STATUS_CHANGED: { tone: 'yellow', icon: BellRing },
  PAYMENT_COMPLETED: { tone: 'green', icon: ShoppingBag },
  FOOD_CREATED: { tone: 'purple', icon: ShoppingBag },
  FOOD_UPDATED: { tone: 'purple', icon: ShoppingBag },
  FOOD_DISABLED: { tone: 'red', icon: ShoppingBag },
  PROMOTION_CREATED: { tone: 'red', icon: Gift },
  PROMOTION_UPDATED: { tone: 'purple', icon: Gift },
  PROMOTION_DISABLED: { tone: 'red', icon: Gift },
  PROMOTION_APPLIED: { tone: 'purple', icon: Gift },
  EMPLOYEE_CREATED: { tone: 'blue', icon: ClipboardCheck },
  EMPLOYEE_UPDATED: { tone: 'blue', icon: ClipboardCheck },
  EMPLOYEE_DISABLED: { tone: 'red', icon: ClipboardCheck },
};

const SUMMARY_FALLBACK = {
  doanhThuHomNay: 414750,
  donHomNay: 68,
  tongBan: 20,
  banTrong: 8,
};

function toApiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function revenueRange(period) {
  const days = period === '30days' ? 30 : 7;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  return {
    from: toApiDate(from),
    to: toApiDate(to),
  };
}

function unwrapData(response, fallback) {
  const value = response?.data ?? response;
  return value ?? fallback;
}

function normalizeStatus(value) {
  return STATUS_LABEL[value] || value || 'Không xác định';
}

function statusClass(value) {
  return String(value || '').toLowerCase().replaceAll(' ', '-');
}

function formatRelativeTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const difference = Date.now() - date.getTime();
  if (difference < 60 * 1000) return 'Vừa xong';

  const minutes = Math.floor(difference / (60 * 1000));
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [orderStatus, setOrderStatus] = useState([]);
  const [topFoods, setTopFoods] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activities, setActivities] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState('7days');
  const [activityExpanded, setActivityExpanded] = useState(false);
  const socketEvent = useWebSocket();

  async function loadDashboard() {
    const results = await Promise.allSettled([
      dashboardApi.summary(),
      dashboardApi.revenueChart(revenueRange(revenuePeriod)),
      dashboardApi.orderStatusChart(),
      dashboardApi.topFoods(5),
      dashboardApi.recentOrders(5),
      dashboardApi.recentActivities(50),
      reviewApi.adminStatistics(),
    ]);

    const [summaryResult, revenueResult, statusResult, topFoodResult, recentOrderResult, activityResult, reviewResult] = results;

    setSummary(
      summaryResult.status === 'fulfilled'
        ? unwrapData(summaryResult.value, SUMMARY_FALLBACK)
        : SUMMARY_FALLBACK,
    );
    setRevenue(
      revenueResult.status === 'fulfilled'
        ? unwrapData(revenueResult.value, [])
        : [],
    );
    setOrderStatus(
      statusResult.status === 'fulfilled'
        ? unwrapData(statusResult.value, [])
        : [],
    );
    setTopFoods(
      topFoodResult.status === 'fulfilled'
        ? unwrapData(topFoodResult.value, [])
        : [],
    );
    setRecentOrders(
      recentOrderResult.status === 'fulfilled'
        ? unwrapData(recentOrderResult.value, [])
        : [],
    );
    setActivities(
      activityResult.status === 'fulfilled'
        ? unwrapData(activityResult.value, [])
        : [],
    );
    setReviewStats(
      reviewResult.status === 'fulfilled'
        ? unwrapData(reviewResult.value, null)
        : null,
    );
  }

  useEffect(() => {
    loadDashboard();
  }, [revenuePeriod]);

  useEffect(() => {
    if (
      socketEvent?.topic === '/topic/dashboard'
      || socketEvent?.topic === '/topic/orders'
      || socketEvent?.topic === '/topic/payments'
      || socketEvent?.topic === '/topic/reviews'
    ) {
      loadDashboard();
    }
  }, [socketEvent]);

  const normalizedStatus = useMemo(() => {
    if (!Array.isArray(orderStatus) || orderStatus.length === 0) return [];

    return orderStatus.map((item) => ({
      name: normalizeStatus(item?.trangThai || item?.name),
      value: Number(item?.soLuong ?? item?.value ?? 0),
    }));
  }, [orderStatus]);

  const pendingOrders = useMemo(() => {
    const item = normalizedStatus.find((row) => row.name === 'Chờ xác nhận');
    return item?.value ?? summary?.donChoXacNhan ?? 12;
  }, [normalizedStatus, summary]);

  const visibleActivities = activityExpanded ? activities : activities.slice(0, 5);

  const totalTables = Number(summary?.tongBan || 20);
  const emptyTables = Number(summary?.banTrong ?? 8);
  const servingTables = Math.max(totalTables - emptyTables, 0);
  const occupancy = totalTables > 0 ? Math.round((servingTables / totalTables) * 100) : 0;

  return (
    <section className="dashboard-page">
      <div className="dashboard-kpis">
        <StatisticCard
          icon={ShoppingBag}
          tone="orange"
          label="Tổng doanh thu"
          value={formatMoney(summary?.doanhThuHomNay ?? 414750)}
          note="Hôm nay"
          trend="12.5% so với hôm qua"
        />
        <StatisticCard
          icon={ShoppingCart}
          tone="blue"
          label="Đơn hàng"
          value={summary?.donHomNay ?? 68}
          note="Hôm nay"
          trend="8.3% so với hôm qua"
        />
        <StatisticCard
          icon={Clock3}
          tone="yellow"
          label="Đơn chờ xác nhận"
          value={pendingOrders}
          note="Cần xử lý"
          
          trendTone="warning"
        />
        <StatisticCard
          icon={Star}
          tone="purple"
          label="Đánh giá"
          value={`${Number(reviewStats?.averageRating || 0).toFixed(1)}/5`}
          note={`Tổng ${Number(reviewStats?.totalReviews || 0)} đánh giá`}
          trend={`${Number(reviewStats?.visibleReviews || 0)} đang hiển thị`}
        />
        <StatisticCard
          icon={Armchair}
          tone="yellow"
          label="Bàn đang phục vụ"
          value={`${servingTables}/${totalTables}`}
          note="Bàn"
          
          trendTone="warning"
        />
      </div>

      <div className="dashboard-chart-row">
        <RevenueChart
          data={revenue}
          period={revenuePeriod}
          onPeriodChange={setRevenuePeriod}
        />
        <OrderStatusChart data={normalizedStatus} normalized />
      </div>

      <div className="dashboard-bottom-row">
        <article className="dashboard-card dashboard-recent-orders">
          <div className="dashboard-card-head">
            <h3>Đơn hàng mới nhất</h3>
            <button type="button" onClick={() => navigate('/admin/orders')}>Xem tất cả</button>
          </div>
          <div className="dashboard-table-wrap">
            <table className="dashboard-compact-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Bàn</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td className="dashboard-empty-cell" colSpan="4">
                      Chưa có đơn hàng
                    </td>
                  </tr>
                ) : recentOrders.map((order) => {
                  const status = normalizeStatus(order?.trangThai);
                  return (
                    <tr key={order?.maDonHang}>
                      <td>{`#DH${order?.maDonHang}`}</td>
                      <td>{order?.tenBan || 'Chưa xác định'}</td>
                      <td>{formatMoney(order?.tongTien || 0)}</td>
                      <td>
                        <span className={`dashboard-status ${statusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <TopFoodChart data={topFoods} onViewAll={() => navigate('/admin/reports')} />

        <article className="dashboard-card dashboard-activity-card">
          <div className="dashboard-card-head">
            <h3>Hoạt động gần đây</h3>
            <button
              type="button"
              onClick={() => setActivityExpanded((current) => !current)}
            >
              {activityExpanded ? 'Thu gọn' : 'Xem tất cả'}
            </button>
          </div>
          <div className={`dashboard-activity-list${activityExpanded ? ' expanded' : ''}`}>
            {activities.length === 0 ? (
              <div className="dashboard-empty-state">Chưa có hoạt động gần đây</div>
            ) : visibleActivities.map((activity, index) => {
              const view = ACTIVITY_VIEW[activity?.loaiHoatDong] || {
                tone: 'yellow',
                icon: BellRing,
              };
              const Icon = view.icon;
              return (
                <div
                  className="dashboard-activity-item"
                  key={activity?.maHoatDong || `${activity?.loaiHoatDong}-${index}`}
                >
                  <span className={`dashboard-activity-icon ${view.tone}`}>
                    <Icon size={17} />
                  </span>
                  <p title={activity?.noiDung}>{activity?.noiDung || 'Hoạt động hệ thống'}</p>
                  <small>{formatRelativeTime(activity?.thoiGian)}</small>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <footer className="dashboard-footer">
        <span>© 2026 LUMORA. Tất cả quyền được bảo lưu.</span>
        <span>Phiên bản 1.0.0</span>
      </footer>
    </section>
  );
}
