import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { authApi } from '../../api/authApi';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { imageUrl } from '../../utils/imageUrl';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import '../../styles/login.css';

const EMAIL_KEY = 'lumora_password_reset_email';
const TOKEN_KEY = 'lumora_password_reset_token';
const EXPIRES_KEY = 'lumora_password_reset_otp_expires_at';
const OTP_LENGTH = 6;
const OTP_LIFETIME_SECONDS = 10 * 60;
const RESEND_SECONDS = 60;

const passwordRules = [
  { label: 'Từ 8 đến 72 ký tự', test: (value) => value.length >= 8 && value.length <= 72 },
  { label: 'Có chữ hoa và chữ thường', test: (value) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: 'Có ít nhất một chữ số', test: (value) => /\d/.test(value) },
  { label: 'Có ít nhất một ký tự đặc biệt', test: (value) => /[^A-Za-z0-9]/.test(value) },
  { label: 'Không chứa khoảng trắng', test: (value) => value.length > 0 && !/\s/.test(value) },
];

function maskEmail(value = '') {
  const [name = '', domain = ''] = value.split('@');
  if (!domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  const hidden = '*'.repeat(Math.max(3, name.length - visible.length));
  return `${visible}${hidden}@${domain}`;
}

function formatCountdown(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const remain = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${remain}`;
}

function RecoveryBrandLogo({ restaurantName, logoUrl }) {
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

function readInitialState() {
  const savedEmail = sessionStorage.getItem(EMAIL_KEY) || '';
  const savedToken = sessionStorage.getItem(TOKEN_KEY) || '';
  const savedExpiresAt = Number(sessionStorage.getItem(EXPIRES_KEY)) || 0;

  return {
    email: savedEmail,
    token: savedToken,
    expiresAt: savedExpiresAt,
    step: savedToken ? 3 : savedEmail ? 2 : 1,
  };
}

export default function ForgotPasswordOtp() {
  const initial = useMemo(readInitialState, []);
  const navigate = useNavigate();
  const toast = useToast();
  const otpRefs = useRef([]);

  const [step, setStep] = useState(initial.step);
  const [email, setEmail] = useState(initial.email);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [resetToken, setResetToken] = useState(initial.token);
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [otpRemaining, setOtpRemaining] = useState(0);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [passwords, setPasswords] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

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

  useEffect(() => {
    if (step !== 2) return undefined;

    const updateTime = () => {
      const remaining = expiresAt
        ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
        : 0;
      setOtpRemaining(remaining);
      setResendRemaining((current) => Math.max(0, current - 1));
    };

    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, step]);

  const passwordChecks = useMemo(
    () => passwordRules.map((rule) => ({ ...rule, valid: rule.test(passwords.password) })),
    [passwords.password]
  );

  const clearError = () => {
    if (error) setError('');
  };

  const startOtpSession = () => {
    const nextExpiresAt = Date.now() + OTP_LIFETIME_SECONDS * 1000;
    setExpiresAt(nextExpiresAt);
    setOtpRemaining(OTP_LIFETIME_SECONDS);
    setResendRemaining(RESEND_SECONDS);
    sessionStorage.setItem(EXPIRES_KEY, String(nextExpiresAt));
  };

  async function sendCode(event) {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = await authApi.sendPasswordResetCode({ email: normalizedEmail });
      setEmail(normalizedEmail);
      setOtp(Array(OTP_LENGTH).fill(''));
      setResetToken('');
      setStep(2);
      sessionStorage.setItem(EMAIL_KEY, normalizedEmail);
      sessionStorage.removeItem(TOKEN_KEY);
      startOtpSession();
      toast.success(messageOf(result, 'Nếu email tồn tại trong hệ thống, mã xác nhận đã được gửi.'));
      window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (requestError) {
      const message = errorMessageOf(requestError, 'Không thể gửi mã xác nhận. Vui lòng thử lại.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateOtp(index, rawValue) {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    clearError();

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, event) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(event) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    event.preventDefault();
    const nextOtp = Array(OTP_LENGTH).fill('');
    digits.split('').forEach((digit, index) => { nextOtp[index] = digit; });
    setOtp(nextOtp);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
    clearError();
  }

  async function verifyCode(event) {
    event.preventDefault();
    const code = otp.join('');

    if (code.length !== OTP_LENGTH) {
      setError('Vui lòng nhập đủ mã xác nhận gồm 6 chữ số.');
      return;
    }
    if (otpRemaining <= 0) {
      setError('Mã xác nhận đã hết hạn. Vui lòng gửi lại mã mới.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = await authApi.verifyPasswordResetCode({ email, code });
      const token = result?.resetToken || result?.token || result?.data?.resetToken;
      if (!token) throw new Error('Backend không trả về resetToken.');

      setResetToken(token);
      setStep(3);
      sessionStorage.setItem(TOKEN_KEY, token);
      toast.success(messageOf(result, 'Xác minh email thành công.'));
    } catch (requestError) {
      const message = errorMessageOf(requestError, 'Mã xác nhận không đúng hoặc đã hết hạn.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (resendRemaining > 0 || isSubmitting) return;
    await sendCode();
  }

  async function resetPassword(event) {
    event.preventDefault();

    if (!resetToken) {
      setError('Phiên xác minh không hợp lệ. Vui lòng thực hiện lại từ đầu.');
      return;
    }
    if (!passwordRules.every((rule) => rule.test(passwords.password))) {
      setError('Mật khẩu mới chưa đáp ứng đầy đủ yêu cầu bảo mật.');
      return;
    }
    if (passwords.password !== passwords.confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = await authApi.resetPasswordWithCode({
        resetToken,
        matKhauMoi: passwords.password,
        xacNhanMatKhauMoi: passwords.confirmPassword,
      });
      sessionStorage.removeItem(EMAIL_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXPIRES_KEY);
      setStep(4);
      toast.success(messageOf(result, 'Đặt lại mật khẩu thành công.'));
    } catch (requestError) {
      const message = errorMessageOf(requestError, 'Không thể đặt lại mật khẩu. Phiên xác minh có thể đã hết hạn.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeEmail() {
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
    setStep(1);
    setOtp(Array(OTP_LENGTH).fill(''));
    setResetToken('');
    setExpiresAt(0);
    setOtpRemaining(0);
    setResendRemaining(0);
    setError('');
  }

  return (
    <main className="lumora-login-page lumora-recovery-page">
      <section className="lumora-login-shell lumora-recovery-shell" aria-label="Khôi phục mật khẩu LUMORA">
        <aside className="lumora-login-showcase lumora-recovery-showcase">
          <div className="lumora-login-orb lumora-login-orb-one" />
          <div className="lumora-login-orb lumora-login-orb-two" />

          <div className="lumora-login-brand">
            <RecoveryBrandLogo restaurantName={brandSettings.restaurantName} logoUrl={brandSettings.logoUrl} />
            {!brandSettings.logoUrl && (
              <div>
                <strong>{brandSettings.restaurantName || 'LUMORA'}</strong>
                <span>Restaurant Management</span>
              </div>
            )}
          </div>

          <div className="lumora-login-copy lumora-recovery-copy">
            <span className="lumora-login-eyebrow">
              <Sparkles size={13} />
              Khôi phục tài khoản
            </span>
            <h1>Lấy lại quyền truy cập an toàn</h1>
            <p>
              Mã xác nhận chỉ được gửi tới email đã đăng ký của nhân viên và chỉ có hiệu lực trong thời gian ngắn.
            </p>
          </div>

          <div className="lumora-recovery-guide">
            {[
              ['1', 'Nhập email', 'Sử dụng email đã đăng ký trong hồ sơ nhân viên.'],
              ['2', 'Xác nhận mã', 'Nhập mã gồm 6 chữ số được gửi tới Gmail.'],
              ['3', 'Tạo mật khẩu mới', 'Đặt mật khẩu mạnh và đăng nhập lại.'],
            ].map(([number, title, description], index) => (
              <div key={number} className={step >= index + 1 ? 'is-active' : ''}>
                <span>{step > index + 1 ? <CheckCircle2 size={15} /> : number}</span>
                <section>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </section>
              </div>
            ))}
          </div>

          <div className="lumora-recovery-note">
            <ShieldCheck size={18} />
            <span>Không chia sẻ mã xác nhận hoặc mật khẩu mới với bất kỳ ai.</span>
          </div>
        </aside>

        <div className="lumora-login-panel lumora-recovery-panel">
          <div className="lumora-login-mobile-brand">
            <RecoveryBrandLogo restaurantName={brandSettings.restaurantName} logoUrl={brandSettings.logoUrl} />
            {!brandSettings.logoUrl && <strong>{brandSettings.restaurantName || 'LUMORA'}</strong>}
          </div>

          <div className="lumora-login-form-wrap lumora-recovery-form-wrap">
            {step < 4 && (
              <div className="lumora-recovery-progress" aria-label={`Bước ${step} trong 3`}>
                {[1, 2, 3].map((item) => (
                  <span key={item} className={step >= item ? 'is-active' : ''} />
                ))}
              </div>
            )}

            {step === 1 && (
              <>
                <div className="lumora-login-heading">
                  <span>Bước 1/3</span>
                  <h2>Quên mật khẩu?</h2>
                  <p>Nhập email đã đăng ký để nhận mã xác nhận gồm 6 chữ số.</p>
                </div>

                <form className="lumora-login-form" onSubmit={sendCode} noValidate>
                  {error && <RecoveryError message={error} />}
                  <label className="lumora-login-field">
                    <span>Email nhân viên</span>
                    <div className="lumora-login-input-wrap">
                      <Mail size={17} aria-hidden="true" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => { setEmail(event.target.value); clearError(); }}
                        placeholder="Nhập địa chỉ email"
                        autoComplete="email"
                        autoFocus
                        disabled={isSubmitting}
                      />
                    </div>
                  </label>
                  <PrimaryButton loading={isSubmitting} loadingText="Đang gửi mã...">
                    Gửi mã xác nhận <ArrowRight size={18} />
                  </PrimaryButton>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <div className="lumora-login-heading">
                  <span>Bước 2/3</span>
                  <h2>Xác nhận email</h2>
                  <p>Mã đã được gửi tới <strong>{maskEmail(email)}</strong>.</p>
                </div>

                <form className="lumora-login-form" onSubmit={verifyCode} noValidate>
                  {error && <RecoveryError message={error} />}
                  <div className="lumora-otp-group">
                    <div className="lumora-otp-label">
                      <span>Mã xác nhận</span>
                      <b className={otpRemaining <= 60 ? 'is-warning' : ''}>
                        {otpRemaining > 0 ? formatCountdown(otpRemaining) : 'Đã hết hạn'}
                      </b>
                    </div>
                    <div className="lumora-otp-inputs" onPaste={handleOtpPaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => { otpRefs.current[index] = element; }}
                          value={digit}
                          onChange={(event) => updateOtp(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          aria-label={`Chữ số thứ ${index + 1}`}
                          disabled={isSubmitting}
                        />
                      ))}
                    </div>
                  </div>

                  <PrimaryButton loading={isSubmitting} loadingText="Đang xác minh...">
                    Xác nhận mã <BadgeCheck size={18} />
                  </PrimaryButton>

                  <div className="lumora-recovery-actions">
                    <button type="button" onClick={changeEmail} disabled={isSubmitting}>
                      <ArrowLeft size={15} /> Đổi email
                    </button>
                    <button type="button" onClick={resendCode} disabled={resendRemaining > 0 || isSubmitting}>
                      <RefreshCw size={15} />
                      {resendRemaining > 0 ? `Gửi lại sau ${resendRemaining}s` : 'Gửi lại mã'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === 3 && (
              <>
                <div className="lumora-login-heading">
                  <span>Bước 3/3</span>
                  <h2>Tạo mật khẩu mới</h2>
                  <p>Email đã được xác minh. Hãy đặt mật khẩu mới cho tài khoản.</p>
                </div>

                <form className="lumora-login-form" onSubmit={resetPassword} noValidate>
                  {error && <RecoveryError message={error} />}
                  <PasswordField
                    label="Mật khẩu mới"
                    value={passwords.password}
                    visible={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    onChange={(value) => {
                      setPasswords((current) => ({ ...current, password: value }));
                      clearError();
                    }}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <PasswordField
                    label="Xác nhận mật khẩu mới"
                    value={passwords.confirmPassword}
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                    onChange={(value) => {
                      setPasswords((current) => ({ ...current, confirmPassword: value }));
                      clearError();
                    }}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />

                  <div className="lumora-password-rules">
                    {passwordChecks.map((rule) => (
                      <span key={rule.label} className={rule.valid ? 'is-valid' : ''}>
                        <CheckCircle2 size={13} /> {rule.label}
                      </span>
                    ))}
                  </div>

                  <PrimaryButton loading={isSubmitting} loadingText="Đang cập nhật...">
                    Đặt lại mật khẩu <KeyRound size={18} />
                  </PrimaryButton>
                </form>
              </>
            )}

            {step === 4 && (
              <div className="lumora-recovery-success">
                <div className="lumora-recovery-success-icon"><CheckCircle2 size={34} /></div>
                <span>Hoàn tất</span>
                <h2>Đặt lại mật khẩu thành công</h2>
                <p>Bạn có thể đăng nhập vào LUMORA bằng mật khẩu mới ngay bây giờ.</p>
                <button type="button" className="lumora-login-submit" onClick={() => navigate('/login', { replace: true })}>
                  Đăng nhập ngay <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step < 4 && (
              <Link className="lumora-back-to-login" to="/login">
                <ArrowLeft size={15} /> Quay lại đăng nhập
              </Link>
            )}
          </div>

          <p className="lumora-login-copyright">© 2026 LUMORA · Hệ thống quản lý nhà hàng</p>
        </div>
      </section>
    </main>
  );
}

function RecoveryError({ message }) {
  return (
    <div className="lumora-login-error" role="alert">
      <span>!</span>
      <p>{message}</p>
    </div>
  );
}

function PrimaryButton({ children, loading, loadingText }) {
  return (
    <button className="lumora-login-submit" type="submit" disabled={loading}>
      {loading ? (
        <>
          <LoaderCircle className="lumora-login-spinner" size={18} />
          {loadingText}
        </>
      ) : children}
    </button>
  );
}

function PasswordField({ label, value, visible, onToggle, onChange, autoComplete, disabled }) {
  return (
    <label className="lumora-login-field">
      <span>{label}</span>
      <div className="lumora-login-input-wrap">
        <LockKeyhole size={17} aria-hidden="true" />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Nhập ${label.toLowerCase()}`}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          className="lumora-password-toggle"
          onClick={onToggle}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          disabled={disabled}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}
