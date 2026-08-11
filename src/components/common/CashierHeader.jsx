import { Bell, ChevronDown, Clock3, LogOut, Menu, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { deliveryApi } from '../../api/deliveryApi';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { imageUrl } from '../../utils/imageUrl';
import { profileAvatarOf } from '../../utils/profileAvatar';
import { PAYMENT_REQUEST_STATUSES, unwrap } from '../../utils/cashier';
import { deliveryData, unwrapDeliveryList } from '../../utils/delivery';
import { useStaffOperationalAlerts } from '../../hooks/useStaffOperationalAlerts';
import StaffAlertToggle from './StaffAlertToggle';

export default function CashierHeader({ title, subtitle, onOpenMenu }) {
  const { user, logout } = useAuth();
  const event = useWebSocket(['/topic/cashier', '/topic/orders', '/topic/payments']);
  const [queueCount, setQueueCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const name = user?.hoTen || user?.tenNhanVien || user?.tenDangNhap || user?.username || 'Nhân viên thu ngân';
  const avatar = profileAvatarOf(user);
  useStaffOperationalAlerts('CASHIER', event);

  async function loadCount() {
    try {
      const [paymentResponse, deliveryResponse] = await Promise.all([
        orderApi.getAll(),
        deliveryApi.list('ALL'),
      ]);
      const paymentCount = unwrap(paymentResponse)
        .filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai)).length;
      const deliveryCount = unwrapDeliveryList(deliveryResponse)
        .filter((order) => !['HOAN_THANH', 'DA_HUY'].includes(String(deliveryData(order)?.trangThaiGiaoHang || '').toUpperCase())).length;
      setQueueCount(paymentCount + deliveryCount);
    } catch {
      // Badge chỉ mang tính hỗ trợ, lỗi chi tiết được hiển thị trong trang danh sách.
    }
  }

  useEffect(() => { loadCount(); }, []);
  useEffect(() => {
    if (['/topic/cashier', '/topic/orders', '/topic/payments'].includes(event?.topic)) loadCount();
  }, [event]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(now), [now]);

  return (
    <header className="topbar admin-topbar cashier-topbar">
      <div className="cashier-title-wrap">
        <button type="button" className="cashier-menu-button" onClick={onOpenMenu} aria-label="Mở menu thu ngân"><Menu size={22} /></button>
        <div className="cashier-role-title">
          <span>{title || 'THU NGÂN'}</span>
          <small>{subtitle || 'Quản lý hóa đơn và thanh toán'}</small>
        </div>
      </div>

      <div className="cashier-header-actions">
        <span className="cashier-live-time"><Clock3 size={17} />{dateLabel}</span>

        <StaffAlertToggle channel="CASHIER" />

        <Link to="/cashier/notifications" className="notification-btn cashier-notification-link" aria-label={`${queueCount} công việc cần theo dõi`}>
          <Bell size={21} />
          {queueCount > 0 ? <span>{queueCount > 99 ? '99+' : queueCount}</span> : null}
        </Link>

        <div className="cashier-profile-wrap">
          <button type="button" className="admin-profile cashier-profile-mini" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
            <div className="avatar cashier-avatar">{avatar ? <img src={imageUrl(avatar)} alt="Ảnh đại diện" /> : name.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{name}</strong>
              <span>Thu ngân</span>
            </div>
            <ChevronDown size={18} />
          </button>
          {profileOpen ? (
            <div className="cashier-profile-menu">
              <Link to="/cashier/account" onClick={() => setProfileOpen(false)}><UserRound size={17} />Tài khoản</Link>
              <button type="button" onClick={logout}><LogOut size={17} />Đăng xuất</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
