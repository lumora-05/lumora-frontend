import { Bell, ChevronDown, LogOut, Menu, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deliveryApi } from '../../api/deliveryApi';
import { orderApi } from '../../api/orderApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { imageUrl } from '../../utils/imageUrl';
import { profileAvatarOf } from '../../utils/profileAvatar';
import { PAYMENT_REQUEST_STATUSES, unwrap } from '../../utils/cashier';
import { displayOrderCode, isCashierDeliveryAttention, unwrapDeliveryList } from '../../utils/delivery';
import { useStaffOperationalAlerts } from '../../hooks/useStaffOperationalAlerts';

function cashierOnlineAlert(event) {
  const type = String(event?.body?.type || '').toUpperCase();
  const data = event?.body?.data || event?.body || {};
  const code = displayOrderCode(data);

  if (type === 'DELIVERY_ORDER_WAITING_PAYMENT') {
    return { key: `${type}-${data?.maDonHang || 'latest'}`, message: `Có đơn online mới ${code} · đang chờ khách thanh toán VietQR.` };
  }
  if (type === 'DELIVERY_ORDER_PENDING_CONFIRMATION') {
    return { key: `${type}-${data?.maDonHang || 'latest'}`, message: `Có đơn online mới ${code} · cần thu ngân kiểm tra và xác nhận.` };
  }
  if (type === 'DELIVERY_PAYMENT_CONFIRMED') {
    return { key: `${type}-${data?.maDonHang || 'latest'}`, message: `Đơn ${code} đã ghi nhận VietQR · cần xác nhận để chuyển xuống bếp.` };
  }
  if (type === 'DELIVERY_READY_FOR_HANDOVER') {
    return { key: `${type}-${data?.maDonHang || 'latest'}`, message: `Đơn ${code} đã hoàn thành chế biến · sẵn sàng bàn giao cho tài xế.` };
  }
  if (type === 'PICKUP_READY') {
    return { key: `${type}-${data?.maDonHang || 'latest'}`, message: `Đơn ${code} đã hoàn thành chế biến · sẵn sàng để khách đến lấy.` };
  }
  return null;
}

export default function CashierHeader({ title, subtitle, onOpenMenu }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const event = useWebSocket(['/topic/cashier', '/topic/orders', '/topic/payments']);
  const [queueCount, setQueueCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const lastToastKey = useRef('');
  const name = user?.hoTen || user?.tenNhanVien || user?.tenDangNhap || user?.username || 'Nhân viên thu ngân';
  const avatar = profileAvatarOf(user);
  useStaffOperationalAlerts('CASHIER', event);

  async function loadCount() {
    let paymentCount = 0;
    let deliveryCount = 0;

    try {
      const paymentResponse = await orderApi.getAll();
      paymentCount = unwrap(paymentResponse)
        .filter((order) => PAYMENT_REQUEST_STATUSES.includes(order?.trangThai)).length;
    } catch {
      // Badge chỉ mang tính hỗ trợ, lỗi chi tiết được hiển thị trong trang danh sách.
    }

    try {
      const deliveryResponse = await deliveryApi.list('ALL');
      deliveryCount = unwrapDeliveryList(deliveryResponse).filter(isCashierDeliveryAttention).length;
    } catch {
      // Giữ phần đếm công việc thanh toán nếu danh sách đơn online tạm thời không tải được.
    }

    setQueueCount(paymentCount + deliveryCount);
  }

  useEffect(() => { loadCount(); }, []);
  useEffect(() => {
    if (['/topic/cashier', '/topic/orders', '/topic/payments'].includes(event?.topic)) loadCount();
  }, [event]);

  useEffect(() => {
    const alert = cashierOnlineAlert(event);
    if (!alert || lastToastKey.current === alert.key) return;
    lastToastKey.current = alert.key;
    toast.info(alert.message, { id: `cashier-online-${alert.key}`, duration: 6500 });
  }, [event, toast]);

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
