import {
  Bell,
  CheckCheck,
  ChevronDown,
  Clock3,
  LoaderCircle,
  LogOut,
  PackageX,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accountApi } from '../../api/accountApi';
import { adminNotificationApi } from '../../api/adminNotificationApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatDate } from '../../utils/formatDate';
import { imageUrl } from '../../utils/imageUrl';
import { profileAvatarOf } from '../../utils/profileAvatar';

function profileOf(response) {
  const value = response?.data ?? response ?? {};
  return value?.data && typeof value.data === 'object' ? value.data : value;
}

function roleLabelOf(profile) {
  const rawRole = profile?.tenVaiTro
    || profile?.vaiTro?.tenVaiTro
    || profile?.roleName
    || profile?.role
    || '';

  const normalized = String(rawRole).replace(/^ROLE_/, '').toUpperCase();
  const labels = {
    ADMIN: 'Quản trị viên',
    WAITER: 'Nhân viên phục vụ',
    KITCHEN: 'Nhân viên bếp',
    CASHIER: 'Nhân viên thu ngân',
  };

  return labels[normalized] || rawRole || 'Quản trị viên';
}

function responseDataOf(response) {
  if (response?.data !== undefined) return response.data;
  return response ?? {};
}

function notificationsOf(response) {
  const data = responseDataOf(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function unreadCountOf(response) {
  const data = responseDataOf(response);
  return Number(data?.soLuongChuaDoc ?? data?.unreadCount ?? data?.count ?? 0) || 0;
}

function notificationIdOf(item) {
  return item?.maThongBao ?? item?.id;
}

function notificationTypeOf(item) {
  return String(item?.loaiThongBao || item?.type || '').toUpperCase();
}

function notificationTitleOf(item) {
  return item?.tieuDe || item?.title || 'Cảnh báo kho nguyên liệu';
}

function notificationMessageOf(item) {
  return item?.noiDung || item?.message || '';
}

function notificationTimeOf(item) {
  return item?.thoiGianTao || item?.createdAt || item?.createdDate;
}

function isUnread(item) {
  return item?.daDoc === false || item?.read === false || item?.isRead === false;
}

export default function Header({ title, subtitle }) {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const inventoryEvent = useWebSocket(['/topic/admin/notifications']);

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const name = user?.hoTen
    || user?.fullName
    || user?.tenNhanVien
    || user?.tenDangNhap
    || user?.username
    || 'Quản trị viên';
  const avatar = profileAvatarOf(user);
  const roleLabel = roleLabelOf(user);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await adminNotificationApi.getUnreadCount();
      setUnreadCount(unreadCountOf(response));
    } catch {
      // Không làm ảnh hưởng header khi backend thông báo tạm thời không khả dụng.
    }
  }, []);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setNotificationLoading(true);
    setNotificationError('');

    try {
      const [listResponse, countResponse] = await Promise.all([
        adminNotificationApi.getPage({ page: 0, size: 10 }),
        adminNotificationApi.getUnreadCount(),
      ]);
      setNotifications(notificationsOf(listResponse));
      setUnreadCount(unreadCountOf(countResponse));
    } catch {
      setNotificationError('Không thể tải thông báo. Vui lòng thử lại.');
    } finally {
      if (!silent) setNotificationLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    accountApi.getProfile()
      .then((response) => {
        if (!active) return;
        const profile = profileOf(response);
        if (profile && typeof profile === 'object') {
          updateUser?.(profile);
        }
      })
      .catch(() => {
        // Giữ thông tin từ phiên đăng nhập nếu API hồ sơ tạm thời không khả dụng.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!inventoryEvent) return;

    const body = inventoryEvent?.body ?? {};
    const eventType = String(body?.type || '').toUpperCase();
    const eventData = body?.data ?? {};

    loadNotifications({ silent: true });

    if (eventType === 'INVENTORY_LOW_STOCK_ALERT') {
      toast.info(eventData?.tieuDe || body?.message || 'Kho nguyên liệu có cảnh báo mới');
    } else if (eventType === 'INVENTORY_STOCK_RECOVERED') {
      toast.success(body?.message || 'Tồn kho nguyên liệu đã được bổ sung');
    }
  }, [inventoryEvent, loadNotifications, toast]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const toggleNotifications = () => {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    setProfileOpen(false);
    if (nextOpen) loadNotifications();
  };

  const openNotification = async (item) => {
    const id = notificationIdOf(item);
    if (id && isUnread(item)) {
      try {
        await adminNotificationApi.markAsRead(id);
        setNotifications((current) => current.map((notification) => (
          notificationIdOf(notification) === id
            ? { ...notification, daDoc: true }
            : notification
        )));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch {
        toast.error('Không thể đánh dấu thông báo đã đọc');
      }
    }

    setNotificationOpen(false);
    navigate('/admin/inventory');
  };

  const markAllAsRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);

    try {
      await adminNotificationApi.markAllAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, daDoc: true })));
      setUnreadCount(0);
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch {
      toast.error('Không thể đánh dấu tất cả thông báo');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <header className="topbar admin-topbar">
      <div className="topbar-title">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="top-actions">
        <div className="admin-notification-wrap" ref={notificationRef}>
          <button
            className={`notification-btn${notificationOpen ? ' active' : ''}`}
            type="button"
            aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
            title="Thông báo"
            aria-expanded={notificationOpen}
            aria-haspopup="dialog"
            onClick={toggleNotifications}
          >
            <Bell size={22} />
            {unreadCount > 0 ? <b>{unreadCount > 99 ? '99+' : unreadCount}</b> : null}
          </button>

          {notificationOpen ? (
            <section className="admin-notification-panel" role="dialog" aria-label="Thông báo kho nguyên liệu">
              <div className="admin-notification-head">
                <div>
                  <strong>Thông báo</strong>
                  <span>{unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo chưa đọc'}</span>
                </div>
                {unreadCount > 0 ? (
                  <button type="button" onClick={markAllAsRead} disabled={markingAll}>
                    {markingAll ? <LoaderCircle className="spin" size={15} /> : <CheckCheck size={15} />}
                    Đọc tất cả
                  </button>
                ) : null}
              </div>

              <div className="admin-notification-list">
                {notificationLoading ? (
                  <div className="admin-notification-state">
                    <LoaderCircle className="spin" size={24} />
                    <span>Đang tải thông báo...</span>
                  </div>
                ) : notificationError ? (
                  <div className="admin-notification-state error-state">
                    <TriangleAlert size={24} />
                    <span>{notificationError}</span>
                    <button type="button" onClick={() => loadNotifications()}>Thử lại</button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="admin-notification-state">
                    <Bell size={25} />
                    <strong>Chưa có cảnh báo kho</strong>
                    <span>Thông báo sẽ xuất hiện khi nguyên liệu sắp hết hoặc hết hàng.</span>
                  </div>
                ) : notifications.map((item) => {
                  const type = notificationTypeOf(item);
                  const outOfStock = type.includes('HET_HANG') || item?.trangThaiTonKho === 'HET_HANG';
                  return (
                    <button
                      type="button"
                      className={`admin-notification-item${isUnread(item) ? ' unread' : ''}`}
                      key={notificationIdOf(item) ?? `${notificationTitleOf(item)}-${notificationTimeOf(item)}`}
                      onClick={() => openNotification(item)}
                    >
                      <span className={`admin-notification-icon ${outOfStock ? 'out' : 'low'}`}>
                        {outOfStock ? <PackageX size={19} /> : <TriangleAlert size={19} />}
                      </span>
                      <span className="admin-notification-copy">
                        <span className="admin-notification-title-row">
                          <strong>{notificationTitleOf(item)}</strong>
                          {isUnread(item) ? <i aria-label="Chưa đọc" /> : null}
                        </span>
                        <span>{notificationMessageOf(item)}</span>
                        <small><Clock3 size={12} />{formatDate(notificationTimeOf(item))}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="admin-notification-footer"
                onClick={() => {
                  setNotificationOpen(false);
                  navigate('/admin/inventory');
                }}
              >
                Xem kho nguyên liệu
              </button>
            </section>
          ) : null}
        </div>

        <div className="admin-profile-wrap" ref={profileRef}>
          <button
            type="button"
            className="admin-profile admin-profile-button"
            onClick={() => {
              setProfileOpen((value) => !value);
              setNotificationOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <div className="avatar">
              {avatar ? <img src={imageUrl(avatar)} alt={`Ảnh đại diện của ${name}`} /> : name.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{name}</strong>
              <span>{roleLabel}</span>
            </div>
            <ChevronDown className={profileOpen ? 'profile-chevron open' : 'profile-chevron'} size={18} />
          </button>

          {profileOpen ? (
            <div className="admin-profile-menu" role="menu">
              <Link to="/admin/account" role="menuitem" onClick={() => setProfileOpen(false)}>
                <UserRound size={17} />
                Tài khoản
              </Link>
              <button type="button" role="menuitem" onClick={logout}>
                <LogOut size={17} />
                Đăng xuất
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
