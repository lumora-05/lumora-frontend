import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Clock3,
  Coins,
  CreditCard,
  ImagePlus,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Trash2,
  Truck,
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
  reservationDefaultDurationMinutes: '120',
  reservationPreparationMinutes: '30',
  reservationNoShowGraceMinutes: '15',
  reservationCheckInEarlyMinutes: '30',
  reservationMinimumAdvanceMinutes: '30',
  reservationMaximumAdvanceDays: '60',
  reservationDepositAmount: '100000',
  reservationDepositPaymentTimeoutMinutes: '10',
  reservationDepositRefundAdvanceMinutes: '120',
  deliveryTier1DistanceKm: '3',
  deliveryTier2DistanceKm: '6',
  deliveryMaxDistanceKm: '10',
  deliveryTier1Fee: '15000',
  deliveryTier2Fee: '20000',
  deliveryTier3Fee: '30000',
  vietQrBankId: '',
  vietQrBankName: '',
  vietQrAccountNo: '',
  vietQrAccountName: '',
  vietQrTemplate: 'compact2',
  vietQrDescriptionPrefix: 'LUMORA',
  loyaltyMoneyPerEarnedPoint: '10000',
  loyaltyValuePerRedeemedPoint: '1000',
  loyaltyMinimumRedeemPoints: '20',
  loyaltyMaximumRedeemPercent: '20',
  chatbotEnabled: true,
  chatbotModel: 'gpt-5-mini',
  chatbotTimeoutSeconds: '20',
  chatbotMaxOutputTokens: '700',
  chatbotMaxHistoryMessages: '8',
  chatbotMinimumConfidencePercent: '45',
};

const TABS = [
  { id: 'restaurant', label: 'Thông tin nhà hàng', icon: Building2 },
  { id: 'branding', label: 'Thương hiệu & giao diện', icon: ImagePlus },
  { id: 'reservation', label: 'Đặt bàn', icon: CalendarClock },
  { id: 'delivery', label: 'Giao hàng', icon: Truck },
  { id: 'payment', label: 'Thanh toán', icon: CreditCard },
  { id: 'loyalty', label: 'Tích điểm', icon: Coins },
];

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function textValue(value, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}

function ratioToPercent(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.round(parsed * 10000) / 100);
}

function formOf(settings = {}) {
  return {
    restaurantName: settings.restaurantName || '',
    address: settings.address || '',
    phone: settings.phone || '',
    email: settings.email || '',
    openingHours: settings.openingHours || '',
    reservationUrl: settings.reservationUrl || '',
    menuUrl: settings.menuUrl || '',
    reservationDefaultDurationMinutes: textValue(settings.reservationDefaultDurationMinutes, '120'),
    reservationPreparationMinutes: textValue(settings.reservationPreparationMinutes, '30'),
    reservationNoShowGraceMinutes: textValue(settings.reservationNoShowGraceMinutes, '15'),
    reservationCheckInEarlyMinutes: textValue(settings.reservationCheckInEarlyMinutes, '30'),
    reservationMinimumAdvanceMinutes: textValue(settings.reservationMinimumAdvanceMinutes, '30'),
    reservationMaximumAdvanceDays: textValue(settings.reservationMaximumAdvanceDays, '60'),
    reservationDepositAmount: textValue(settings.reservationDepositAmount, '100000'),
    reservationDepositPaymentTimeoutMinutes: textValue(settings.reservationDepositPaymentTimeoutMinutes, '10'),
    reservationDepositRefundAdvanceMinutes: textValue(settings.reservationDepositRefundAdvanceMinutes, '120'),
    deliveryTier1DistanceKm: textValue(settings.deliveryTier1DistanceKm, '3'),
    deliveryTier2DistanceKm: textValue(settings.deliveryTier2DistanceKm, '6'),
    deliveryMaxDistanceKm: textValue(settings.deliveryMaxDistanceKm, '10'),
    deliveryTier1Fee: textValue(settings.deliveryTier1Fee, '15000'),
    deliveryTier2Fee: textValue(settings.deliveryTier2Fee, '20000'),
    deliveryTier3Fee: textValue(settings.deliveryTier3Fee, '30000'),
    vietQrBankId: settings.vietQrBankId || '',
    vietQrBankName: settings.vietQrBankName || '',
    vietQrAccountNo: settings.vietQrAccountNo || '',
    vietQrAccountName: settings.vietQrAccountName || '',
    vietQrTemplate: settings.vietQrTemplate || 'compact2',
    vietQrDescriptionPrefix: settings.vietQrDescriptionPrefix || 'LUMORA',
    loyaltyMoneyPerEarnedPoint: textValue(settings.loyaltyMoneyPerEarnedPoint, '10000'),
    loyaltyValuePerRedeemedPoint: textValue(settings.loyaltyValuePerRedeemedPoint, '1000'),
    loyaltyMinimumRedeemPoints: textValue(settings.loyaltyMinimumRedeemPoints, '20'),
    loyaltyMaximumRedeemPercent: ratioToPercent(settings.loyaltyMaximumRedeemRatio, 20),
    chatbotEnabled: settings.chatbotEnabled ?? true,
    chatbotModel: settings.chatbotModel || 'gpt-5-mini',
    chatbotTimeoutSeconds: textValue(settings.chatbotTimeoutSeconds, '20'),
    chatbotMaxOutputTokens: textValue(settings.chatbotMaxOutputTokens, '700'),
    chatbotMaxHistoryMessages: textValue(settings.chatbotMaxHistoryMessages, '8'),
    chatbotMinimumConfidencePercent: ratioToPercent(settings.chatbotMinimumConfidence, 45),
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

function numberInRange(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function moneyLabel(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(parsed)} ₫`;
}

export default function SystemSettings() {
  const toast = useToast();
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('restaurant');
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

  const saveSettings = async (event) => {
    event.preventDefault();

    if (!form.restaurantName.trim()) {
      setActiveTab('restaurant');
      toast.error('Vui lòng nhập tên nhà hàng');
      return;
    }
    if (!numberInRange(form.reservationDefaultDurationMinutes, 30, 360)) {
      setActiveTab('reservation');
      toast.error('Thời lượng đặt bàn mặc định phải từ 30 đến 360 phút');
      return;
    }
    if (!numberInRange(form.reservationPreparationMinutes, 0, 180)) {
      setActiveTab('reservation');
      toast.error('Thời gian chuẩn bị bàn phải từ 0 đến 180 phút');
      return;
    }
    if (!numberInRange(form.reservationNoShowGraceMinutes, 0, 180)) {
      setActiveTab('reservation');
      toast.error('Thời gian chờ khách trễ phải từ 0 đến 180 phút');
      return;
    }
    if (!numberInRange(form.reservationCheckInEarlyMinutes, 0, 180)) {
      setActiveTab('reservation');
      toast.error('Thời gian cho phép check-in sớm phải từ 0 đến 180 phút');
      return;
    }
    if (!numberInRange(form.reservationMinimumAdvanceMinutes, 0, 1440)) {
      setActiveTab('reservation');
      toast.error('Thời gian đặt trước tối thiểu phải từ 0 đến 1440 phút');
      return;
    }
    if (!numberInRange(form.reservationMaximumAdvanceDays, 1, 365)) {
      setActiveTab('reservation');
      toast.error('Số ngày đặt trước tối đa phải từ 1 đến 365 ngày');
      return;
    }

    if (!numberInRange(form.reservationDepositAmount, 1000, Number.MAX_SAFE_INTEGER)) {
      setActiveTab('reservation');
      toast.error('Tiền cọc đặt bàn phải từ 1.000đ');
      return;
    }
    if (!numberInRange(form.reservationDepositPaymentTimeoutMinutes, 1, 60)) {
      setActiveTab('reservation');
      toast.error('Thời gian thanh toán cọc phải từ 1 đến 60 phút');
      return;
    }
    if (!numberInRange(form.reservationDepositRefundAdvanceMinutes, 0, 10080)) {
      setActiveTab('reservation');
      toast.error('Mốc hoàn cọc phải từ 0 đến 10.080 phút');
      return;
    }

    const deliveryTier1Distance = Number(form.deliveryTier1DistanceKm);
    const deliveryTier2Distance = Number(form.deliveryTier2DistanceKm);
    const deliveryMaxDistance = Number(form.deliveryMaxDistanceKm);
    if (!numberInRange(deliveryTier1Distance, 0.1, 100)
      || !numberInRange(deliveryTier2Distance, 0.1, 100)
      || !numberInRange(deliveryMaxDistance, 0.1, 100)
      || deliveryTier1Distance >= deliveryTier2Distance
      || deliveryTier2Distance >= deliveryMaxDistance) {
      setActiveTab('delivery');
      toast.error('Khoảng cách giao hàng phải thỏa mãn: mức 1 < mức 2 < khoảng cách tối đa');
      return;
    }
    if (!numberInRange(form.deliveryTier1Fee, 0, Number.MAX_SAFE_INTEGER)
      || !numberInRange(form.deliveryTier2Fee, 0, Number.MAX_SAFE_INTEGER)
      || !numberInRange(form.deliveryTier3Fee, 0, Number.MAX_SAFE_INTEGER)) {
      setActiveTab('delivery');
      toast.error('Phí giao hàng không được âm');
      return;
    }

    if (!numberInRange(form.loyaltyMoneyPerEarnedPoint, 1, Number.MAX_SAFE_INTEGER)
      || !numberInRange(form.loyaltyValuePerRedeemedPoint, 1, Number.MAX_SAFE_INTEGER)
      || !numberInRange(form.loyaltyMinimumRedeemPoints, 1, 1000000)
      || !numberInRange(form.loyaltyMaximumRedeemPercent, 1, 100)) {
      setActiveTab('loyalty');
      toast.error('Vui lòng kiểm tra lại các thông số tích điểm');
      return;
    }
    if (!numberInRange(form.chatbotTimeoutSeconds, 5, 120)
      || !numberInRange(form.chatbotMaxOutputTokens, 100, 10000)
      || !numberInRange(form.chatbotMaxHistoryMessages, 0, 50)
      || !numberInRange(form.chatbotMinimumConfidencePercent, 0, 100)) {
      setActiveTab('chatbot');
      toast.error('Vui lòng kiểm tra lại các thông số chatbot');
      return;
    }

    const payload = {
      restaurantName: form.restaurantName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      openingHours: form.openingHours.trim(),
      reservationUrl: form.reservationUrl.trim(),
      menuUrl: form.menuUrl.trim(),
      reservationDefaultDurationMinutes: Number(form.reservationDefaultDurationMinutes),
      reservationPreparationMinutes: Number(form.reservationPreparationMinutes),
      reservationNoShowGraceMinutes: Number(form.reservationNoShowGraceMinutes),
      reservationCheckInEarlyMinutes: Number(form.reservationCheckInEarlyMinutes),
      reservationMinimumAdvanceMinutes: Number(form.reservationMinimumAdvanceMinutes),
      reservationMaximumAdvanceDays: Number(form.reservationMaximumAdvanceDays),
      reservationDepositAmount: Number(form.reservationDepositAmount),
      reservationDepositPaymentTimeoutMinutes: Number(form.reservationDepositPaymentTimeoutMinutes),
      reservationDepositRefundAdvanceMinutes: Number(form.reservationDepositRefundAdvanceMinutes),
      deliveryTier1DistanceKm: Number(form.deliveryTier1DistanceKm),
      deliveryTier2DistanceKm: Number(form.deliveryTier2DistanceKm),
      deliveryMaxDistanceKm: Number(form.deliveryMaxDistanceKm),
      deliveryTier1Fee: Number(form.deliveryTier1Fee),
      deliveryTier2Fee: Number(form.deliveryTier2Fee),
      deliveryTier3Fee: Number(form.deliveryTier3Fee),
      vietQrBankId: form.vietQrBankId.trim(),
      vietQrBankName: form.vietQrBankName.trim(),
      vietQrAccountNo: form.vietQrAccountNo.trim(),
      vietQrAccountName: form.vietQrAccountName.trim(),
      vietQrTemplate: form.vietQrTemplate.trim(),
      vietQrDescriptionPrefix: form.vietQrDescriptionPrefix.trim(),
      loyaltyMoneyPerEarnedPoint: Number(form.loyaltyMoneyPerEarnedPoint),
      loyaltyValuePerRedeemedPoint: Number(form.loyaltyValuePerRedeemedPoint),
      loyaltyMinimumRedeemPoints: Number(form.loyaltyMinimumRedeemPoints),
      loyaltyMaximumRedeemRatio: Number(form.loyaltyMaximumRedeemPercent) / 100,
      chatbotEnabled: Boolean(form.chatbotEnabled),
      chatbotModel: form.chatbotModel.trim(),
      chatbotTimeoutSeconds: Number(form.chatbotTimeoutSeconds),
      chatbotMaxOutputTokens: Number(form.chatbotMaxOutputTokens),
      chatbotMaxHistoryMessages: Number(form.chatbotMaxHistoryMessages),
      chatbotMinimumConfidence: Number(form.chatbotMinimumConfidencePercent) / 100,
    };

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

  const cardHead = (Icon, title, description) => (
    <div className="system-settings-card-head">
      <span className="system-settings-card-icon"><Icon size={21} /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );

  return (
    <section className="system-settings-page">
      

      <div className="system-settings-tabs" role="tablist" aria-label="Nhóm cài đặt hệ thống">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <form className="system-settings-main" onSubmit={saveSettings}>
        {activeTab === 'restaurant' && (
          <div className="system-settings-card">
            {cardHead(Building2, 'Thông tin nhà hàng', 'Thông tin liên hệ và nội dung công khai được sử dụng trên website nhà hàng.')}
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
              <label>
                <span>Giờ mở cửa</span>
                <div className="system-settings-input"><Clock3 size={17} /><input name="openingHours" value={form.openingHours} onChange={changeField} maxLength={100} placeholder="10:00 - 22:00 hằng ngày" /></div>
              </label>
              <label>
                <span>Đường dẫn thực đơn</span>
                <div className="system-settings-input"><Link2 size={17} /><input name="menuUrl" value={form.menuUrl} onChange={changeField} maxLength={255} placeholder="/#thuc-don" /></div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="system-settings-card system-settings-branding">
            {cardHead(ImagePlus, 'Thương hiệu & giao diện', 'Thay logo nhà hàng và banner dùng chung cho trang chủ, thực đơn và đặt bàn.')}
            <div className="system-brand-grid">
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
                  <div><strong>Banner dùng chung</strong><small>Dùng cho Trang chủ, Thực đơn và Đặt bàn. Khuyên dùng ảnh ngang tỷ lệ khoảng 16:7, tối đa 5 MB.</small></div>
                  {settings.bannerUrl && (
                    <button type="button" className="system-brand-remove" onClick={() => removeBrandImage('banner')} disabled={bannerBusy} title="Xóa banner tùy chỉnh"><Trash2 size={16} /></button>
                  )}
                </div>
                <div className="system-banner-preview">
                  {banner ? <img src={banner} alt="Banner dùng chung" /> : <div className="system-brand-placeholder"><ImagePlus size={30} /><span>Chưa có banner tùy chỉnh</span></div>}
                </div>
                <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; uploadBrandImage('banner', file); }} />
                <button type="button" className="system-brand-upload" onClick={() => bannerInputRef.current?.click()} disabled={bannerBusy}>
                  {bannerBusy ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
                  {bannerBusy ? 'Đang tải...' : settings.bannerUrl ? 'Thay banner' : 'Tải banner lên'}
                </button>
              </div>
            </div>
            <p className="system-settings-note">Logo và banner được upload qua backend. Sau khi cập nhật thành công, cùng một banner sẽ được sử dụng trên Trang chủ, Thực đơn và Đặt bàn.</p>
          </div>
        )}

        {activeTab === 'reservation' && (
          <div className="system-settings-card">
            {cardHead(CalendarClock, 'Đặt bàn', 'Thiết lập thời lượng, check-in, giới hạn đặt bàn và chính sách tiền cọc giữ chỗ.')}
            <div className="system-settings-form-grid three-columns">
              <label>
                <span>Thời lượng đặt bàn mặc định</span>
                <div className="system-settings-input suffix"><input type="number" min="30" max="360" name="reservationDefaultDurationMinutes" value={form.reservationDefaultDurationMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Khoảng thời gian bàn được giữ cho một lượt đặt.</small>
              </label>
              <label>
                <span>Thời gian chuẩn bị bàn</span>
                <div className="system-settings-input suffix"><input type="number" min="0" max="180" name="reservationPreparationMinutes" value={form.reservationPreparationMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Khoảng đệm trước giờ khách đến.</small>
              </label>
              <label>
                <span>Chờ khách đến trễ</span>
                <div className="system-settings-input suffix"><input type="number" min="0" max="180" name="reservationNoShowGraceMinutes" value={form.reservationNoShowGraceMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Quá thời gian này có thể xử lý khách không đến.</small>
              </label>
              <label>
                <span>Cho phép check-in sớm</span>
                <div className="system-settings-input suffix"><input type="number" min="0" max="180" name="reservationCheckInEarlyMinutes" value={form.reservationCheckInEarlyMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Khoảng thời gian trước giờ hẹn nhân viên được check-in.</small>
              </label>
              <label>
                <span>Đặt trước tối thiểu</span>
                <div className="system-settings-input suffix"><input type="number" min="0" max="1440" name="reservationMinimumAdvanceMinutes" value={form.reservationMinimumAdvanceMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Không nhận lịch quá sát thời điểm khách đến.</small>
              </label>
              <label>
                <span>Đặt trước tối đa</span>
                <div className="system-settings-input suffix"><input type="number" min="1" max="365" name="reservationMaximumAdvanceDays" value={form.reservationMaximumAdvanceDays} onChange={changeField} /><em>ngày</em></div>
                <small>Giới hạn khách đặt lịch quá xa trong tương lai.</small>
              </label>
              <label>
                <span>Tiền cọc mỗi lượt đặt bàn</span>
                <div className="system-settings-input suffix"><input type="number" min="1000" step="1000" name="reservationDepositAmount" value={form.reservationDepositAmount} onChange={changeField} /><em>₫</em></div>
                <small>Cọc cố định, không phụ thuộc số lượng khách. Hiện tại: {moneyLabel(form.reservationDepositAmount)}.</small>
              </label>
              <label>
                <span>Thời hạn thanh toán cọc</span>
                <div className="system-settings-input suffix"><input type="number" min="1" max="60" name="reservationDepositPaymentTimeoutMinutes" value={form.reservationDepositPaymentTimeoutMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Quá thời hạn này, yêu cầu chưa cọc sẽ tự hết hạn.</small>
              </label>
              <label>
                <span>Hoàn cọc nếu hủy trước</span>
                <div className="system-settings-input suffix"><input type="number" min="0" max="10080" name="reservationDepositRefundAdvanceMinutes" value={form.reservationDepositRefundAdvanceMinutes} onChange={changeField} /><em>phút</em></div>
                <small>Hủy sớm hơn mốc này: chờ hoàn cọc. Hủy sát giờ hoặc không đến: mất cọc.</small>
              </label>
              <label className="full">
                <span>Đường dẫn đặt bàn trực tuyến</span>
                <div className="system-settings-input"><Link2 size={17} /><input name="reservationUrl" value={form.reservationUrl} onChange={changeField} maxLength={255} placeholder="/reservations" /></div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="system-settings-card">
            {cardHead(Truck, 'Giao hàng', 'Thiết lập phạm vi phục vụ và mức phí giao hàng theo quãng đường từ nhà hàng.')}
            <div className="system-settings-form-grid three-columns">
              <label>
                <span>Mốc khoảng cách mức 1</span>
                <div className="system-settings-input suffix"><input type="number" min="0.1" max="100" step="0.1" name="deliveryTier1DistanceKm" value={form.deliveryTier1DistanceKm} onChange={changeField} /><em>km</em></div>
                <small>Đơn trong phạm vi này áp dụng phí mức 1.</small>
              </label>
              <label>
                <span>Mốc khoảng cách mức 2</span>
                <div className="system-settings-input suffix"><input type="number" min="0.1" max="100" step="0.1" name="deliveryTier2DistanceKm" value={form.deliveryTier2DistanceKm} onChange={changeField} /><em>km</em></div>
                <small>Phải lớn hơn mốc mức 1.</small>
              </label>
              <label>
                <span>Khoảng cách giao tối đa</span>
                <div className="system-settings-input suffix"><input type="number" min="0.1" max="100" step="0.1" name="deliveryMaxDistanceKm" value={form.deliveryMaxDistanceKm} onChange={changeField} /><em>km</em></div>
                <small>Ngoài phạm vi này hệ thống không nhận giao.</small>
              </label>
              <label>
                <span>Phí giao mức 1</span>
                <div className="system-settings-input suffix"><input type="number" min="0" step="1000" name="deliveryTier1Fee" value={form.deliveryTier1Fee} onChange={changeField} /><em>₫</em></div>
                <small>Áp dụng từ 0 đến {form.deliveryTier1DistanceKm || '0'} km.</small>
              </label>
              <label>
                <span>Phí giao mức 2</span>
                <div className="system-settings-input suffix"><input type="number" min="0" step="1000" name="deliveryTier2Fee" value={form.deliveryTier2Fee} onChange={changeField} /><em>₫</em></div>
                <small>Áp dụng trên {form.deliveryTier1DistanceKm || '0'} đến {form.deliveryTier2DistanceKm || '0'} km.</small>
              </label>
              <label>
                <span>Phí giao mức 3</span>
                <div className="system-settings-input suffix"><input type="number" min="0" step="1000" name="deliveryTier3Fee" value={form.deliveryTier3Fee} onChange={changeField} /><em>₫</em></div>
                <small>Áp dụng trên {form.deliveryTier2DistanceKm || '0'} đến {form.deliveryMaxDistanceKm || '0'} km.</small>
              </label>
            </div>
            <p className="system-settings-note">Các mức phí mới sẽ được backend dùng để tính phí cho đơn giao tận nơi sau khi lưu.</p>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="system-settings-card">
            {cardHead(CreditCard, 'Thanh toán', 'Cấu hình thông tin VietQR được sử dụng khi thu ngân tạo mã thanh toán chuyển khoản.')}
            <div className="system-settings-form-grid">
              <label>
                <span>Mã ngân hàng</span>
                <div className="system-settings-input"><input name="vietQrBankId" value={form.vietQrBankId} onChange={changeField} maxLength={30} placeholder="Ví dụ: 970422" /></div>
              </label>
              <label>
                <span>Tên ngân hàng</span>
                <div className="system-settings-input"><input name="vietQrBankName" value={form.vietQrBankName} onChange={changeField} maxLength={120} placeholder="Ví dụ: MB Bank" /></div>
              </label>
              <label>
                <span>Số tài khoản</span>
                <div className="system-settings-input"><input name="vietQrAccountNo" value={form.vietQrAccountNo} onChange={changeField} maxLength={50} placeholder="Số tài khoản nhận tiền" /></div>
              </label>
              <label>
                <span>Tên chủ tài khoản</span>
                <div className="system-settings-input"><input name="vietQrAccountName" value={form.vietQrAccountName} onChange={changeField} maxLength={160} placeholder="Tên chủ tài khoản" /></div>
              </label>
              <label>
                <span>Mẫu VietQR</span>
                <div className="system-settings-input"><input name="vietQrTemplate" value={form.vietQrTemplate} onChange={changeField} maxLength={30} placeholder="compact2" /></div>
              </label>
              <label>
                <span>Tiền tố nội dung chuyển khoản</span>
                <div className="system-settings-input"><input name="vietQrDescriptionPrefix" value={form.vietQrDescriptionPrefix} onChange={changeField} maxLength={50} placeholder="LUMORA" /></div>
              </label>
            </div>
            <p className="system-settings-note warning">Chỉ ADMIN được thay đổi thông tin thanh toán. Hãy kiểm tra kỹ số tài khoản trước khi lưu.</p>
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="system-settings-card">
            {cardHead(Coins, 'Tích điểm', 'Thiết lập cách khách hàng nhận điểm và sử dụng điểm khi thanh toán.')}
            <div className="system-settings-form-grid">
              <label>
                <span>Số tiền để nhận 1 điểm</span>
                <div className="system-settings-input suffix"><input type="number" min="1" step="1000" name="loyaltyMoneyPerEarnedPoint" value={form.loyaltyMoneyPerEarnedPoint} onChange={changeField} /><em>₫</em></div>
                <small>Ví dụ {moneyLabel(form.loyaltyMoneyPerEarnedPoint)} chi tiêu = 1 điểm.</small>
              </label>
              <label>
                <span>Giá trị quy đổi của 1 điểm</span>
                <div className="system-settings-input suffix"><input type="number" min="1" step="100" name="loyaltyValuePerRedeemedPoint" value={form.loyaltyValuePerRedeemedPoint} onChange={changeField} /><em>₫</em></div>
                <small>1 điểm được giảm {moneyLabel(form.loyaltyValuePerRedeemedPoint)}.</small>
              </label>
              <label>
                <span>Điểm tối thiểu để sử dụng</span>
                <div className="system-settings-input suffix"><input type="number" min="1" max="1000000" name="loyaltyMinimumRedeemPoints" value={form.loyaltyMinimumRedeemPoints} onChange={changeField} /><em>điểm</em></div>
              </label>
              <label>
                <span>Tỷ lệ tối đa được thanh toán bằng điểm</span>
                <div className="system-settings-input suffix"><input type="number" min="1" max="100" step="1" name="loyaltyMaximumRedeemPercent" value={form.loyaltyMaximumRedeemPercent} onChange={changeField} /><em>%</em></div>
                <small>Giới hạn phần giá trị hóa đơn có thể trừ bằng điểm.</small>
              </label>
            </div>
          </div>
        )}


        {activeTab !== 'branding' && (
          <div className="system-settings-actions standalone">
            <button type="submit" className="system-settings-save" disabled={saving}>
              {saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
