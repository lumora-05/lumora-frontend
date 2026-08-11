import { useEffect, useState } from 'react';
import { Bell, Bike, History, ReceiptText, UserRound, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import CashierHeader from '../components/common/CashierHeader';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { imageUrl } from '../utils/imageUrl';

const items = [
  { to: '/cashier', label: 'Thanh toán', icon: 'cashier', mobileIcon: ReceiptText },
  { to: '/cashier/history', label: 'Lịch sử giao dịch', icon: 'history', mobileIcon: History },
  { to: '/cashier/delivery-orders', label: 'Đơn giao hàng', icon: 'delivery', mobileIcon: Bike },
  { to: '/cashier/reports', label: 'Báo cáo', icon: 'report', mobileIcon: ReceiptText },
  { to: '/cashier/account', label: 'Tài khoản', icon: 'account', mobileIcon: UserRound },
];

const pageMeta = {
  '/cashier/history': ['Lịch sử giao dịch', 'Tra cứu hóa đơn đã thanh toán hoặc đã hủy'],
  '/cashier/reports': ['Báo cáo giao dịch', 'Theo dõi doanh thu và số hóa đơn đã ghi nhận'],
  '/cashier/delivery-orders': ['Đơn giao hàng', 'Thu ngân theo dõi đơn online, thanh toán, bàn giao và các trường hợp ngoại lệ'],
  '/cashier/notifications': ['Thông báo thu ngân', 'Yêu cầu thanh toán tại bàn và đơn online đang cần theo dõi'],
  '/cashier/account': ['Tài khoản của tôi', 'Quản lý thông tin cá nhân và bảo mật tài khoản'],
  '/cashier': ['Thanh toán', 'Ưu tiên các bàn đã yêu cầu thanh toán lâu nhất'],
};

export default function CashierLayout() {
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

  const detailMatch = location.pathname.match(/^\/cashier\/(?:invoices|payment|print)\/[^/]+$/);
  let title;
  let subtitle;
  if (detailMatch) {
    if (location.pathname.includes('/payment/')) {
      title = 'Thanh toán hóa đơn';
      subtitle = 'Kiểm tra phương thức và xác nhận giao dịch';
    } else if (location.pathname.includes('/print/')) {
      title = 'In hóa đơn';
      subtitle = 'Kiểm tra bản in trước khi gửi đến máy in';
    } else {
      title = 'Chi tiết hóa đơn';
      subtitle = 'Kiểm tra món ăn và tổng tiền của bàn';
    }
  } else {
    const key = Object.keys(pageMeta).find((path) => path !== '/cashier' && location.pathname.startsWith(path)) || '/cashier';
    [title, subtitle] = pageMeta[key];
  }

  return (
    <div className="app-shell cashier-shell">
      <Sidebar
        title="Thu ngân"
        items={items}
        logoUrl={imageUrl(brandSettings.logoUrl)}
        restaurantName={brandSettings.restaurantName}
      />

      {menuOpen ? <button type="button" className="cashier-mobile-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`cashier-mobile-drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="cashier-mobile-drawer-head">
          <div><ReceiptText size={22} /><strong>Khu vực thu ngân</strong></div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X size={21} /></button>
        </div>
        <nav>
          {items.map(({ to, label, mobileIcon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/cashier'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
          <NavLink to="/cashier/notifications" className={({ isActive }) => isActive ? 'active' : ''}>
            <Bell size={19} />Thông báo
          </NavLink>
        </nav>
      </aside>

      <main className="cashier-main">
        <CashierHeader title={title} subtitle={subtitle} onOpenMenu={() => setMenuOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
