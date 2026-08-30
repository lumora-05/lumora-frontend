import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Bike, ChefHat, History, UserRound, Utensils, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import KitchenHeader from '../components/common/KitchenHeader';
import { orderApi } from '../api/orderApi';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { canonicalKitchenStatus, flattenKitchenOrders, kitchenCallNumber, kitchenOrderId, unwrapList } from '../utils/kitchenData';
import { imageUrl } from '../utils/imageUrl';

const pageMeta = {
  '/kitchen/menu': ['Tình trạng món', 'Tra cứu và cập nhật nhanh món đang phục vụ hoặc đã hết'],
  '/kitchen/history': ['Lịch sử chế biến', 'Tra cứu các phiếu bếp đã hoàn tất'],
  '/kitchen/delivery-orders': ['Đơn đặt online', 'Theo dõi các đơn đặt online đã được nhà hàng xác nhận và chuyển xuống bếp'],
  '/kitchen/notifications': ['Thông báo bếp', 'Theo dõi món mới và các phiếu đang chờ lâu'],
  '/kitchen/account': ['Tài khoản của tôi', 'Quản lý thông tin cá nhân và bảo mật tài khoản'],
  '/kitchen': ['Bảng chế biến', 'Ưu tiên và xử lý món ăn theo thời gian thực'],
};

const items = [
  { to: '/kitchen', label: 'Bảng chế biến', icon: 'kitchen', mobileIcon: ChefHat },
  { to: '/kitchen/menu', label: 'Tình trạng món', icon: 'menu', mobileIcon: Utensils },
  { to: '/kitchen/history', label: 'Lịch sử chế biến', icon: 'history', mobileIcon: History },
  { to: '/kitchen/delivery-orders', label: 'Đơn đặt online', icon: 'delivery', mobileIcon: Bike },
  { to: '/kitchen/account', label: 'Tài khoản', icon: 'account', mobileIcon: UserRound },
];

export default function KitchenLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });
  const [kitchenAttentionCount, setKitchenAttentionCount] = useState(0);
  const kitchenEvent = useWebSocket(['/topic/kitchen', '/topic/orders']);

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

  const loadKitchenAttentionCount = useCallback(async () => {
    try {
      const response = await orderApi.getAll();
      const attentionTicketKeys = new Set(
        flattenKitchenOrders(unwrapList(response))
          .filter((item) => canonicalKitchenStatus(item) !== 'HOAN_THANH')
          .map((item) => `${kitchenOrderId(item)}-${kitchenCallNumber(item)}`),
      );
      setKitchenAttentionCount(attentionTicketKeys.size);
    } catch {
      // Badge là thông tin hỗ trợ; bảng chế biến vẫn tự hiển thị lỗi tải dữ liệu nếu có.
    }
  }, []);

  useEffect(() => { loadKitchenAttentionCount(); }, [loadKitchenAttentionCount]);
  useEffect(() => {
    if (['/topic/kitchen', '/topic/orders'].includes(kitchenEvent?.topic)) {
      loadKitchenAttentionCount();
    }
  }, [kitchenEvent, loadKitchenAttentionCount]);

  const navigationItems = useMemo(() => items.map((item) => (
    item.to === '/kitchen' ? { ...item, badge: kitchenAttentionCount } : item
  )), [kitchenAttentionCount]);

  const headerMeta = useMemo(() => {
    const pageKey = Object.keys(pageMeta)
      .filter((path) => path !== '/kitchen')
      .find((path) => location.pathname.startsWith(path));
    const isOrderDetail = /^\/kitchen\/orders\/[^/]+$/.test(location.pathname);
    if (isOrderDetail) {
      const readOnly = new URLSearchParams(location.search).get('readonly') === '1';
      return readOnly
        ? ['Chi tiết lịch sử', 'Thông tin phiếu bếp đã hoàn thành — chỉ xem']
        : ['Cập nhật chế biến', 'Xử lý trạng thái theo từng món hoặc toàn bộ phiếu'];
    }
    return pageMeta[pageKey || '/kitchen'];
  }, [location.pathname, location.search]);
  const [title, subtitle] = headerMeta;

  return (
    <div className="app-shell kitchen-shell">
      <Sidebar
        title="Nhân viên bếp"
        items={navigationItems}
        logoUrl={imageUrl(brandSettings.logoUrl)}
        restaurantName={brandSettings.restaurantName}
      />

      {menuOpen ? <button type="button" className="kitchen-mobile-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`kitchen-mobile-drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="kitchen-mobile-drawer-head">
          <div><ChefHat size={22} /><strong>Khu vực bếp</strong></div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X size={21} /></button>
        </div>
        <nav>
          {navigationItems.map(({ to, label, mobileIcon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/kitchen'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} />{label}
              {Number(badge || 0) > 0 ? <span className="sidebar-item-badge">{Number(badge) > 99 ? '99+' : badge}</span> : null}
            </NavLink>
          ))}
          <NavLink to="/kitchen/notifications" className={({ isActive }) => isActive ? 'active' : ''}>
            <Bell size={19} />Thông báo
          </NavLink>
        </nav>
      </aside>

      <main className="kitchen-main">
        <KitchenHeader
          key={`${location.key}:${location.pathname}:${location.search}`}
          title={title}
          subtitle={subtitle}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <Outlet />
      </main>
    </div>
  );
}
