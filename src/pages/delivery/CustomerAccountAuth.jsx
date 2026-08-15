import {
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { customerAccountApi } from '../../api/customerAccountApi';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { imageUrl } from '../../utils/imageUrl';
import {
  continueAsGuest,
  getCustomerUser,
  saveCustomerSession,
} from '../../utils/customerSession';
import { unwrapDeliveryResponse } from '../../utils/delivery';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import '../../styles/login.css';

const customerBenefits = [
  { icon: ShoppingBag, label: 'Đặt món' },
  { icon: Clock3, label: 'Theo dõi' },
  { icon: TicketPercent, label: 'Tích điểm' },
  { icon: UserRound, label: 'Tài khoản' },
];

function LoginBrandLogo({ restaurantName, logoUrl }) {
  const logo = imageUrl(logoUrl);
  return logo ? (
    <span className="lumora-login-brand-logo-image">
      <img src={logo} alt={`Logo ${restaurantName || 'LUMORA'}`} />
    </span>
  ) : (
    <span className="lumora-login-brand-home-mark" aria-hidden="true">
      {(restaurantName || 'L').trim().charAt(0).toUpperCase()}
    </span>
  );
}

export default function CustomerAccountAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const rawNext = new URLSearchParams(location.search).get('next') || '/menu';
  const next = rawNext.startsWith('/menu') ? rawNext : '/menu';
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ hoTen: '', soDienThoai: '', matKhau: '' });
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

  useEffect(() => {
    if (getCustomerUser()) navigate(next, { replace: true });
  }, [navigate, next]);

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        if (data) setBrandSettings((current) => ({ ...current, ...data }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const change = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError('');
  };

  function switchMode() {
    setMode((current) => current === 'login' ? 'register' : 'login');
    setError('');
    setShowPassword(false);
  }

  function handleContinueAsGuest() {
    continueAsGuest();
    navigate(next, { replace: true });
  }

  async function submit(event) {
    event.preventDefault();
    const phone = form.soDienThoai.trim();
    const password = form.matKhau;
    const name = form.hoTen.trim();

    if (mode === 'register' && !name) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!phone || !password) {
      setError('Vui lòng nhập đầy đủ số điện thoại và mật khẩu.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = mode === 'register'
        ? await customerAccountApi.register({ hoTen: name, soDienThoai: phone, matKhau: password })
        : await customerAccountApi.login({ soDienThoai: phone, matKhau: password });
      const auth = unwrapDeliveryResponse(response);
      saveCustomerSession(auth);
      toast.success(mode === 'register' ? 'Đăng ký thành công.' : 'Đăng nhập thành công.');
      navigate(next, { replace: true });
    } catch (requestError) {
      const message = errorMessageOf(
        requestError,
        mode === 'register' ? 'Không thể đăng ký tài khoản.' : 'Số điện thoại hoặc mật khẩu không chính xác.'
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lumora-login-page">
      <div className="lumora-customer-auth-language"><LanguageSwitcher /></div>
      <section className="lumora-login-shell" aria-label="Đăng nhập khách hàng LUMORA">
        <aside className="lumora-login-showcase">
          <div className="lumora-login-orb lumora-login-orb-one" />
          <div className="lumora-login-orb lumora-login-orb-two" />

          <div className="lumora-login-brand">
            <LoginBrandLogo restaurantName={brandSettings.restaurantName} logoUrl={brandSettings.logoUrl} />
            {!brandSettings.logoUrl && (
              <div>
                <strong>{brandSettings.restaurantName || 'LUMORA'}</strong>
                <span>Restaurant</span>
              </div>
            )}
          </div>

          <div className="lumora-login-copy">
            <span className="lumora-login-eyebrow">
              <Sparkles size={13} />
              Đặt món trực tuyến
            </span>
            <h1>Chào mừng bạn đến với LUMORA</h1>
            <p>
              Đăng nhập để đặt món thuận tiện hơn, lưu lịch sử đơn hàng và tích lũy ưu đãi cho những lần tiếp theo.
            </p>
          </div>

          <div className="lumora-login-roles" aria-label="Tiện ích dành cho khách hàng">
            {customerBenefits.map(({ icon: Icon, label }) => (
              <div key={label}>
                <Icon size={15} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="lumora-login-panel">
          <div className="lumora-login-mobile-brand">
            <LoginBrandLogo restaurantName={brandSettings.restaurantName} logoUrl={brandSettings.logoUrl} />
            {!brandSettings.logoUrl && <strong>{brandSettings.restaurantName || 'LUMORA'}</strong>}
          </div>

          <div className="lumora-login-form-wrap">
            <div className="lumora-login-heading">
              <span>Tài khoản khách hàng</span>
              <h2>{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2>
              <p>
                {mode === 'login'
                  ? 'Đăng nhập để tự điền thông tin, xem lịch sử đơn và tích điểm.'
                  : 'Tạo tài khoản bằng số điện thoại để sử dụng các tiện ích dành cho thành viên.'}
              </p>
            </div>

            <form className="lumora-login-form" onSubmit={submit} noValidate>
              {error && (
                <div className="lumora-login-error" role="alert">
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              {mode === 'register' ? (
                <label className="lumora-login-field">
                  <span>Họ tên</span>
                  <div className="lumora-login-input-wrap">
                    <UserRound size={17} aria-hidden="true" />
                    <input
                      name="customer-name"
                      value={form.hoTen}
                      onChange={change('hoTen')}
                      placeholder="Nguyễn Văn A"
                      autoComplete="name"
                      maxLength={100}
                      disabled={loading}
                    />
                  </div>
                </label>
              ) : null}

              <label className="lumora-login-field">
                <span>Số điện thoại</span>
                <div className="lumora-login-input-wrap">
                  <Phone size={17} aria-hidden="true" />
                  <input
                    name="customer-phone"
                    value={form.soDienThoai}
                    onChange={change('soDienThoai')}
                    placeholder="0901234567"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={20}
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </label>

              <label className="lumora-login-field">
                <span>Mật khẩu</span>
                <div className="lumora-login-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    name="customer-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.matKhau}
                    onChange={change('matKhau')}
                    placeholder={mode === 'register' ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    minLength={6}
                    maxLength={100}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="lumora-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <button className="lumora-login-submit" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <LoaderCircle className="lumora-login-spinner" size={18} />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="lumora-login-divider" aria-hidden="true"><span>hoặc</span></div>

            <div className="lumora-customer-login-options">
              <button type="button" className="lumora-customer-mode-switch" onClick={switchMode} disabled={loading}>
                {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </button>
              <button type="button" className="lumora-customer-guest-button" onClick={handleContinueAsGuest} disabled={loading}>
                Tiếp tục không đăng nhập <ArrowRight size={16} />
              </button>
            </div>

            <div className="lumora-login-security">
              <ShieldCheck size={15} />
              <span>Không bắt buộc tài khoản. Khách vãng lai vẫn có thể đặt món bình thường.</span>
            </div>
          </div>

          <p className="lumora-login-copyright">© 2026 LUMORA · Đặt món trực tuyến</p>
        </div>
      </section>
    </main>
  );
}

