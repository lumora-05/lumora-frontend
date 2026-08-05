import { useEffect, useState } from 'react';
import { BellRing, CalendarCheck2, ClipboardList, History, PlusCircle, Table2, UserRound, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import WaiterHeader from '../components/common/WaiterHeader';

const pageMeta = {
  '/waiter/order-entry': ['Gọi món tại bàn', 'Ghi nhận món khách gọi tại bàn'],
  '/waiter/tables': ['Sơ đồ bàn ăn', 'Theo dõi nhanh bàn đang phục vụ và bàn chờ thanh toán'],
  '/waiter/history': ['Lịch sử phục vụ', 'Tra cứu các đơn đã thanh toán hoặc đã hủy'],
  '/waiter/requests': ['Yêu cầu tại bàn', 'Tiếp nhận và hoàn thành yêu cầu hỗ trợ của khách'],
  '/waiter/reservations': ['Đặt bàn', 'Xác nhận, check-in và xếp bàn trong khu vực phụ trách'],
  '/waiter/account': ['Tài khoản của tôi', 'Quản lý thông tin cá nhân và bảo mật tài khoản'],
  '/waiter/orders': ['Đơn cần xử lý', 'Theo dõi đơn đã chuyển bếp, món sẵn sàng và yêu cầu thanh toán'],
};

const items = [
  { to: '/waiter/orders', label: 'Đơn cần xử lý', icon: 'orders', mobileIcon: ClipboardList },
  { to: '/waiter/tables', label: 'Sơ đồ bàn', icon: 'table', mobileIcon: Table2 },
  { to: '/waiter/order-entry', label: 'Gọi món tại bàn', icon: 'menu', mobileIcon: PlusCircle },
  { to: '/waiter/requests', label: 'Yêu cầu tại bàn', icon: 'service', mobileIcon: BellRing },
  { to: '/waiter/reservations', label: 'Đặt bàn', icon: 'reservation', mobileIcon: CalendarCheck2 },
  { to: '/waiter/history', label: 'Lịch sử', icon: 'history', mobileIcon: History },
  { to: '/waiter/account', label: 'Tài khoản', icon: 'account', mobileIcon: UserRound },
];

export default function WaiterLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

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
      <Sidebar title="Nhân viên phục vụ" items={items} />

      {menuOpen ? <button type="button" className="waiter-mobile-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`waiter-mobile-drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="waiter-mobile-drawer-head">
          <div><ClipboardList size={22} /><strong>Khu vực phục vụ</strong></div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X size={21} /></button>
        </div>
        <nav>
          {items.map(({ to, label, mobileIcon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/waiter/orders'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="waiter-main">
        <WaiterHeader title={title} subtitle={subtitle} onOpenMenu={() => setMenuOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
