import { CheckCircle2, History, LogOut, PackageSearch, Pencil, Phone, Save, ShoppingBag, Star, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { customerAccountApi } from '../../api/customerAccountApi';
import { useAuth } from '../../context/AuthContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { getCustomerToken, getCustomerUser, saveCustomerSession } from '../../utils/customerSession';
import { deliveryStatusLabel, displayOrderCode, unwrapDeliveryResponse } from '../../utils/delivery';
import { formatDate } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';

const ACCOUNT_ORDER_PAGE_SIZE = 10;
const ORDER_FILTERS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang xử lý' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

function orderStatus(order) {
  return String(order?.trangThaiGiaoHang || order?.deliveryStatus || order?.trangThai || '').trim().toUpperCase();
}

function isCompleted(order) {
  return orderStatus(order) === 'HOAN_THANH';
}

function matchesFilter(order, filter) {
  const status = orderStatus(order);
  if (filter === 'COMPLETED') return status === 'HOAN_THANH';
  if (filter === 'CANCELLED') return status === 'DA_HUY';
  if (filter === 'ACTIVE') return Boolean(status) && !['HOAN_THANH', 'DA_HUY'].includes(status);
  return true;
}

function receiveMethodLabel(order) {
  return String(order?.phuongThucNhanHang || '').toUpperCase() === 'TU_DEN_LAY' ? 'Đến lấy tại nhà hàng' : 'Giao tận nơi';
}

export default function CustomerAccount() {
  const navigate = useNavigate();
  const toast = useToast();
  const { logout: authLogout } = useAuth();
  const [user, setUser] = useState(getCustomerUser());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({ hoTen: '', soDienThoai: '' });

  useEffect(() => {
    if (!getCustomerToken()) {
      authLogout();
      navigate('/login?next=/menu/account', { replace: true });
      return;
    }
    Promise.all([customerAccountApi.me(), customerAccountApi.orders()])
      .then(([meResponse, ordersResponse]) => {
        const me = unwrapDeliveryResponse(meResponse);
        const rows = unwrapDeliveryResponse(ordersResponse);
        setUser(me);
        setOrders(Array.isArray(rows) ? rows : []);
        const token = getCustomerToken();
        if (token && me) saveCustomerSession({ token, ...me });
      })
      .catch((error) => {
        authLogout();
        toast.error(errorMessageOf(error, 'Phiên đăng nhập đã hết hạn.'));
        navigate('/login?next=/menu/account', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [authLogout, navigate, toast]);

  const filteredOrders = useMemo(() => orders.filter((order) => matchesFilter(order, orderFilter)), [orders, orderFilter]);
  const completedOrders = useMemo(() => orders.filter(isCompleted).length, [orders]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ACCOUNT_ORDER_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visibleOrders = filteredOrders.slice((safePage - 1) * ACCOUNT_ORDER_PAGE_SIZE, safePage * ACCOUNT_ORDER_PAGE_SIZE);

  function changeFilter(filter) {
    setOrderFilter(filter);
    setCurrentPage(1);
  }

  function logout() {
    authLogout();
    toast.success('Đã đăng xuất tài khoản khách hàng.');
    navigate('/menu', { replace: true });
  }

  function openProfileEditor() {
    setProfileForm({
      hoTen: user?.hoTen || '',
      soDienThoai: user?.soDienThoai || '',
    });
    setProfileError('');
    setEditingProfile(true);
  }

  function closeProfileEditor() {
    if (savingProfile) return;
    setEditingProfile(false);
    setProfileError('');
  }

  function normalizedPhone(value) {
    let phone = String(value || '').trim().replace(/[\s().-]/g, '');
    if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`;
    else if (phone.startsWith('84') && phone.length >= 11) phone = `0${phone.slice(2)}`;
    return phone;
  }

  async function saveProfile(event) {
    event.preventDefault();
    const hoTen = profileForm.hoTen.trim();
    const soDienThoai = normalizedPhone(profileForm.soDienThoai);

    if (!hoTen) {
      setProfileError('Vui lòng nhập họ tên.');
      return;
    }
    if (!/^0[0-9]{8,10}$/.test(soDienThoai)) {
      setProfileError('Số điện thoại không hợp lệ.');
      return;
    }

    setProfileError('');
    setSavingProfile(true);
    try {
      const response = await customerAccountApi.updateMe({ hoTen, soDienThoai });
      const auth = unwrapDeliveryResponse(response);
      if (!auth?.token) throw new Error('Không nhận được phiên đăng nhập mới sau khi cập nhật.');
      saveCustomerSession(auth);
      setUser({
        maKhachHang: auth.maKhachHang,
        hoTen: auth.hoTen || hoTen,
        soDienThoai: auth.soDienThoai || soDienThoai,
        diemTichLuy: Number(auth.diemTichLuy || 0),
      });
      setEditingProfile(false);
      toast.success('Cập nhật thông tin thành công.');
    } catch (error) {
      const message = errorMessageOf(error, 'Không thể cập nhật thông tin tài khoản.');
      setProfileError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  return <main className="delivery-public-page">
    <DeliveryPublicHeader homeStyle />
    <section className="delivery-public-container delivery-account-page delivery-account-dashboard">
      <section className="delivery-account-profile-card">
        <div className="delivery-account-profile-main">
          <span className="delivery-account-avatar"><UserRound size={26}/></span>
          <div>
            <small>TÀI KHOẢN KHÁCH HÀNG</small>
            <h1>{user?.hoTen || 'Khách hàng'}</h1>
            <p>{user?.soDienThoai || ''}</p>
            <span className="delivery-account-member-badge">Khách hàng Lumora</span>
          </div>
        </div>
        <div className="delivery-account-profile-actions">
          <button className="delivery-account-edit-profile" type="button" onClick={openProfileEditor}><Pencil size={16}/> Chỉnh sửa thông tin</button>
          <button className="delivery-account-logout" type="button" onClick={logout}><LogOut size={17}/> Đăng xuất</button>
        </div>
      </section>

      <section className="delivery-account-stats delivery-account-stats-dashboard">
        <article><span className="delivery-account-stat-icon"><Star size={19}/></span><div><span>Điểm tích lũy</span><strong>{Number(user?.diemTichLuy || 0)}</strong></div></article>
        <article><span className="delivery-account-stat-icon"><ShoppingBag size={19}/></span><div><span>Tổng đơn online</span><strong>{orders.length}</strong></div></article>
        <article><span className="delivery-account-stat-icon"><CheckCircle2 size={19}/></span><div><span>Đơn hoàn thành</span><strong>{completedOrders}</strong></div></article>
      </section>

      <section className="delivery-account-orders delivery-account-orders-dashboard">
        <div className="delivery-account-section-title delivery-account-section-title-dashboard">
          <div><History size={20}/><span><strong>Đơn hàng của tôi</strong><small>Theo dõi và xem lại các đơn đã đặt khi đăng nhập</small></span></div>
          <Link to="/menu">Đặt món</Link>
        </div>

        <div className="delivery-account-order-filters" role="tablist" aria-label="Lọc đơn hàng">
          {ORDER_FILTERS.map((filter) => <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={orderFilter === filter.value}
            className={orderFilter === filter.value ? 'active' : ''}
            onClick={() => changeFilter(filter.value)}
          >{filter.label}</button>)}
        </div>

        {loading ? <p className="delivery-account-empty">Đang tải đơn hàng...</p> : filteredOrders.length ? <div className="delivery-account-order-list delivery-account-order-list-dashboard">
          {visibleOrders.map((order, index) => {
            const token = order?.trackingToken;
            const orderedAt = order?.thoiGianDat || order?.ngayTao || order?.createdAt;
            const status = order?.trangThaiGiaoHang || order?.deliveryStatus || order?.trangThai;
            return <Link key={token || order?.maDonHang || index} to={token ? `/menu/orders/${encodeURIComponent(token)}` : '/menu/lookup'}>
              <div className="delivery-account-order-main">
                <div className="delivery-account-order-heading"><strong>{displayOrderCode(order)}</strong><span>{deliveryStatusLabel(status)}</span></div>
                <div className="delivery-account-order-meta">
                  {orderedAt ? <small>Đặt lúc {formatDate(orderedAt)}</small> : null}
                  <small>{receiveMethodLabel(order)}</small>
                </div>
              </div>
              <div className="delivery-account-order-side">
                <strong>{formatMoney(Number(order?.tongThanhToan ?? order?.tongTien ?? 0))}</strong>
                <span><PackageSearch size={14}/> {isCompleted(order) ? 'Xem chi tiết' : 'Theo dõi đơn'} →</span>
              </div>
            </Link>;
          })}
        </div> : <p className="delivery-account-empty">{orderFilter === 'ALL' ? 'Bạn chưa có đơn hàng nào được liên kết với tài khoản này.' : 'Không có đơn hàng phù hợp với bộ lọc này.'}</p>}

        {!loading && filteredOrders.length > ACCOUNT_ORDER_PAGE_SIZE ? <div className="delivery-account-pagination">
          <span>Hiển thị {(safePage - 1) * ACCOUNT_ORDER_PAGE_SIZE + 1}–{Math.min(safePage * ACCOUNT_ORDER_PAGE_SIZE, filteredOrders.length)} / {filteredOrders.length} đơn</span>
          <div>
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1}>‹ Trước</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" className={page === safePage ? 'active' : ''} onClick={() => setCurrentPage(page)}>{page}</button>)}
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages}>Sau ›</button>
          </div>
        </div> : null}
      </section>
    </section>

    {editingProfile ? <div className="delivery-account-profile-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeProfileEditor()}>
      <section className="delivery-account-profile-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-account-profile-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="delivery-account-profile-close" type="button" onClick={closeProfileEditor} aria-label="Đóng" disabled={savingProfile}><X size={18}/></button>
        <span className="delivery-account-profile-modal-icon"><Pencil size={22}/></span>
        <small>THÔNG TIN CÁ NHÂN</small>
        <h2 id="delivery-account-profile-title">Chỉnh sửa thông tin</h2>
        <p>Cập nhật họ tên và số điện thoại dùng cho tài khoản khách hàng Lumora.</p>

        <form onSubmit={saveProfile}>
          <label>
            <span>Họ và tên</span>
            <div><UserRound size={17}/><input value={profileForm.hoTen} onChange={(event) => setProfileForm((current) => ({ ...current, hoTen: event.target.value }))} placeholder="Nhập họ và tên" autoComplete="name" disabled={savingProfile}/></div>
          </label>
          <label>
            <span>Số điện thoại</span>
            <div><Phone size={17}/><input value={profileForm.soDienThoai} onChange={(event) => setProfileForm((current) => ({ ...current, soDienThoai: event.target.value }))} placeholder="Ví dụ: 0979792909" inputMode="tel" autoComplete="tel" disabled={savingProfile}/></div>
          </label>
          {profileError ? <p className="delivery-account-profile-error" role="alert">{profileError}</p> : null}
          <div className="delivery-account-profile-modal-actions">
            <button type="button" className="secondary" onClick={closeProfileEditor} disabled={savingProfile}>Hủy</button>
            <button type="submit" className="primary" disabled={savingProfile}><Save size={17}/>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
          </div>
        </form>
      </section>
    </div> : null}
  </main>;
}
