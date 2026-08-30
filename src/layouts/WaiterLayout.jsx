import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, ClipboardList, History, PlusCircle, Table2, UserRound, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import WaiterHeader from '../components/common/WaiterHeader';
import { orderApi } from '../api/orderApi';
import { reservationApi } from '../api/reservationApi';
import { serviceRequestApi } from '../api/serviceRequestApi';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { imageUrl } from '../utils/imageUrl';
import { serviceRequestStatus, unwrapServiceRequestList } from '../utils/serviceRequests';
import { isActiveOrder, orderGroup, pendingReadyCount, unwrapList } from '../utils/waiterData';
import { canCheckIn, currentLocalDate, reservationData, reservationStatus } from '../utils/reservations';

const pageMeta = {
  '/waiter/order-entry': ['Gọi món tại bàn', 'Ghi nhận món khách gọi tại bàn'],
  '/waiter/tables': ['Sơ đồ bàn ăn', 'Theo dõi nhanh bàn đang phục vụ và bàn chờ thanh toán'],
  '/waiter/history': ['Lịch sử phục vụ', 'Tra cứu các đơn đã thanh toán hoặc đã hủy'],
  '/waiter/requests': ['Yêu cầu tại bàn', 'Tiếp nhận và hoàn thành yêu cầu hỗ trợ của khách'],
  '/waiter/reservations': ['Đặt bàn', 'Check-in khách đã xác nhận và xử lý đổi bàn khi cần'],
  '/waiter/account': ['Tài khoản của tôi', 'Quản lý thông tin cá nhân và bảo mật tài khoản'],
  '/waiter/orders': ['Đơn cần xử lý', 'Theo dõi đơn đã chuyển bếp, món sẵn sàng và yêu cầu thanh toán'],
};

const items = [
  { to: '/waiter/orders', label: 'Đơn cần xử lý', icon: 'orders', mobileIcon: ClipboardList },
  { to: '/waiter/tables', label: 'Sơ đồ bàn', icon: 'table', mobileIcon: Table2 },
  { to: '/waiter/order-entry', label: 'Gọi món tại bàn', icon: 'menu', mobileIcon: PlusCircle },
  { to: '/waiter/reservations', label: 'Đặt bàn', icon: 'reservation', mobileIcon: CalendarCheck2 },
  { to: '/waiter/history', label: 'Lịch sử', icon: 'history', mobileIcon: History },
  { to: '/waiter/account', label: 'Tài khoản', icon: 'account', mobileIcon: UserRound },
];

export default function WaiterLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });
  const [orderAttentionCount, setOrderAttentionCount] = useState(0);
  const [serviceAttentionCount, setServiceAttentionCount] = useState(0);
  const [reservationAttentionCount, setReservationAttentionCount] = useState(0);
  const waiterEvent = useWebSocket(['/topic/orders', '/topic/kitchen', '/topic/service-requests', '/topic/reservations']);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        setBrandSettings((current) => ({ ...current, ...(data || {}) }));
      })
      .catch(() => {
        // Giữ nhận diện mặc định nếu backend tạm thời không phản hồi.
      });
    return () => { active = false; };
  }, []);

  const loadAttentionCounts = useCallback(async () => {
    try {
      const today = currentLocalDate();
      const [orderResponse, serviceResponse, reservationResponse] = await Promise.all([
        orderApi.getAll(),
        serviceRequestApi.list('ACTIVE'),
        reservationApi.list({ from: today, to: today, page: 0, size: 100 }),
      ]);
      const orders = unwrapList(orderResponse).filter(isActiveOrder);
      const serviceRequests = unwrapServiceRequestList(serviceResponse);
      const reservationPayload = reservationData(reservationResponse);
      const reservations = Array.isArray(reservationPayload)
        ? reservationPayload
        : Array.isArray(reservationPayload?.content) ? reservationPayload.content : [];
      const now = Date.now();
      const checkInEarlyMinutes = Math.max(Number(brandSettings?.reservationCheckInEarlyMinutes) || 30, 0);
      const noShowGraceMinutes = Math.max(Number(brandSettings?.reservationNoShowGraceMinutes) || 15, 0);

      setOrderAttentionCount(orders.filter((order) => (
        ['READY', 'PAYMENT'].includes(orderGroup(order)) || pendingReadyCount(order) > 0
      )).length);
      setServiceAttentionCount(serviceRequests.filter((item) => (
        ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item))
      )).length);
      setReservationAttentionCount(reservations.filter((item) => (
        canCheckIn(item, checkInEarlyMinutes, noShowGraceMinutes, now)
        || reservationStatus(item) === 'KHACH_DA_DEN'
      )).length);
    } catch {
      // Badge là thông tin hỗ trợ; các trang nghiệp vụ vẫn tự hiển thị lỗi nếu tải dữ liệu thất bại.
    }
  }, [brandSettings?.reservationCheckInEarlyMinutes, brandSettings?.reservationNoShowGraceMinutes]);

  useEffect(() => { loadAttentionCounts(); }, [loadAttentionCounts]);
  useEffect(() => {
    if (['/topic/orders', '/topic/kitchen', '/topic/service-requests', '/topic/reservations'].includes(waiterEvent?.topic)) {
      loadAttentionCounts();
    }
  }, [loadAttentionCounts, waiterEvent]);

  const navigationItems = useMemo(() => items.map((item) => {
    if (item.to === '/waiter/orders') return { ...item, badge: orderAttentionCount };
    if (item.to === '/waiter/requests') return { ...item, badge: serviceAttentionCount };
    if (item.to === '/waiter/reservations') return { ...item, badge: reservationAttentionCount };
    return item;
  }), [orderAttentionCount, reservationAttentionCount, serviceAttentionCount]);

  const detail = location.pathname.match(/^\/waiter\/orders\/[^/]+$/);
  const readOnly = detail && new URLSearchParams(location.search).get('readonly') === '1';
  const key = Object.keys(pageMeta).find((path) => location.pathname.startsWith(path)) || '/waiter/orders';
  const [title, subtitle] = detail
    ? readOnly
      ? ['Chi tiết lịch sử', 'Thông tin đơn đã kết thúc — chỉ xem']
      : ['Chi tiết phục vụ', 'Theo dõi và cập nhật trạng thái từng món']
    : pageMeta[key];

  return (
    <div className="app-shell waiter-shell">
      <Sidebar
        title="Nhân viên phục vụ"
        items={navigationItems}
        logoUrl={imageUrl(brandSettings.logoUrl)}
        restaurantName={brandSettings.restaurantName}
      />

      {menuOpen ? <button type="button" className="waiter-mobile-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`waiter-mobile-drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="waiter-mobile-drawer-head">
          <div><ClipboardList size={22} /><strong>Khu vực phục vụ</strong></div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X size={21} /></button>
        </div>
        <nav>
          {navigationItems.map(({ to, label, mobileIcon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/waiter/orders'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} />{label}
              {Number(badge || 0) > 0 ? <span className="sidebar-item-badge">{Number(badge) > 99 ? '99+' : badge}</span> : null}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="waiter-main">
        <WaiterHeader
          title={title}
          subtitle={subtitle}
          onOpenMenu={() => setMenuOpen(true)}
          reservationPolicy={{
            checkInEarlyMinutes: Math.max(Number(brandSettings?.reservationCheckInEarlyMinutes) || 30, 0),
            noShowGraceMinutes: Math.max(Number(brandSettings?.reservationNoShowGraceMinutes) || 15, 0),
          }}
        />
        <Outlet />
      </main>
    </div>
  );
}
