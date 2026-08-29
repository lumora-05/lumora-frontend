import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Bike, CalendarCheck2, History, ReceiptText, UserRound, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import CashierHeader from '../components/common/CashierHeader';
import { deliveryApi } from '../api/deliveryApi';
import { orderApi } from '../api/orderApi';
import { reservationApi } from '../api/reservationApi';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { PAYMENT_REQUEST_STATUSES, unwrap } from '../utils/cashier';
import { isCashierDeliveryAttention, unwrapDeliveryList } from '../utils/delivery';
import { imageUrl } from '../utils/imageUrl';
import { normalizePage } from '../utils/pagination';
import { currentLocalDate, reservationPreorderNeedsReview, reservationStatus } from '../utils/reservations';

const items = [
  { to: '/cashier', label: 'Thanh toán', icon: 'cashier', mobileIcon: ReceiptText },
  { to: '/cashier/delivery-orders', label: 'Đơn hàng trực tuyến', icon: 'delivery', mobileIcon: Bike },
  { to: '/cashier/reservations', label: 'Đặt bàn', icon: 'reservation', mobileIcon: CalendarCheck2 },
  { to: '/cashier/history', label: 'Lịch sử giao dịch', icon: 'history', mobileIcon: History },
  { to: '/cashier/reports', label: 'Báo cáo', icon: 'report', mobileIcon: ReceiptText },
  { to: '/cashier/account', label: 'Tài khoản', icon: 'account', mobileIcon: UserRound },
];

const pageMeta = {
  payment: ['Thanh toán', 'Theo dõi và xử lý các yêu cầu thanh toán của khách.'],
  delivery: ['Đơn hàng trực tuyến', 'Tiếp nhận và theo dõi các đơn hàng đặt trực tuyến.'],
  reservations: ['Đặt bàn', 'Tiếp nhận, xác nhận và quản lý yêu cầu đặt bàn trực tuyến.'],
  history: ['Lịch sử giao dịch', 'Tra cứu các giao dịch và thanh toán đã phát sinh.'],
  reports: ['Báo cáo', 'Theo dõi số liệu và kết quả hoạt động.'],
  notifications: ['Thông báo thu ngân', 'Theo dõi thanh toán, đơn hàng trực tuyến và đặt bàn cần xử lý.'],
  account: ['Tài khoản', 'Quản lý thông tin tài khoản cá nhân.'],
};

function cashierPageMeta(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/cashier';

  // Match từng route cụ thể trước. Route gốc /cashier chỉ dùng cho trang Thanh toán.
  if (path === '/cashier/delivery-orders' || path.startsWith('/cashier/delivery-orders/')) return pageMeta.delivery;
  if (path === '/cashier/reservations' || path.startsWith('/cashier/reservations/')) return pageMeta.reservations;
  if (path === '/cashier/history' || path.startsWith('/cashier/history/')) return pageMeta.history;
  if (path === '/cashier/reports' || path.startsWith('/cashier/reports/')) return pageMeta.reports;
  if (path === '/cashier/notifications' || path.startsWith('/cashier/notifications/')) return pageMeta.notifications;
  if (path === '/cashier/account' || path.startsWith('/cashier/account/')) return pageMeta.account;
  return pageMeta.payment;
}

function isDeliveryRealtimeEvent(event) {
  const type = String(event?.body?.type || '').toUpperCase();
  return type.startsWith('DELIVERY_') || type.startsWith('PICKUP_');
}

export default function CashierLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });
  const [paymentAttentionCount, setPaymentAttentionCount] = useState(0);
  const [deliveryAttentionCount, setDeliveryAttentionCount] = useState(0);
  const [reservationAttentionCount, setReservationAttentionCount] = useState(0);
  const cashierEvent = useWebSocket(['/topic/cashier', '/topic/orders', '/topic/payments', '/topic/cashier/reservations']);

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


  const loadPaymentAttentionCount = useCallback(async () => {
    try {
      const response = await orderApi.getAll();
      setPaymentAttentionCount(
        unwrap(response).filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai)).length,
      );
    } catch {
      // Badge là thông tin hỗ trợ; trang thanh toán vẫn tự hiển thị lỗi tải dữ liệu nếu có.
    }
  }, []);

  const loadDeliveryAttentionCount = useCallback(async () => {
    try {
      const response = await deliveryApi.list('ALL');
      setDeliveryAttentionCount(unwrapDeliveryList(response).filter(isCashierDeliveryAttention).length);
    } catch {
      // Badge là thông tin hỗ trợ; trang đơn online vẫn tự hiển thị lỗi tải dữ liệu nếu có.
    }
  }, []);


  const loadReservationAttentionCount = useCallback(async () => {
    try {
      const [pendingResponse, activeResponse] = await Promise.all([
        reservationApi.list({ status: 'CHO_XAC_NHAN', page: 0, size: 1 }),
        reservationApi.list({ from: currentLocalDate(), page: 0, size: 100 }),
      ]);
      const pendingCount = normalizePage(pendingResponse, 1).totalElements;
      const preorderReviewCount = normalizePage(activeResponse, 100).content
        .filter((item) => reservationStatus(item) !== 'CHO_XAC_NHAN' && reservationPreorderNeedsReview(item)).length;
      setReservationAttentionCount(pendingCount + preorderReviewCount);
    } catch {
      // Badge là thông tin hỗ trợ; trang đặt bàn vẫn tự hiển thị lỗi nếu tải dữ liệu thất bại.
    }
  }, []);

  useEffect(() => { loadPaymentAttentionCount(); }, [loadPaymentAttentionCount]);
  useEffect(() => { loadDeliveryAttentionCount(); }, [loadDeliveryAttentionCount]);
  useEffect(() => { loadReservationAttentionCount(); }, [loadReservationAttentionCount]);
  useEffect(() => {
    if (['/topic/cashier', '/topic/orders', '/topic/payments'].includes(cashierEvent?.topic)) {
      loadPaymentAttentionCount();
    }
    if (isDeliveryRealtimeEvent(cashierEvent)) loadDeliveryAttentionCount();
    if (cashierEvent?.topic === '/topic/cashier/reservations') loadReservationAttentionCount();
  }, [cashierEvent, loadDeliveryAttentionCount, loadPaymentAttentionCount, loadReservationAttentionCount]);

  const navigationItems = useMemo(() => items.map((item) => {
    if (item.to === '/cashier') return { ...item, badge: paymentAttentionCount };
    if (item.to === '/cashier/delivery-orders') return { ...item, badge: deliveryAttentionCount };
    if (item.to === '/cashier/reservations') return { ...item, badge: reservationAttentionCount };
    return item;
  }), [deliveryAttentionCount, paymentAttentionCount, reservationAttentionCount]);

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
    [title, subtitle] = cashierPageMeta(location.pathname);
  }

  return (
    <div className="app-shell cashier-shell">
      <Sidebar
        title="Thu ngân"
        items={navigationItems}
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
          {navigationItems.map(({ to, label, mobileIcon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/cashier'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} />{label}
              {Number(badge || 0) > 0 ? <span className="sidebar-item-badge">{Number(badge) > 99 ? '99+' : badge}</span> : null}
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
