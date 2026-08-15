import { LockKeyhole, LogIn, Phone, UserRound, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { customerAccountApi } from '../../api/customerAccountApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { getCustomerUser, saveCustomerSession } from '../../utils/customerSession';
import { unwrapDeliveryResponse } from '../../utils/delivery';

export default function CustomerAccountAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ hoTen: '', soDienThoai: '', matKhau: '' });

  useEffect(() => {
    if (getCustomerUser()) navigate('/menu/account', { replace: true });
  }, [navigate]);

  const next = new URLSearchParams(location.search).get('next') || '/menu';
  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = mode === 'register'
        ? await customerAccountApi.register({ hoTen: form.hoTen.trim(), soDienThoai: form.soDienThoai.trim(), matKhau: form.matKhau })
        : await customerAccountApi.login({ soDienThoai: form.soDienThoai.trim(), matKhau: form.matKhau });
      const auth = unwrapDeliveryResponse(response);
      saveCustomerSession(auth);
      toast.success(mode === 'register' ? 'Đăng ký thành công.' : 'Đăng nhập thành công.');
      navigate(next, { replace: true });
    } catch (error) {
      toast.error(errorMessageOf(error, mode === 'register' ? 'Không thể đăng ký tài khoản.' : 'Không thể đăng nhập.'));
    } finally {
      setLoading(false);
    }
  }

  return <main className="delivery-public-page">
    <DeliveryPublicHeader compact />
    <section className="delivery-customer-auth-wrap">
      <div className="delivery-customer-auth-card">
        <span className="delivery-customer-auth-icon">{mode === 'login' ? <LogIn size={24}/> : <UserPlus size={24}/>}</span>
        <h1>{mode === 'login' ? 'Đăng nhập khách hàng' : 'Tạo tài khoản khách hàng'}</h1>
        <p>Đăng nhập để tự điền thông tin, xem lịch sử đơn và theo dõi thuận tiện hơn. Bạn vẫn có thể đặt món mà không cần tài khoản.</p>
        <form onSubmit={submit}>
          {mode === 'register' ? <label><span>Họ tên *</span><div><UserRound size={18}/><input required maxLength={100} value={form.hoTen} onChange={change('hoTen')} placeholder="Nguyễn Văn A"/></div></label> : null}
          <label><span>Số điện thoại *</span><div><Phone size={18}/><input required inputMode="tel" maxLength={20} value={form.soDienThoai} onChange={change('soDienThoai')} placeholder="0901234567"/></div></label>
          <label><span>Mật khẩu *</span><div><LockKeyhole size={18}/><input required minLength={6} maxLength={100} type="password" value={form.matKhau} onChange={change('matKhau')} placeholder="Tối thiểu 6 ký tự"/></div></label>
          <button disabled={loading} type="submit">{loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
        </form>
        <button className="delivery-customer-auth-switch" type="button" onClick={() => setMode((current) => current === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
        <Link className="delivery-customer-auth-guest" to={next}>Tiếp tục không đăng nhập</Link>
      </div>
    </section>
  </main>;
}
