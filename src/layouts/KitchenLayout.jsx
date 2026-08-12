import { useEffect, useState } from 'react';
import { Bell, Bike, ChefHat, History, UserRound, Utensils, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import KitchenHeader from '../components/common/KitchenHeader';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { imageUrl } from '../utils/imageUrl';

const pageMeta = {
  '/kitchen/menu': ['Tình trạng món', 'Tra cứu và cập nhật nhanh món đang phục vụ hoặc đã hết'],
  '/kitchen/history': ['Lịch sử chế biến', 'Tra cứu các phiếu bếp đã hoàn tất'],
  '/kitchen/delivery-orders': ['Đơn giao hàng', 'Theo dõi các đơn giao hàng đã được nhà hàng xác nhận và chuyển xuống bếp'],
  '/kitchen/notifications': ['Thông báo bếp', 'Theo dõi món mới và các phiếu đang chờ lâu'],
  '/kitchen/account': ['Tài khoản của tôi', 'Quản lý thông tin cá nhân và bảo mật tài khoản'],
  '/kitchen': ['Bảng chế biến', 'Ưu tiên và xử lý món ăn theo thời gian thực'],
};

const items = [
  { to: '/kitchen', label: 'Bảng chế biến', icon: 'kitchen', mobileIcon: ChefHat },
  { to: '/kitchen/menu', label: 'Tình trạng món', icon: 'menu', mobileIcon: Utensils },
  { to: '/kitchen/history', label: 'Lịch sử chế biến', icon: 'history', mobileIcon: History },
  { to: '/kitchen/delivery-orders', label: 'Đơn giao hàng', icon: 'delivery', mobileIcon: Bike },
  { to: '/kitchen/account', label: 'Tài khoản', icon: 'account', mobileIcon: UserRound },
];

export default function KitchenLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

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

  const key = Object.keys(pageMeta)
    .filter((path) => path !== '/kitchen')
    .find((path) => location.pathname.startsWith(path));
  const readOnlyDetail = location.pathname.match(/^\/kitchen\/orders\/[^/]+$/) && new URLSearchParams(location.search).get('readonly') === '1';
  const [title, subtitle] = location.pathname.match(/^\/kitchen\/orders\/[^/]+$/)
    ? readOnlyDetail
      ? ['Chi tiết lịch sử', 'Thông tin phiếu bếp đã hoàn thành — chỉ xem']
      : ['Cập nhật chế biến', 'Xử lý trạng thái theo từng món hoặc toàn bộ phiếu']
    : pageMeta[key || '/kitchen'];

  return (
    <div className="app-shell kitchen-shell">
      <Sidebar
        title="Nhân viên bếp"
        items={items}
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
          {items.map(({ to, label, mobileIcon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/kitchen'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
          <NavLink to="/kitchen/notifications" className={({ isActive }) => isActive ? 'active' : ''}>
            <Bell size={19} />Thông báo
          </NavLink>
        </nav>
      </aside>

      <main className="kitchen-main">
        <KitchenHeader title={title} subtitle={subtitle} onOpenMenu={() => setMenuOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
