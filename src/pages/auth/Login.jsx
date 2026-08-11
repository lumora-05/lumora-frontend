import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChefHat,
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react';
import GoogleLoginButton from '../../components/auth/GoogleLoginButton';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { imageUrl } from '../../utils/imageUrl';
import { useAuth } from '../../context/AuthContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import '../../styles/login.css';

const getHomePath = (role = '') => {
  const normalizedRole = role.replace('ROLE_', '');

  if (normalizedRole === 'ADMIN') return '/admin';
  if (normalizedRole === 'WAITER') return '/waiter';
  if (normalizedRole === 'KITCHEN') return '/kitchen';
  if (normalizedRole === 'CASHIER') return '/cashier';

  return '/admin';
};

const roleItems = [
  { icon: LayoutDashboard, label: 'Quản trị' },
  { icon: UtensilsCrossed, label: 'Phục vụ' },
  { icon: ChefHat, label: 'Bếp' },
  { icon: ReceiptText, label: 'Thu ngân' },
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

export default function Login() {
  const toast = useToast();
  const navigate = useNavigate();
  const { login, loginWithGoogle, user } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        if (data) {
          setBrandSettings((current) => ({ ...current, ...data }));
        }
      })
      .catch(() => {
        // Giữ thương hiệu mặc định nếu backend tạm thời không phản hồi.
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user?.role) navigate(getHomePath(user.role), { replace: true });
  }, [navigate, user]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError('');
  };

  async function submit(event) {
    event.preventDefault();

    const username = form.username.trim();
    if (!username || !form.password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await login(username, form.password);

      navigate(getHomePath(loggedInUser.role), { replace: true });
    } catch (requestError) {
      const message = errorMessageOf(requestError, 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin(credential) {
    setError('');
    setIsSubmitting(true);

    try {
      const loggedInUser = await loginWithGoogle(credential);
      navigate(getHomePath(loggedInUser.role), { replace: true });
    } catch (requestError) {
      const message = errorMessageOf(
        requestError,
        'Không thể đăng nhập bằng Google.'
      );
      setError(message);
      toast.error(message);
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="lumora-login-page">
      <section className="lumora-login-shell" aria-label="Đăng nhập hệ thống quản lý nhà hàng LUMORA">
        <aside className="lumora-login-showcase">
          <div className="lumora-login-orb lumora-login-orb-one" />
          <div className="lumora-login-orb lumora-login-orb-two" />

          <div className="lumora-login-brand">
            <LoginBrandLogo restaurantName={brandSettings.restaurantName} logoUrl={brandSettings.logoUrl} />
            <div>
              <strong>{brandSettings.restaurantName || 'LUMORA'}</strong>
              <span>Restaurant Management</span>
            </div>
          </div>

          <div className="lumora-login-copy">
            <span className="lumora-login-eyebrow">
              <Sparkles size={13} />
              Hệ thống quản lý nhà hàng
            </span>
            <h1>Chào mừng bạn đến với LUMORA</h1>
            <p>
              Đơn giản hóa vận hành, nâng cao trải nghiệm phục vụ mỗi ngày.
            </p>
          </div>

          

          <div className="lumora-login-roles" aria-label="Các vai trò sử dụng hệ thống">
            {roleItems.map(({ icon: Icon, label }) => (
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
            <strong>{brandSettings.restaurantName || 'LUMORA'}</strong>
          </div>

          <div className="lumora-login-form-wrap">
            <div className="lumora-login-heading">
              <span>Cổng nhân viên</span>
              <h2>Đăng nhập</h2>
              <p>Sử dụng tài khoản do quản trị viên cấp để vào khu vực làm việc.</p>
            </div>

            <form className="lumora-login-form" onSubmit={submit} noValidate>
              {error && (
                <div className="lumora-login-error" role="alert">
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              <label className="lumora-login-field">
                <span>Tên đăng nhập</span>
                <div className="lumora-login-input-wrap">
                  <UserRound size={17} aria-hidden="true" />
                  <input
                    name="username"
                    value={form.username}
                    onChange={updateField('username')}
                    placeholder="Nhập tên đăng nhập"
                    autoComplete="username"
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
              </label>

              <label className="lumora-login-field">
                <span>Mật khẩu</span>
                <div className="lumora-login-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={updateField('password')}
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="lumora-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <div className="lumora-login-form-tools">
                <Link to="/forgot-password">Quên mật khẩu?</Link>
              </div>

              <button className="lumora-login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="lumora-login-spinner" size={18} />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="lumora-login-divider" aria-hidden="true">
              <span>hoặc</span>
            </div>

            <GoogleLoginButton
              disabled={isSubmitting}
              onSuccess={handleGoogleLogin}
              onError={(googleError) => {
                if (!googleError) return;
                const message = errorMessageOf(
                  googleError,
                  'Không thể hoàn tất đăng nhập bằng Google.'
                );
                setError((current) => current || message);
              }}
            />

            <div className="lumora-login-security">
              <ShieldCheck size={15} />
              <span>Quyền truy cập được thiết lập theo vai trò nhân viên.</span>
            </div>
          </div>

          <p className="lumora-login-copyright">© 2026 LUMORA · Hệ thống quản lý nhà hàng</p>
        </div>
      </section>
    </main>
  );
}
