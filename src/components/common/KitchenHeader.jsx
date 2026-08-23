import { Bell, ChevronDown, LogOut, Menu, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useStaffOperationalAlerts } from '../../hooks/useStaffOperationalAlerts';
import { canonicalKitchenStatus, flattenKitchenOrders, unwrapList } from '../../utils/kitchenData';
import { imageUrl } from '../../utils/imageUrl';
import { profileAvatarOf } from '../../utils/profileAvatar';

export default function KitchenHeader({ title, subtitle, onOpenMenu }) {
  const { user, logout } = useAuth();
  const event = useWebSocket(['/topic/kitchen', '/topic/orders']);
  useStaffOperationalAlerts('KITCHEN', event);
  const [newCount, setNewCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const name = user?.hoTen || user?.fullName || user?.tenDangNhap || user?.username || 'Nhân viên bếp';
  const avatar = profileAvatarOf(user);

  async function loadCount() {
    try {
      const response = await orderApi.getAll();
      const count = flattenKitchenOrders(unwrapList(response))
        .filter((item) => canonicalKitchenStatus(item) === 'CHO_BEP').length;
      setNewCount(count);
    } catch {
      // Badge is supplementary; page-level requests still show detailed errors.
    }
  }

  useEffect(() => { loadCount(); }, []);
  useEffect(() => {
    if (event?.topic === '/topic/kitchen' || event?.topic === '/topic/orders') loadCount();
  }, [event]);

  const badge = useMemo(() => newCount > 99 ? '99+' : String(newCount), [newCount]);

  return (
    <header className="kitchen-topbar">
      <div className="kitchen-title-wrap">
        <button type="button" className="kitchen-menu-button" onClick={onOpenMenu} aria-label="Mở menu bếp"><Menu size={22} /></button>
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="kitchen-top-actions">
        <Link to="/kitchen/notifications" className="kitchen-notification-button" aria-label={`${newCount} món mới`}>
          <Bell size={21} />
          {newCount > 0 ? <span>{badge}</span> : null}
        </Link>
        <div className="kitchen-profile-wrap">
          <button type="button" className="kitchen-profile" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
            <div className="kitchen-avatar">{avatar ? <img src={imageUrl(avatar)} alt="Ảnh đại diện" /> : name.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{name}</strong>
              <span>Nhân viên bếp</span>
            </div>
            <ChevronDown size={18} />
          </button>
          {profileOpen ? (
            <div className="kitchen-profile-menu">
              <Link to="/kitchen/account" onClick={() => setProfileOpen(false)}><UserRound size={17} />Tài khoản</Link>
              <button type="button" onClick={logout}><LogOut size={17} />Đăng xuất</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
