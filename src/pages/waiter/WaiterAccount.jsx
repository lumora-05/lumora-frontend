import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { accountApi } from '../../api/accountApi';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { imageUrl } from '../../utils/imageUrl';
import { profileAvatarOf } from '../../utils/profileAvatar';
import StaffAlertToggle from '../../components/common/StaffAlertToggle';

const EMPTY_FORM = {
  hoTen: '',
  email: '',
  soDienThoai: '',
};

const EMPTY_PASSWORD_FORM = {
  matKhauHienTai: '',
  matKhauMoi: '',
  xacNhanMatKhauMoi: '',
};

function passwordChecks(value = '') {
  return {
    length: value.length >= 8 && value.length <= 72,
    upperLower: /[a-z]/.test(value) && /[A-Z]/.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
    noSpace: value.length > 0 && !/\s/.test(value),
  };
}

const ALLOWED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function profileOf(response) {
  const value = response?.data ?? response ?? {};
  return value?.data && typeof value.data === 'object' ? value.data : value;
}

function formOf(profile) {
  return {
    hoTen: profile?.hoTen || profile?.fullName || '',
    email: profile?.email || '',
    soDienThoai: profile?.soDienThoai || profile?.phone || '',
  };
}

export default function WaiterAccount() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState(user || {});
  const [form, setForm] = useState(() => formOf(user));
  const [avatarPreview, setAvatarPreview] = useState(() => profileAvatarOf(user));
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordVisible, setPasswordVisible] = useState({
    matKhauHienTai: false,
    matKhauMoi: false,
    xacNhanMatKhauMoi: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const name = profile?.hoTen || profile?.fullName || profile?.username || profile?.tenDangNhap || 'Nhân viên phục vụ';
  const username = profile?.tenDangNhap || profile?.username || user?.tenDangNhap || user?.username || 'Chưa cập nhật';
  const employeeCode = profile?.maNhanVien || profile?.id || user?.maNhanVien || user?.id || 'Chưa xác định';
  const roleName = profile?.tenVaiTro || profile?.vaiTro?.tenVaiTro || profile?.roleName || 'Nhân viên phục vụ';
  const savedAvatar = profileAvatarOf(profile);

  useEffect(() => {
    let active = true;

    accountApi.getProfile()
      .then((response) => {
        if (!active) return;
        const data = profileOf(response);
        const merged = { ...(user || {}), ...(data || {}) };
        setProfile(merged);
        setForm(formOf(merged));
        setAvatarPreview(profileAvatarOf(merged));
        setAvatarFile(null);
        setRemoveAvatar(false);
        updateUser?.(merged);
      })
      .catch(() => {
        if (!active) return;
        setProfile(user || {});
        setForm(formOf(user));
        setAvatarPreview(profileAvatarOf(user));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    const currentPreview = avatarPreview;
    return () => {
      if (currentPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(currentPreview);
      }
    };
  }, [avatarPreview]);

  const textHasChanges = useMemo(() => {
    const current = formOf(profile);
    return Object.keys(EMPTY_FORM).some((key) => (form[key] || '').trim() !== (current[key] || '').trim());
  }, [form, profile]);

  const avatarHasChanges = Boolean(avatarFile) || removeAvatar;
  const hasChanges = textHasChanges || avatarHasChanges;
  const newPasswordChecks = useMemo(
    () => passwordChecks(passwordForm.matKhauMoi),
    [passwordForm.matKhauMoi],
  );

  function resetAvatarState(nextProfile = profile) {
    setAvatarPreview(profileAvatarOf(nextProfile));
    setAvatarFile(null);
    setRemoveAvatar(false);
  }

  function startEditing() {
    setForm(formOf(profile));
    resetAvatarState(profile);
    setEditing(true);
  }

  function cancelEditing() {
    setForm(formOf(profile));
    resetAvatarState(profile);
    setEditing(false);
  }

  function changeField(event) {
    const { name: field, value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error('Ảnh đại diện chỉ hỗ trợ JPG, PNG, WebP hoặc GIF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh đại diện không được vượt quá 5 MB');
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function deleteAvatarSelection() {
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(Boolean(savedAvatar));
  }

  async function refreshProfileAfterError() {
    try {
      const response = await accountApi.getProfile();
      const refreshed = { ...(user || {}), ...profileOf(response) };
      setProfile(refreshed);
      setForm(formOf(refreshed));
      resetAvatarState(refreshed);
      updateUser?.(refreshed);
    } catch {
      // Giữ thông tin hiện tại nếu không thể tải lại hồ sơ sau lỗi.
    }
  }

  async function submit(event) {
    event.preventDefault();

    const payload = {
      hoTen: form.hoTen.trim(),
      email: form.email.trim(),
      soDienThoai: form.soDienThoai.trim(),
    };

    if (!payload.hoTen) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }

    if (payload.soDienThoai && !/^[0-9+\s.-]{8,15}$/.test(payload.soDienThoai)) {
      toast.error('Số điện thoại không hợp lệ');
      return;
    }

    setSaving(true);
    try {
      let latest = { ...profile };
      let lastResponse = null;

      if (textHasChanges) {
        lastResponse = await accountApi.updateProfile(payload);
        latest = { ...latest, ...profileOf(lastResponse) };
      }

      if (avatarFile) {
        lastResponse = await accountApi.updateAvatar(avatarFile);
        latest = { ...latest, ...profileOf(lastResponse) };
      } else if (removeAvatar && savedAvatar) {
        lastResponse = await accountApi.deleteAvatar();
        latest = { ...latest, ...profileOf(lastResponse) };
      }

      const updated = {
        ...profile,
        ...payload,
        ...latest,
      };

      setProfile(updated);
      setForm(formOf(updated));
      resetAvatarState(updated);
      updateUser?.(updated);
      setEditing(false);
      toast.success(messageOf(lastResponse, 'Cập nhật thông tin cá nhân thành công'));
    } catch (error) {
      await refreshProfileAfterError();
      toast.error(errorMessageOf(error, 'Không thể cập nhật thông tin cá nhân'));
    } finally {
      setSaving(false);
    }
  }

  function changePasswordField(event) {
    const { name: field, value } = event.target;
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  function togglePasswordVisibility(field) {
    setPasswordVisible((current) => ({ ...current, [field]: !current[field] }));
  }

  async function submitPassword(event) {
    event.preventDefault();

    const payload = {
      matKhauHienTai: passwordForm.matKhauHienTai,
      matKhauMoi: passwordForm.matKhauMoi,
      xacNhanMatKhauMoi: passwordForm.xacNhanMatKhauMoi,
    };

    if (!payload.matKhauHienTai || !payload.matKhauMoi || !payload.xacNhanMatKhauMoi) {
      toast.error('Vui lòng nhập đầy đủ thông tin đổi mật khẩu');
      return;
    }

    if (!Object.values(newPasswordChecks).every(Boolean)) {
      toast.error('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật');
      return;
    }

    if (payload.matKhauMoi !== payload.xacNhanMatKhauMoi) {
      toast.error('Xác nhận mật khẩu mới không khớp');
      return;
    }

    if (payload.matKhauHienTai === payload.matKhauMoi) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await accountApi.changePassword(payload);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      toast.success(messageOf(response, 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'));
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể đổi mật khẩu'));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <section className="waiter-page kitchen-account-page waiter-account-modern">
      <div className="kitchen-account-tabs" role="tablist" aria-label="Cài đặt tài khoản">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          <UserRound size={18} />
          Thông tin cá nhân
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={activeTab === 'security' ? 'active' : ''}
          onClick={() => setActiveTab('security')}
        >
          <ShieldCheck size={18} />
          Bảo mật
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notifications'}
          className={activeTab === 'notifications' ? 'active' : ''}
          onClick={() => setActiveTab('notifications')}
        >
          <BellRing size={18} />
          Thông báo
        </button>
      </div>

      {activeTab === 'profile' ? (
        <form className="kitchen-account-surface kitchen-account-profile" onSubmit={submit}>
          <aside className="kitchen-account-avatar-column">
            <div className="kitchen-account-avatar-wrap">
              <div className="kitchen-account-avatar">
                {avatarPreview ? (
                  <img src={imageUrl(avatarPreview)} alt={`Ảnh đại diện của ${name}`} />
                ) : (
                  <span>{name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {editing ? (
                <label className="kitchen-account-avatar-camera" title="Chọn ảnh đại diện">
                  <Camera size={17} />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={chooseAvatar}
                    disabled={saving}
                  />
                </label>
              ) : null}
            </div>

            <h2>{name}</h2>
            <p className="kitchen-account-role">{roleName}</p>
            <div className="kitchen-account-status"><CheckCircle2 size={15} /> Đang hoạt động</div>

            <div className="kitchen-account-avatar-copy">
              <strong>Ảnh đại diện</strong>
              <span>JPG, PNG, WebP hoặc GIF</span>
              <span>Dung lượng tối đa 5 MB</span>
            </div>

            {editing ? (
              <div className="kitchen-account-avatar-actions">
                <label>
                  <ImagePlus size={16} />
                  {avatarPreview ? 'Đổi ảnh' : 'Tải ảnh lên'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={chooseAvatar}
                    disabled={saving}
                  />
                </label>
                {avatarPreview ? (
                  <button type="button" onClick={deleteAvatarSelection} disabled={saving}>
                    <Trash2 size={16} /> Xóa ảnh
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>

          <div className="kitchen-account-profile-content">
            <header className="kitchen-account-section-head">
              <div>
                <h2>Thông tin cá nhân</h2>
                <p>Quản lý thông tin liên hệ và ảnh đại diện của tài khoản phục vụ.</p>
              </div>
              {!editing ? (
                <button type="button" className="kitchen-account-edit" onClick={startEditing} disabled={loading}>
                  <Pencil size={17} /> Chỉnh sửa
                </button>
              ) : (
                <button type="button" className="kitchen-account-close" onClick={cancelEditing} aria-label="Hủy chỉnh sửa">
                  <X size={19} />
                </button>
              )}
            </header>

            {loading ? (
              <div className="kitchen-account-loading">
                <Loader2 size={22} className="spin" /> Đang tải thông tin tài khoản...
              </div>
            ) : (
              <div className="kitchen-account-form-grid">
                <label>
                  <span>Họ và tên</span>
                  <div className="kitchen-account-input-wrap">
                    <UserRound size={18} />
                    <input
                      name="hoTen"
                      value={form.hoTen}
                      onChange={changeField}
                      disabled={!editing || saving}
                      required
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                </label>

                <label>
                  <span>Tên đăng nhập</span>
                  <div className="kitchen-account-input-wrap readonly">
                    <UserRound size={18} />
                    <input value={username} disabled />
                    <LockKeyhole size={16} />
                  </div>
                </label>

                <label>
                  <span>Email</span>
                  <div className="kitchen-account-input-wrap">
                    <Mail size={18} />
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={changeField}
                      disabled={!editing || saving}
                      placeholder="Nhập địa chỉ email"
                    />
                  </div>
                </label>

                <label>
                  <span>Vai trò</span>
                  <div className="kitchen-account-input-wrap readonly">
                    <ShieldCheck size={18} />
                    <input value={roleName} disabled />
                    <LockKeyhole size={16} />
                  </div>
                </label>

                <label>
                  <span>Số điện thoại</span>
                  <div className="kitchen-account-input-wrap">
                    <Phone size={18} />
                    <input
                      name="soDienThoai"
                      value={form.soDienThoai}
                      onChange={changeField}
                      disabled={!editing || saving}
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </label>

                <label>
                  <span>Mã nhân viên</span>
                  <div className="kitchen-account-input-wrap readonly">
                    <UserRound size={18} />
                    <input value={employeeCode} disabled />
                    <LockKeyhole size={16} />
                  </div>
                </label>
              </div>
            )}

            {editing ? (
              <footer className="kitchen-account-form-actions">
                <button type="button" className="secondary" onClick={cancelEditing} disabled={saving}>Hủy</button>
                <button type="submit" className="primary" disabled={saving || !hasChanges}>
                  {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />}
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </footer>
            ) : null}
          </div>
        </form>
      ) : activeTab === 'security' ? (
        <form className="kitchen-account-surface kitchen-account-security" onSubmit={submitPassword} noValidate>
          <header className="kitchen-account-security-head">
            <span><KeyRound size={22} /></span>
            <div>
              <h2>Bảo mật tài khoản</h2>
              <p>Đổi mật khẩu định kỳ để bảo vệ tài khoản phục vụ của bạn.</p>
            </div>
          </header>

          <div className="kitchen-account-security-body">
            <div className="kitchen-account-password-fields">
              <label>
                <span>Mật khẩu hiện tại</span>
                <div className="kitchen-account-password-input">
                  <LockKeyhole size={18} />
                  <input
                    name="matKhauHienTai"
                    type={passwordVisible.matKhauHienTai ? 'text' : 'password'}
                    value={passwordForm.matKhauHienTai}
                    onChange={changePasswordField}
                    placeholder="Nhập mật khẩu hiện tại"
                    autoComplete="current-password"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('matKhauHienTai')}
                    aria-label={passwordVisible.matKhauHienTai ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'}
                    disabled={changingPassword}
                  >
                    {passwordVisible.matKhauHienTai ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label>
                <span>Mật khẩu mới</span>
                <div className="kitchen-account-password-input">
                  <LockKeyhole size={18} />
                  <input
                    name="matKhauMoi"
                    type={passwordVisible.matKhauMoi ? 'text' : 'password'}
                    value={passwordForm.matKhauMoi}
                    onChange={changePasswordField}
                    placeholder="Nhập mật khẩu mới"
                    autoComplete="new-password"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('matKhauMoi')}
                    aria-label={passwordVisible.matKhauMoi ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                    disabled={changingPassword}
                  >
                    {passwordVisible.matKhauMoi ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label>
                <span>Xác nhận mật khẩu mới</span>
                <div className="kitchen-account-password-input">
                  <LockKeyhole size={18} />
                  <input
                    name="xacNhanMatKhauMoi"
                    type={passwordVisible.xacNhanMatKhauMoi ? 'text' : 'password'}
                    value={passwordForm.xacNhanMatKhauMoi}
                    onChange={changePasswordField}
                    placeholder="Nhập lại mật khẩu mới"
                    autoComplete="new-password"
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('xacNhanMatKhauMoi')}
                    aria-label={passwordVisible.xacNhanMatKhauMoi ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                    disabled={changingPassword}
                  >
                    {passwordVisible.xacNhanMatKhauMoi ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordForm.xacNhanMatKhauMoi ? (
                  <small className={passwordForm.matKhauMoi === passwordForm.xacNhanMatKhauMoi ? 'match' : 'mismatch'}>
                    {passwordForm.matKhauMoi === passwordForm.xacNhanMatKhauMoi
                      ? 'Mật khẩu xác nhận đã khớp'
                      : 'Mật khẩu xác nhận chưa khớp'}
                  </small>
                ) : null}
              </label>
            </div>

            <aside className="kitchen-account-security-tips">
              <div className="kitchen-account-tips-title">
                <span><ShieldCheck size={20} /></span>
                <div><strong>Gợi ý bảo mật</strong><small>Mật khẩu mới cần đáp ứng đầy đủ các điều kiện</small></div>
              </div>
              <ul>
                <li className={newPasswordChecks.length ? 'valid' : ''}><Check size={15} /> Từ 8 đến 72 ký tự</li>
                <li className={newPasswordChecks.upperLower ? 'valid' : ''}><Check size={15} /> Có chữ hoa và chữ thường</li>
                <li className={newPasswordChecks.number ? 'valid' : ''}><Check size={15} /> Có ít nhất một chữ số</li>
                <li className={newPasswordChecks.special ? 'valid' : ''}><Check size={15} /> Có ít nhất một ký tự đặc biệt</li>
                <li className={newPasswordChecks.noSpace ? 'valid' : ''}><Check size={15} /> Không chứa khoảng trắng</li>
              </ul>
              <p>Sau khi đổi mật khẩu thành công, hệ thống sẽ đăng xuất để bạn đăng nhập lại.</p>
            </aside>
          </div>

          <footer className="kitchen-account-security-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setPasswordForm(EMPTY_PASSWORD_FORM)}
              disabled={changingPassword || !Object.values(passwordForm).some(Boolean)}
            >
              Xóa nội dung
            </button>
            <button type="submit" className="primary" disabled={changingPassword}>
              {changingPassword ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
              {changingPassword ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
            </button>
          </footer>
        </form>
      ) : (
        <section className="kitchen-account-surface waiter-alert-settings">
          <header className="kitchen-account-security-head">
            <span><BellRing size={22} /></span>
            <div>
              <h2>Thông báo trình duyệt</h2>
              <p>Bật cảnh báo để nhận âm thanh, rung và thông báo nhắc việc khi đang phục vụ.</p>
            </div>
          </header>

          <div className="waiter-alert-settings-body">
            <div className="waiter-alert-setting-row">
              <div>
                <strong>Cảnh báo nhắc việc</strong>
                <p>Nhận cảnh báo khi có món sẵn sàng, yêu cầu tại bàn hoặc công việc cần xử lý.</p>
              </div>
              <StaffAlertToggle channel="WAITER" />
            </div>

            <div className="waiter-alert-settings-note">
              Trình duyệt có thể yêu cầu bạn cấp quyền thông báo ở lần bật đầu tiên. Nếu quyền bị chặn, bạn có thể cấp lại trong cài đặt của trình duyệt.
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
