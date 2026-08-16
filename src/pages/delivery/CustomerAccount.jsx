import { History, LogOut, ShoppingBag, Star, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { customerAccountApi } from '../../api/customerAccountApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { clearCustomerSession, getCustomerToken, getCustomerUser, saveCustomerSession } from '../../utils/customerSession';
import { deliveryStatusLabel, displayOrderCode, unwrapDeliveryResponse } from '../../utils/delivery';
import { formatMoney } from '../../utils/formatMoney';

export default function CustomerAccount() {
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState(getCustomerUser());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getCustomerToken()) { navigate('/login?next=/menu/account', { replace: true }); return; }
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
        clearCustomerSession();
        toast.error(errorMessageOf(error, 'Phiên đăng nhập đã hết hạn.'));
        navigate('/login?next=/menu/account', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate, toast]);

  function logout() {
    clearCustomerSession();
    toast.success('Đã đăng xuất tài khoản khách hàng.');
    navigate('/menu', { replace: true });
  }

  return <main className="delivery-public-page">
    <DeliveryPublicHeader compact />
    <section className="delivery-public-container delivery-account-page">
      <div className="delivery-account-hero">
        <span><UserRound size={24}/></span>
        <div><small>TÀI KHOẢN KHÁCH HÀNG</small><h1>{user?.hoTen || 'Khách hàng'}</h1><p>{user?.soDienThoai || ''}</p></div>
        <button onClick={logout}><LogOut size={17}/> Đăng xuất</button>
      </div>
      <div className="delivery-account-stats">
        <article><Star size={20}/><span>Điểm tích lũy</span><strong>{Number(user?.diemTichLuy || 0)}</strong></article>
        <article><ShoppingBag size={20}/><span>Tổng đơn online</span><strong>{orders.length}</strong></article>
      </div>
      <section className="delivery-account-orders">
        <div className="delivery-account-section-title"><div><History size={20}/><span><strong>Lịch sử đơn hàng</strong><small>Các đơn được đặt khi bạn đăng nhập</small></span></div><Link to="/menu">Đặt món</Link></div>
        {loading ? <p className="delivery-account-empty">Đang tải đơn hàng...</p> : orders.length ? <div className="delivery-account-order-list">
          {orders.map((order, index) => {
            const token = order?.trackingToken;
            return <Link key={token || order?.maDonHang || index} to={token ? `/menu/orders/${encodeURIComponent(token)}` : '/menu/lookup'}>
              <div><strong>{displayOrderCode(order)}</strong><span>{deliveryStatusLabel(order?.trangThaiGiaoHang || order?.deliveryStatus || order?.trangThai)}</span></div>
              <div><span>{order?.tenNguoiNhan || user?.hoTen}</span><strong>{formatMoney(Number(order?.tongThanhToan ?? order?.tongTien ?? 0))}</strong></div>
            </Link>;
          })}
        </div> : <p className="delivery-account-empty">Bạn chưa có đơn hàng nào được liên kết với tài khoản này.</p>}
      </section>
    </section>
  </main>;
}
