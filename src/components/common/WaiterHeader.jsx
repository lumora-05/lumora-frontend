import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  HandPlatter,
  LogOut,
  Menu,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { serviceRequestApi } from '../../api/serviceRequestApi';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { imageUrl } from '../../utils/imageUrl';
import { profileAvatarOf } from '../../utils/profileAvatar';
import {
  serviceRequestId,
  serviceRequestStatus,
  serviceRequestTableLabel,
  serviceRequestTypeLabel,
  serviceRequestWaitLabel,
  unwrapServiceRequestList,
} from '../../utils/serviceRequests';
import {
  orderCreatedAt,
  orderGroup,
  orderId,
  tableNameOfOrder,
  unwrapList,
  waitLabel,
} from '../../utils/waiterData';

const ORDER_NOTIFICATION_META = {
  KITCHEN: {
    icon: ReceiptText,
    tone: 'blue',
    title: 'Đơn đã chuyển xuống bếp',
    description: 'Khách vừa gửi đơn và đơn đã được chuyển đến bếp.',
  },
  READY: {
    icon: CheckCircle2,
    tone: 'green',
    title: 'Món đã sẵn sàng',
    description: 'Bếp đã hoàn thành món, cần mang ra bàn.',
  },
  PAYMENT: {
    icon: CreditCard,
    tone: 'orange',
    title: 'Yêu cầu thanh toán',
    description: 'Khách đang chờ thanh toán.',
  },
};

const NOTIFICATION_TABS = [
  ['ALL', 'Tất cả'],
  ['ORDER', 'Đơn hàng'],
  ['REQUEST', 'Yêu cầu tại bàn'],
];

function orderNotificationTime(order) {
  return order?.thoiGianCapNhat
    || order?.updatedAt
    || order?.ngayCapNhat
    || orderCreatedAt(order);
}

function serviceRequestTime(item) {
  return item?.thoiGianCapNhat
    || item?.updatedAt
    || item?.thoiGianTao
    || null;
}

function orderNotificationGroup(order) {
  const status = String(order?.trangThai || '').toUpperCase();
  if (['CHO_XAC_NHAN', 'DA_XAC_NHAN'].includes(status)) return 'KITCHEN';
  return orderGroup(order);
}

function realtimeOrderData(event) {
  return event?.body?.data || event?.body || {};
}

export default function WaiterHeader({ title, subtitle, onOpenMenu }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const event = useWebSocket(['/topic/orders', '/topic/kitchen', '/topic/service-requests']);
  const [orders, setOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState('ALL');
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const name = user?.hoTen || user?.fullName || user?.tenDangNhap || user?.username || 'Nhân viên';
  const avatar = profileAvatarOf(user);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setNotificationLoading(true);
      setNotificationError('');
      const [orderResponse, serviceResponse] = await Promise.all([
        orderApi.getAll(),
        serviceRequestApi.list('ACTIVE'),
      ]);
      setOrders(unwrapList(orderResponse));
      setServiceRequests(unwrapServiceRequestList(serviceResponse));
    } catch {
      setNotificationError('Không thể tải thông báo.');
    } finally {
      if (!silent) setNotificationLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => {
    if (event?.topic === '/topic/orders' || event?.topic === '/topic/kitchen' || event?.topic === '/topic/service-requests') {
      loadNotifications({ silent: true });
    }

    if (event?.topic === '/topic/orders') {
      const type = event?.body?.type;
      const data = realtimeOrderData(event);
      const id = data?.maDonHang ?? data?.id;
      const tableName = data?.banAn?.tenBan || data?.tenBan || (data?.maBan ? `Bàn ${data.maBan}` : 'Một bàn');
      if (type === 'NEW_ORDER') {
        toast.info(`${tableName} vừa gửi đơn${id ? ` #${id}` : ''}. Đơn đã chuyển xuống bếp.`, {
          id: `waiter-new-order-${id || event?.body?.createdAt || 'latest'}`,
          duration: 5000,
        });
      } else if (type === 'ORDER_ITEMS_ADDED') {
        toast.info(`${tableName} vừa gọi thêm món${id ? ` cho đơn #${id}` : ''}. Món mới đã chuyển xuống bếp.`, {
          id: `waiter-added-items-${id || 'latest'}-${data?.lanGoi || event?.body?.createdAt || ''}`,
          duration: 5000,
        });
      }
    }
  }, [event, loadNotifications, toast]);

  useEffect(() => {
    setNotificationOpen(false);
    setProfileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handlePointerDown(pointerEvent) {
      if (notificationRef.current && !notificationRef.current.contains(pointerEvent.target)) {
        setNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(pointerEvent.target)) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') {
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const notifications = useMemo(() => {
    const orderNotifications = orders
      .map((order) => {
        const group = orderNotificationGroup(order);
        const meta = ORDER_NOTIFICATION_META[group];
        const id = orderId(order);
        if (!meta || !id) return null;
        return {
          id: `order-${id}`,
          type: 'ORDER',
          tone: meta.tone,
          icon: meta.icon,
          title: `${meta.title} · ${tableNameOfOrder(order)}`,
          description: `${meta.description} Mã đơn #${id}.`,
          time: orderNotificationTime(order),
          timeLabel: waitLabel(orderNotificationTime(order)),
          to: `/waiter/orders/${id}`,
        };
      })
      .filter(Boolean);

    const requestNotifications = serviceRequests
      .filter((item) => ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item)))
      .map((item) => ({
        id: `request-${serviceRequestId(item)}`,
        type: 'REQUEST',
        tone: item?.quaHan ? 'red' : 'purple',
        icon: HandPlatter,
        title: `${serviceRequestTableLabel(item)} · ${serviceRequestTypeLabel(item)}`,
        description: item?.noiDung || (serviceRequestStatus(item) === 'DA_TIEP_NHAN'
          ? 'Yêu cầu đã được tiếp nhận và đang xử lý.'
          : 'Khách đang chờ nhân viên hỗ trợ.'),
        time: serviceRequestTime(item),
        timeLabel: serviceRequestWaitLabel(item),
        to: '/waiter/requests',
      }));

    return [...orderNotifications, ...requestNotifications]
      .filter((item) => notificationTab === 'ALL' || item.type === notificationTab)
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  }, [notificationTab, orders, serviceRequests]);

  const orderCount = useMemo(
    () => orders.filter((order) => ORDER_NOTIFICATION_META[orderNotificationGroup(order)]).length,
    [orders],
  );
  const newServiceCount = useMemo(
    () => serviceRequests.filter((item) => serviceRequestStatus(item) === 'MOI').length,
    [serviceRequests],
  );
  const activeServiceCount = useMemo(
    () => serviceRequests.filter((item) => ['MOI', 'DA_TIEP_NHAN'].includes(serviceRequestStatus(item))).length,
    [serviceRequests],
  );
  const totalBadgeCount = orderCount + newServiceCount;
  const badge = totalBadgeCount > 99 ? '99+' : String(totalBadgeCount);

  function toggleNotifications() {
    setProfileOpen(false);
    setNotificationOpen((current) => !current);
  }

  function toggleProfile() {
    setNotificationOpen(false);
    setProfileOpen((current) => !current);
  }

  return (
    <header className="waiter-topbar">
      <div className="waiter-title-wrap">
        <button type="button" className="waiter-menu-button" onClick={onOpenMenu} aria-label="Mở menu phục vụ"><Menu size={22} /></button>
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="waiter-top-actions">
        <div className="waiter-notification-wrap" ref={notificationRef}>
          <button
            type="button"
            className={`waiter-notification-btn${notificationOpen ? ' active' : ''}`}
            aria-label={`${totalBadgeCount} thông báo cần xử lý`}
            aria-haspopup="dialog"
            aria-expanded={notificationOpen}
            onClick={toggleNotifications}
          >
            <Bell size={22} />
            {totalBadgeCount > 0 ? <span>{badge}</span> : null}
          </button>

          {notificationOpen ? (
            <section className="waiter-notification-panel" role="dialog" aria-label="Thông báo phục vụ">
              <div className="waiter-notification-panel-head">
                <div>
                  <strong>Thông báo phục vụ</strong>
                  <small>{orderCount} việc từ đơn hàng · {activeServiceCount} yêu cầu tại bàn</small>
                </div>
                <button type="button" onClick={() => loadNotifications()} disabled={notificationLoading}>Làm mới</button>
              </div>

              <div className="waiter-notification-tabs" role="tablist" aria-label="Lọc thông báo">
                {NOTIFICATION_TABS.map(([value, label]) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={notificationTab === value}
                    key={value}
                    className={notificationTab === value ? 'active' : ''}
                    onClick={() => setNotificationTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="waiter-notification-list">
                {notificationLoading ? (
                  <div className="waiter-notification-state">Đang tải thông báo...</div>
                ) : notificationError ? (
                  <div className="waiter-notification-state error">{notificationError}</div>
                ) : notifications.length ? notifications.slice(0, 8).map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} to={item.to} className="waiter-notification-item" onClick={() => setNotificationOpen(false)}>
                      <span className={`waiter-notification-item-icon ${item.tone}`}><Icon size={19} /></span>
                      <span className="waiter-notification-item-copy">
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                        <small><Clock3 size={12} />{item.timeLabel}</small>
                      </span>
                    </Link>
                  );
                }) : (
                  <div className="waiter-notification-state">Không có thông báo cần xử lý.</div>
                )}
              </div>

              <div className="waiter-notification-panel-footer">
                <Link to="/waiter/orders" onClick={() => setNotificationOpen(false)}>Xem đơn đang phục vụ</Link>
                <Link to="/waiter/requests" onClick={() => setNotificationOpen(false)}>Xem yêu cầu tại bàn</Link>
              </div>
            </section>
          ) : null}
        </div>

        <div className="waiter-profile-wrap" ref={profileRef}>
          <button type="button" className="waiter-profile" onClick={toggleProfile} aria-expanded={profileOpen}>
            <div className="waiter-avatar">{avatar ? <img src={imageUrl(avatar)} alt="Ảnh đại diện" /> : name.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{name}</strong>
              <span>Nhân viên phục vụ</span>
            </div>
            <ChevronDown size={18} />
          </button>
          {profileOpen ? (
            <div className="waiter-profile-menu">
              <Link to="/waiter/account" onClick={() => setProfileOpen(false)}><UserRound size={17} />Tài khoản</Link>
              <button type="button" onClick={logout}><LogOut size={17} />Đăng xuất</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
