import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Clock3,
  ImagePlus,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { imageUrl } from '../../utils/imageUrl';

const EMPTY_FORM = {
  restaurantName: '',
  address: '',
  phone: '',
  email: '',
  openingHours: '',
  reservationUrl: '',
  menuUrl: '',
};

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function formOf(settings = {}) {
  return {
    restaurantName: settings.restaurantName || '',
    address: settings.address || '',
    phone: settings.phone || '',
    email: settings.email || '',
    openingHours: settings.openingHours || '',
    reservationUrl: settings.reservationUrl || '',
    menuUrl: settings.menuUrl || '',
  };
}

function validateImage(file, toast, label) {
  if (!file) return false;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    toast.error(`${label} chỉ hỗ trợ JPG, PNG, WebP hoặc GIF`);
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error(`${label} không được vượt quá 5 MB`);
    return false;
  }
  return true;
}

export default function SystemSettings() {
  const toast = useToast();
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);

  const loadSettings = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await systemSettingApi.get();
      const data = systemSettingData(response);
      setSettings(data || {});
      setForm(formOf(data));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải cài đặt hệ thống'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const saveInformation = async (event) => {
    event.preventDefault();
    const payload = {
      restaurantName: form.restaurantName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      openingHours: form.openingHours.trim(),
      reservationUrl: form.reservationUrl.trim(),
      menuUrl: form.menuUrl.trim(),
    };

    if (!payload.restaurantName) {
      toast.error('Vui lòng nhập tên nhà hàng');
      return;
    }

    setSaving(true);
    try {
      const response = await systemSettingApi.update(payload);
      const data = systemSettingData(response);
      setSettings(data || {});
      setForm(formOf(data));
      toast.success(messageOf(response, 'Đã lưu cài đặt hệ thống'));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể lưu cài đặt hệ thống'));
    } finally {
      setSaving(false);
    }
  };

  const uploadBrandImage = async (type, file) => {
    const isLogo = type === 'logo';
    const label = isLogo ? 'Logo' : 'Banner';
    if (!validateImage(file, toast, label)) return;

    const setBusy = isLogo ? setLogoBusy : setBannerBusy;
    setBusy(true);
    try {
      const response = isLogo
        ? await systemSettingApi.updateLogo(file)
        : await systemSettingApi.updateBanner(file);
      const data = systemSettingData(response);
      setSettings(data || {});
      setForm(formOf(data));
      toast.success(messageOf(response, `Đã cập nhật ${label.toLowerCase()}`));
    } catch (error) {
      toast.error(errorMessageOf(error, `Không thể cập nhật ${label.toLowerCase()}`));
    } finally {
      setBusy(false);
    }
  };

  const removeBrandImage = async (type) => {
    const isLogo = type === 'logo';
    const label = isLogo ? 'logo' : 'banner';
    const setBusy = isLogo ? setLogoBusy : setBannerBusy;

    setBusy(true);
    try {
      const response = isLogo
        ? await systemSettingApi.removeLogo()
        : await systemSettingApi.removeBanner();
      const data = systemSettingData(response);
      setSettings(data || {});
      setForm(formOf(data));
      toast.success(messageOf(response, `Đã xóa ${label} tùy chỉnh`));
    } catch (error) {
      toast.error(errorMessageOf(error, `Không thể xóa ${label}`));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="system-settings-page">
        <div className="system-settings-loading"><Loader2 className="spin" size={24} /> Đang tải cài đặt...</div>
      </section>
    );
  }

  const logo = imageUrl(settings.logoUrl);
  const banner = imageUrl(settings.bannerUrl);

  return (
    <section className="system-settings-page">
      <div className="system-settings-toolbar">
        <div>
          <h2>Cài đặt hệ thống</h2>
          <p>Quản lý thông tin và nhận diện thương hiệu được sử dụng trên website nhà hàng.</p>
        </div>
        <button type="button" className="system-settings-refresh" onClick={() => loadSettings()} disabled={saving || logoBusy || bannerBusy}>
          <RefreshCw size={17} /> Tải lại
        </button>
      </div>

      <div className="system-settings-layout">
        <form className="system-settings-card system-settings-info" onSubmit={saveInformation}>
          <div className="system-settings-card-head">
            <span className="system-settings-card-icon"><Building2 size={21} /></span>
            <div>
              <h3>Thông tin nhà hàng</h3>
              <p>Các thông tin này có thể được dùng trên trang chủ và chatbot.</p>
            </div>
          </div>

          <div className="system-settings-form-grid">
            <label className="full">
              <span>Tên nhà hàng <b>*</b></span>
              <div className="system-settings-input"><Building2 size={17} /><input name="restaurantName" value={form.restaurantName} onChange={changeField} maxLength={120} placeholder="LUMORA" /></div>
            </label>

            <label>
              <span>Số điện thoại</span>
              <div className="system-settings-input"><Phone size={17} /><input name="phone" value={form.phone} onChange={changeField} maxLength={30} placeholder="Số điện thoại nhà hàng" /></div>
            </label>

            <label>
              <span>Email</span>
              <div className="system-settings-input"><Mail size={17} /><input type="email" name="email" value={form.email} onChange={changeField} maxLength={120} placeholder="Email liên hệ" /></div>
            </label>

            <label className="full">
              <span>Địa chỉ</span>
              <div className="system-settings-input"><MapPin size={17} /><input name="address" value={form.address} onChange={changeField} maxLength={255} placeholder="Địa chỉ nhà hàng" /></div>
            </label>

            <label className="full">
              <span>Giờ mở cửa</span>
              <div className="system-settings-input"><Clock3 size={17} /><input name="openingHours" value={form.openingHours} onChange={changeField} maxLength={100} placeholder="Ví dụ: 10:00 - 22:00 hằng ngày" /></div>
            </label>

            <label>
              <span>Đường dẫn đặt bàn</span>
              <div className="system-settings-input"><Link2 size={17} /><input name="reservationUrl" value={form.reservationUrl} onChange={changeField} maxLength={255} placeholder="/reservations" /></div>
            </label>

            <label>
              <span>Đường dẫn thực đơn</span>
              <div className="system-settings-input"><Link2 size={17} /><input name="menuUrl" value={form.menuUrl} onChange={changeField} maxLength={255} placeholder="/#thuc-don" /></div>
            </label>
          </div>

          <div className="system-settings-actions">
            <button type="submit" className="system-settings-save" disabled={saving}>
              {saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>

        <div className="system-settings-card system-settings-branding">
          <div className="system-settings-card-head">
            <span className="system-settings-card-icon"><ImagePlus size={21} /></span>
            <div>
              <h3>Thương hiệu & giao diện</h3>
              <p>Thay logo nhà hàng và banner hiển thị trên trang chủ.</p>
            </div>
          </div>

          <div className="system-brand-block">
            <div className="system-brand-title">
              <div><strong>Logo nhà hàng</strong><small>Khuyên dùng PNG/WebP nền trong suốt, tối đa 5 MB.</small></div>
              {settings.logoUrl && (
                <button type="button" className="system-brand-remove" onClick={() => removeBrandImage('logo')} disabled={logoBusy} title="Xóa logo tùy chỉnh"><Trash2 size={16} /></button>
              )}
            </div>
            <div className="system-logo-preview">
              {logo ? <img src={logo} alt="Logo nhà hàng" /> : <div className="system-brand-placeholder"><Building2 size={30} /><span>Chưa có logo tùy chỉnh</span></div>}
            </div>
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; uploadBrandImage('logo', file); }} />
            <button type="button" className="system-brand-upload" onClick={() => logoInputRef.current?.click()} disabled={logoBusy}>
              {logoBusy ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
              {logoBusy ? 'Đang tải...' : settings.logoUrl ? 'Thay logo' : 'Tải logo lên'}
            </button>
          </div>

          <div className="system-brand-block banner">
            <div className="system-brand-title">
              <div><strong>Banner trang chủ</strong><small>Khuyên dùng ảnh ngang tỷ lệ khoảng 16:7, tối đa 5 MB.</small></div>
              {settings.bannerUrl && (
                <button type="button" className="system-brand-remove" onClick={() => removeBrandImage('banner')} disabled={bannerBusy} title="Xóa banner tùy chỉnh"><Trash2 size={16} /></button>
              )}
            </div>
            <div className="system-banner-preview">
              {banner ? <img src={banner} alt="Banner trang chủ" /> : <div className="system-brand-placeholder"><ImagePlus size={30} /><span>Chưa có banner tùy chỉnh</span></div>}
            </div>
            <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; uploadBrandImage('banner', file); }} />
            <button type="button" className="system-brand-upload" onClick={() => bannerInputRef.current?.click()} disabled={bannerBusy}>
              {bannerBusy ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
              {bannerBusy ? 'Đang tải...' : settings.bannerUrl ? 'Thay banner' : 'Tải banner lên'}
            </button>
          </div>

          <p className="system-settings-note">Ảnh mới được lưu trên hệ thống lưu trữ ảnh của backend. Khi cập nhật thành công, trang chủ sẽ dùng ảnh mới thay cho ảnh mặc định.</p>
        </div>
      </div>
    </section>
  );
}
