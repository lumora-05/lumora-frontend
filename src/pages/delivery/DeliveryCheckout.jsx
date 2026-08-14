import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Home,
  LoaderCircle,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  TicketPercent,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import GoogleMapsEmbed from '../../components/maps/GoogleMapsEmbed';
import { deliveryApi } from '../../api/deliveryApi';
import { promotionApi } from '../../api/promotionApi';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { deliveryAreaLabel, normalizePhone, unwrapDeliveryResponse } from '../../utils/delivery';
import { formatMoney } from '../../utils/formatMoney';
import { formatDistanceMeters, formatDurationSeconds } from '../../utils/mapUtils';
import { imageUrl } from '../../utils/imageUrl';
import { readDeliveryAddress, saveDeliveryAddress } from '../../utils/deliveryAddress';

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `delivery-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function itemId(item) {
  return item?.maMonAn ?? item?.id;
}

function initialDeliveryAddress() {
  return readDeliveryAddress() || {};
}

function toLocalInputValue(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatReceiveTime(value) {
  if (!value) return 'Giao sớm nhất';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}


const VIETNAM_ADMIN_API = 'https://provinces.open-api.vn/api/v2';

function normalizeAdminText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function provinceDisplayName(value) {
  return String(value || '').replace(/^(thành phố|tỉnh)\s+/i, '').trim();
}

function SearchableAddressSelect({
  label,
  value,
  placeholder,
  options,
  loading = false,
  disabled = false,
  emptyText = 'Không tìm thấy dữ liệu phù hợp.',
  onChange,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);
  const query = normalizeAdminText(value);
  const filteredOptions = useMemo(() => {
    const rows = Array.isArray(options) ? options : [];
    if (!query) return rows;
    return rows.filter((option) => normalizeAdminText(option.label).includes(query));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!fieldRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <label className="delivery-search-field">
      <span>{label} *</span>
      <div ref={fieldRef} className={`delivery-search-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
        <MapPin size={18} />
        <input
          required
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          aria-expanded={open}
        />
        {loading ? <LoaderCircle className="spin delivery-search-status" size={17} /> : <ChevronDown className="delivery-search-chevron" size={18} />}
        {open && !disabled ? (
          <div className="delivery-search-menu" role="listbox">
            <div className="delivery-search-hint">Gõ để tìm kiếm</div>
            <div className="delivery-search-options">
              {filteredOptions.length ? filteredOptions.map((option) => (
                <button
                  key={option.code ?? option.label}
                  type="button"
                  className={normalizeAdminText(option.label) === query ? 'active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              )) : (
                <div className="delivery-search-empty">{loading ? 'Đang tải dữ liệu...' : emptyText}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}

export default function DeliveryCheckout() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const requestIdRef = useRef(createRequestId());
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [quote, setQuote] = useState(() => readDeliveryAddress()?.quote || null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [promotions, setPromotions] = useState([]);
  const savedAddress = useMemo(initialDeliveryAddress, []);
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [provinceLoading, setProvinceLoading] = useState(true);
  const [wardLoading, setWardLoading] = useState(false);
  const [adminAddressError, setAdminAddressError] = useState('');
  const wardCacheRef = useRef(new Map());
  const [form, setForm] = useState({
    tenNguoiNhan: '',
    soDienThoaiNhan: '',
    emailNguoiNhan: '',
    soNha: savedAddress?.form?.soNha || '',
    tenDuong: savedAddress?.form?.tenDuong || '',
    phuongXa: savedAddress?.form?.phuongXa || '',
    tinhThanh: savedAddress?.form?.tinhThanh || '',
    thongTinDiaChi: savedAddress?.form?.thongTinDiaChi || '',
    ghiChuGiaoHang: '',
    maCodeKhuyenMai: '',
    phuongThucThanhToan: 'COD',
    loaiThoiGianNhan: 'SOM_NHAT',
    thoiGianNhanMongMuon: '',
    ghiChuDonHang: '',
  });

  useEffect(() => {
    let active = true;
    setProvinceLoading(true);
    fetch(`${VIETNAM_ADMIN_API}/p/`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((rows) => {
        if (!active) return;
        const values = (Array.isArray(rows) ? rows : []).map((row) => ({
          code: row.code,
          label: provinceDisplayName(row.name),
        }));
        setProvinces(values);
        setAdminAddressError('');
      })
      .catch(() => {
        if (!active) return;
        setProvinces([]);
        setAdminAddressError('Không tải được danh sách tỉnh/thành. Bạn vẫn có thể nhập địa chỉ thủ công.');
      })
      .finally(() => {
        if (active) setProvinceLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectedProvince = useMemo(() => {
    const current = normalizeAdminText(form.tinhThanh);
    if (!current) return null;
    return provinces.find((province) => normalizeAdminText(province.label) === current) || null;
  }, [form.tinhThanh, provinces]);

  useEffect(() => {
    let active = true;
    if (!selectedProvince?.code) {
      setWards([]);
      setWardLoading(false);
      return undefined;
    }

    const cacheKey = String(selectedProvince.code);
    const cached = wardCacheRef.current.get(cacheKey);
    if (cached) {
      setWards(cached);
      setWardLoading(false);
      return undefined;
    }

    setWardLoading(true);
    fetch(`${VIETNAM_ADMIN_API}/w/?province=${encodeURIComponent(selectedProvince.code)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((rows) => {
        if (!active) return;
        const values = (Array.isArray(rows) ? rows : []).map((row) => ({
          code: row.code,
          label: String(row.name || '').trim(),
        }));
        wardCacheRef.current.set(cacheKey, values);
        setWards(values);
        setAdminAddressError('');
      })
      .catch(() => {
        if (!active) return;
        setWards([]);
        setAdminAddressError('Không tải được danh sách phường/xã. Bạn vẫn có thể nhập địa chỉ thủ công.');
      })
      .finally(() => {
        if (active) setWardLoading(false);
      });

    return () => { active = false; };
  }, [selectedProvince?.code]);

  useEffect(() => {
    let active = true;
    promotionApi.getActive()
      .then((response) => {
        if (!active) return;
        const rows = response?.data ?? response ?? [];
        setPromotions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (active) setPromotions([]);
      });
    return () => { active = false; };
  }, []);

  const structuredAddressReady = useMemo(() => [
    form.tinhThanh,
    form.phuongXa,
    form.soNha,
    form.tenDuong,
  ].every((value) => String(value || '').trim()), [
    form.tinhThanh,
    form.phuongXa,
    form.soNha,
    form.tenDuong,
  ]);

  useEffect(() => {
    if (!structuredAddressReady) {
      setQuote(null);
      setQuoteError('');
      setQuoteLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError('');
      deliveryApi.quote({
        tinhThanh: form.tinhThanh.trim(),
        phuongXa: form.phuongXa.trim(),
        soNha: form.soNha.trim(),
        tenDuong: form.tenDuong.trim(),
        thongTinDiaChi: form.thongTinDiaChi.trim() || null,
        diaChiChiTiet: null,
        googlePlaceId: null,
        googleFormattedAddress: null,
      })
        .then((response) => {
          if (!active) return;
          const value = unwrapDeliveryResponse(response);
          setQuote(value);
          saveDeliveryAddress({
            form: {
              soNha: form.soNha,
              tenDuong: form.tenDuong,
              phuongXa: form.phuongXa,
              tinhThanh: form.tinhThanh,
              thongTinDiaChi: form.thongTinDiaChi,
            },
            quote: value,
          });
        })
        .catch((error) => {
          if (!active) return;
          setQuote(null);
          setQuoteError(errorMessageOf(
            error,
            'Không thể xác định địa chỉ này. Vui lòng kiểm tra lại các thành phần địa chỉ.',
          ));
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 700);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    structuredAddressReady,
    form.tinhThanh,
    form.phuongXa,
    form.soNha,
    form.tenDuong,
    form.thongTinDiaChi,
  ]);

  const deliveryFee = Number(quote?.phiGiaoHang || 0);
  const promotionCode = form.maCodeKhuyenMai.trim().toUpperCase();
  const selectedPromotion = useMemo(() => promotions.find(
    (promotion) => String(promotion?.maCode || '').trim().toUpperCase() === promotionCode,
  ) || null, [promotions, promotionCode]);
  const promotionDiscount = useMemo(() => {
    if (!selectedPromotion || cart.total <= 0) return 0;
    const minimum = Number(selectedPromotion.giaTriDonToiThieu || 0);
    if (cart.total < minimum) return 0;
    const value = Number(selectedPromotion.giaTriGiam || 0);
    const type = String(selectedPromotion.loaiGiam || '').trim().toUpperCase();
    let discount = ['PERCENT', 'PHAN_TRAM', 'PERCENTAGE'].includes(type)
      ? (cart.total * value) / 100
      : value;
    const maximum = Number(selectedPromotion.giamToiDa || 0);
    if (maximum > 0) discount = Math.min(discount, maximum);
    return Math.max(0, Math.min(cart.total, discount));
  }, [cart.total, selectedPromotion]);
  const total = Math.max(0, cart.total - promotionDiscount) + deliveryFee;
  const itemCountLabel = useMemo(() => `${cart.count} suất món`, [cart.count]);
  const minScheduledTime = useMemo(() => toLocalInputValue(new Date(Date.now() + 30 * 60 * 1000)), []);
  const maxScheduledTime = useMemo(() => toLocalInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), []);
  const displayAddress = quote?.diaChiDayDu || [
    `${form.soNha} ${form.tenDuong}`.trim(),
    form.phuongXa,
    form.tinhThanh,
  ].filter(Boolean).join(', ');

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  function validateBeforeConfirm() {
    if (!cart.items.length) return 'Giỏ hàng đang trống.';
    const phone = normalizePhone(form.soDienThoaiNhan);
    if (!/^\+?[0-9]{9,15}$/.test(phone)) return 'Số điện thoại nhận hàng không hợp lệ.';
    if (!form.tenNguoiNhan.trim()) return 'Vui lòng nhập họ tên người nhận.';
    if (form.emailNguoiNhan.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailNguoiNhan.trim())) {
      return 'Email không đúng định dạng.';
    }
    if (!structuredAddressReady) return 'Vui lòng nhập đầy đủ tỉnh/thành, phường/xã, số nhà và tên đường.';
    if (quoteLoading) return 'Hệ thống đang xác định địa chỉ và tính phí giao hàng.';
    if (quoteError) return quoteError;
    if (!quote) return 'Vui lòng chờ hệ thống xác thực địa chỉ và tính phí giao hàng.';
    if (form.loaiThoiGianNhan === 'HEN_GIO' && !form.thoiGianNhanMongMuon) return 'Vui lòng chọn thời gian nhận mong muốn.';
    if (cart.count > 100 || cart.items.some((item) => Number(item.soLuong || 0) > 50)) {
      return 'Một đơn tối đa 100 suất và mỗi món tối đa 50 suất.';
    }
    return '';
  }

  function submit(event) {
    event.preventDefault();
    const error = validateBeforeConfirm();
    if (error) {
      toast.error(error);
      return;
    }
    setConfirmOpen(true);
  }

  async function createOrder() {
    const error = validateBeforeConfirm();
    if (error) {
      setConfirmOpen(false);
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const phone = normalizePhone(form.soDienThoaiNhan);
      const response = await deliveryApi.create({
        clientRequestId: requestIdRef.current,
        tenNguoiNhan: form.tenNguoiNhan.trim(),
        soDienThoaiNhan: phone,
        emailNguoiNhan: form.emailNguoiNhan.trim() || null,
        soNha: form.soNha.trim(),
        tenDuong: form.tenDuong.trim(),
        phuongXa: form.phuongXa.trim(),
        tinhThanh: form.tinhThanh.trim(),
        thongTinDiaChi: form.thongTinDiaChi.trim() || null,
        diaChiChiTiet: null,
        googlePlaceId: null,
        googleFormattedAddress: null,
        ghiChuGiaoHang: form.ghiChuGiaoHang.trim() || null,
        maCodeKhuyenMai: promotionCode || null,
        phuongThucThanhToan: form.phuongThucThanhToan,
        loaiThoiGianNhan: form.loaiThoiGianNhan,
        thoiGianNhanMongMuon: form.loaiThoiGianNhan === 'HEN_GIO'
          ? form.thoiGianNhanMongMuon
          : null,
        ghiChuDonHang: form.ghiChuDonHang.trim() || null,
        items: cart.items.map((item) => ({
          maMonAn: Number(itemId(item)),
          soLuong: Number(item.soLuong || 1),
          ghiChu: String(item.ghiChu || '').trim() || null,
        })),
      });
      const order = unwrapDeliveryResponse(response);
      const trackingToken = order?.trackingToken;
      if (!trackingToken) throw new Error('Backend không trả về mã tra cứu đơn hàng.');

      sessionStorage.setItem('lumora_delivery_last_token', trackingToken);
      sessionStorage.setItem(`lumora_delivery_order_${trackingToken}`, JSON.stringify(order));
      cart.clear();
      setConfirmOpen(false);
      toast.success(
        form.phuongThucThanhToan === 'COD'
          ? 'Đã gửi đơn. Vui lòng chờ nhà hàng xác nhận.'
          : 'Đã tạo đơn. Vui lòng thanh toán VietQR, sau đó nhà hàng sẽ xác nhận.',
      );
      navigate(`/menu/orders/${encodeURIComponent(trackingToken)}`, {
        replace: true,
        state: { order },
      });
    } catch (requestError) {
      toast.error(errorMessageOf(requestError, 'Không thể tạo đơn giao hàng.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart.items.length) {
    return (
      <main className="delivery-public-page">
        <DeliveryPublicHeader compact />
        <section className="delivery-public-container delivery-empty-cart">
          <span><ShoppingBag size={42} /></span>
          <h1>Giỏ hàng đang trống</h1>
          <p>Hãy chọn món trước khi nhập thông tin giao hàng.</p>
          <Link to="/menu"><ArrowLeft size={18} /> Quay lại thực đơn</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader compact />
      <section className="delivery-public-container delivery-checkout-heading">
        <Link to="/menu"><ArrowLeft size={18} /> Tiếp tục chọn món</Link>
        <span>Hoàn tất đơn hàng</span>
        <h1>Thông tin giao món</h1>
        <p>Địa chỉ được tách rõ từng thành phần. Backend xác thực phạm vi, tính phí và kiểm tra lại toàn bộ đơn trước khi tạo.</p>
      </section>

      <form className="delivery-public-container delivery-checkout-grid" onSubmit={submit}>
        <div className="delivery-checkout-main">
          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><UserRound size={20} /></span><div><h2>Thông tin người nhận</h2><p>Không bắt buộc đăng nhập tài khoản</p></div></div>
            <div className="delivery-form-grid two">
              <label><span>Họ tên người nhận *</span><div><UserRound size={18} /><input required value={form.tenNguoiNhan} onChange={updateField('tenNguoiNhan')} maxLength={120} placeholder="Nguyễn Văn A" /></div></label>
              <label><span>Số điện thoại *</span><div><Phone size={18} /><input required value={form.soDienThoaiNhan} onChange={updateField('soDienThoaiNhan')} maxLength={20} placeholder="0901234567" inputMode="tel" /></div></label>
              <label className="delivery-form-wide"><span>Email (không bắt buộc)</span><div><Mail size={18} /><input type="email" value={form.emailNguoiNhan} onChange={updateField('emailNguoiNhan')} maxLength={120} placeholder="email@example.com" /></div></label>
            </div>
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><MapPin size={20} /></span><div><h2>Địa chỉ giao hàng</h2><p>Nhập riêng từng thành phần để hạn chế nhầm địa danh trùng tên</p></div></div>
            <div className="delivery-form-grid two delivery-address-grid">
              <SearchableAddressSelect
                label="Tỉnh / Thành phố"
                value={form.tinhThanh}
                placeholder="Chọn Tỉnh / Thành phố"
                options={provinces}
                loading={provinceLoading}
                onChange={(value) => setForm((current) => ({ ...current, tinhThanh: value, phuongXa: '' }))}
                onSelect={(option) => setForm((current) => ({ ...current, tinhThanh: option.label, phuongXa: '' }))}
              />
              <SearchableAddressSelect
                label="Phường / Xã"
                value={form.phuongXa}
                placeholder={form.tinhThanh ? 'Chọn Phường / Xã' : 'Chọn Tỉnh / Thành phố trước'}
                options={wards}
                loading={wardLoading}
                disabled={!form.tinhThanh.trim()}
                emptyText={selectedProvince ? 'Không tìm thấy phường/xã phù hợp.' : 'Chọn một tỉnh/thành trong danh sách để tải phường/xã.'}
                onChange={(value) => setForm((current) => ({ ...current, phuongXa: value }))}
                onSelect={(option) => setForm((current) => ({ ...current, phuongXa: option.label }))}
              />
              <label><span>Số nhà *</span><div><Home size={18} /><input required value={form.soNha} onChange={updateField('soNha')} maxLength={50} placeholder="139" /></div></label>
              <label><span>Tên đường *</span><div><MapPin size={18} /><input required value={form.tenDuong} onChange={updateField('tenDuong')} maxLength={200} placeholder="Nguyễn Thị Thập" /></div></label>
              <label><span>Thông tin chi tiết</span><div><Home size={18} /><input value={form.thongTinDiaChi} onChange={updateField('thongTinDiaChi')} maxLength={500} placeholder="Tòa nhà, tầng, cổng..." /></div></label>
            </div>
            {adminAddressError ? <div className="delivery-admin-address-warning">{adminAddressError}</div> : null}

            {quote?.quangDuongMet && quote?.diaChiDayDu ? (
              <div className="delivery-map-address">
                <MapPin size={18} />
                <div><strong>{quote.diaChiDayDu}</strong><small>Địa chỉ đã được backend xác thực trước khi đặt hàng.</small></div>
              </div>
            ) : null}
            {quote?.encodedPolyline ? <GoogleMapsEmbed routeGeometry={quote.encodedPolyline} destinationLabel={quote.diaChiDayDu} /> : null}
            <label className="delivery-order-note"><span>Ghi chú giao hàng</span><input value={form.ghiChuGiaoHang} onChange={updateField('ghiChuGiaoHang')} maxLength={500} placeholder="Gọi trước khi đến, giao tại cổng..." /></label>
            <div className={`delivery-quote-box ${quoteError ? 'error' : ''}`}>
              {quoteLoading ? (
                <><LoaderCircle className="spin" size={17} /> Đang xác thực địa chỉ và tính quãng đường...</>
              ) : quote ? (
                <><CheckCircle2 size={17} /><span>{quote.quangDuongMet ? `${formatDistanceMeters(quote.quangDuongMet)} · nhận dự kiến ${formatDurationSeconds(quote.thoiGianNhanDuKienGiay || quote.thoiGianDuKienGiay)} · ` : `${deliveryAreaLabel(quote.khuVucGiaoHang)} · `}Phí giao <b>{formatMoney(deliveryFee)}</b></span></>
              ) : (
                <><MapPin size={17} /><span>{quoteError || 'Nhập đầy đủ địa chỉ để hệ thống kiểm tra phạm vi và tính phí giao hàng.'}</span></>
              )}
            </div>
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><CalendarClock size={20} /></span><div><h2>Thời gian nhận</h2><p>Chọn giao sớm nhất hoặc hẹn giờ trong khung nhà hàng phục vụ</p></div></div>
            <div className="delivery-payment-options delivery-time-options">
              <label className={form.loaiThoiGianNhan === 'SOM_NHAT' ? 'active' : ''}>
                <input type="radio" name="receive-time" value="SOM_NHAT" checked={form.loaiThoiGianNhan === 'SOM_NHAT'} onChange={updateField('loaiThoiGianNhan')} />
                <span><CalendarClock size={22} /></span><div><strong>Giao sớm nhất</strong><small>Dựa trên thời gian chuẩn bị món và quãng đường thực tế</small></div><CheckCircle2 size={20} />
              </label>
              <label className={form.loaiThoiGianNhan === 'HEN_GIO' ? 'active' : ''}>
                <input type="radio" name="receive-time" value="HEN_GIO" checked={form.loaiThoiGianNhan === 'HEN_GIO'} onChange={updateField('loaiThoiGianNhan')} />
                <span><CalendarClock size={22} /></span><div><strong>Hẹn giờ</strong><small>Hệ thống chỉ chuyển xuống bếp đúng thời điểm cần chuẩn bị</small></div><CheckCircle2 size={20} />
              </label>
            </div>
            {form.loaiThoiGianNhan === 'HEN_GIO' ? (
              <label className="delivery-order-note delivery-schedule-field"><span>Thời gian muốn nhận *</span><input type="datetime-local" value={form.thoiGianNhanMongMuon} onChange={updateField('thoiGianNhanMongMuon')} min={minScheduledTime} max={maxScheduledTime} required /></label>
            ) : null}
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><CreditCard size={20} /></span><div><h2>Khuyến mãi & thanh toán</h2><p>Backend kiểm tra lại giá, khuyến mãi và tổng tiền khi tạo đơn</p></div></div>
            <label className="delivery-order-note delivery-promotion-field">
              <span><TicketPercent size={16} /> Mã khuyến mãi</span>
              <input list="delivery-active-promotions" value={form.maCodeKhuyenMai} onChange={updateField('maCodeKhuyenMai')} maxLength={50} placeholder="Nhập mã nếu có" />
              <datalist id="delivery-active-promotions">{promotions.map((promotion) => <option key={promotion.maKhuyenMai || promotion.maCode} value={promotion.maCode}>{promotion.tenKhuyenMai}</option>)}</datalist>
              {promotionCode ? (selectedPromotion && promotionDiscount > 0
                ? <small className="delivery-promotion-hint success">Áp dụng dự kiến: -{formatMoney(promotionDiscount)}</small>
                : <small className="delivery-promotion-hint">Backend sẽ kiểm tra hiệu lực, số lượt và giá trị đơn tối thiểu khi bạn đặt món.</small>) : null}
            </label>
            <div className="delivery-payment-options">
              <label className={form.phuongThucThanhToan === 'COD' ? 'active' : ''}>
                <input type="radio" name="payment" value="COD" checked={form.phuongThucThanhToan === 'COD'} onChange={updateField('phuongThucThanhToan')} />
                <span><Banknote size={22} /></span><div><strong>Thanh toán khi nhận hàng</strong><small>Đơn được tạo và chờ nhà hàng xác nhận trước khi xuống bếp</small></div><CheckCircle2 size={20} />
              </label>
              <label className={form.phuongThucThanhToan === 'VIETQR' ? 'active' : ''}>
                <input type="radio" name="payment" value="VIETQR" checked={form.phuongThucThanhToan === 'VIETQR'} onChange={updateField('phuongThucThanhToan')} />
                <span><CreditCard size={22} /></span><div><strong>Chuyển khoản VietQR</strong><small>Sau khi ghi nhận thanh toán, đơn chuyển sang chờ nhà hàng xác nhận</small></div><CheckCircle2 size={20} />
              </label>
            </div>
            <label className="delivery-order-note"><span>Ghi chú chung cho đơn</span><textarea value={form.ghiChuDonHang} onChange={updateField('ghiChuDonHang')} maxLength={255} placeholder="Ví dụ: Không lấy dụng cụ nhựa..." /></label>
          </section>
        </div>

        <aside className="delivery-order-summary">
          <div className="delivery-summary-head"><div><span>Đơn hàng</span><h2>{itemCountLabel}</h2></div><ShoppingBag size={24} /></div>
          <div className="delivery-summary-items">
            {cart.items.map((item) => (
              <article key={itemId(item)}>
                <div className="delivery-summary-image">{item?.hinhAnh ? <img src={imageUrl(item.hinhAnh)} alt={item.tenMonAn} /> : <ShoppingBag size={22} />}</div>
                <div className="delivery-summary-copy"><strong>{item.tenMonAn}</strong><span>{formatMoney(item.gia)}</span><input value={item.ghiChu || ''} onChange={(event) => cart.updateNote(itemId(item), event.target.value)} maxLength={255} placeholder="Ghi chú món..." /></div>
                <div className="delivery-summary-qty">
                  <button type="button" onClick={() => item.soLuong <= 1 ? cart.remove(itemId(item)) : cart.updateQty(itemId(item), item.soLuong - 1)}>{item.soLuong <= 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button>
                  <b>{item.soLuong}</b>
                  <button type="button" onClick={() => cart.updateQty(itemId(item), item.soLuong + 1)} disabled={item.soLuong >= 50 || cart.count >= 100}><Plus size={15} /></button>
                </div>
              </article>
            ))}
          </div>
          <div className="delivery-summary-money">
            <p><span>Tạm tính</span><strong>{formatMoney(cart.total)}</strong></p>
            <p><span>Giảm giá</span><strong>-{formatMoney(promotionDiscount)}</strong></p>
            <p><span>Phí giao hàng</span><strong>{quote ? formatMoney(deliveryFee) : 'Chờ địa chỉ'}</strong></p>
            <div><span>Tổng thanh toán</span><strong>{quote ? formatMoney(total) : formatMoney(cart.total)}</strong></div>
          </div>
          <button className="delivery-submit-order" type="submit" disabled={submitting}>
            <CheckCircle2 size={19} /> Xem lại & xác nhận
          </button>
          <small className="delivery-submit-note">Chưa tạo đơn ở bước này. Bạn sẽ được xem lại toàn bộ thông tin trước khi xác nhận đặt hàng.</small>
        </aside>
      </form>

      {confirmOpen ? (
        <div className="delivery-confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && setConfirmOpen(false)}>
          <div className="delivery-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="delivery-confirm-close" onClick={() => !submitting && setConfirmOpen(false)} disabled={submitting} aria-label="Đóng"><X size={18} /></button>
            <span className="delivery-confirm-kicker">Kiểm tra lần cuối</span>
            <h2 id="delivery-confirm-title">Xác nhận đặt hàng</h2>
            <p className="delivery-confirm-intro">Đơn chỉ được tạo sau khi bạn xác nhận. Nhà hàng sẽ tiếp nhận và xác nhận trước khi bếp chế biến.</p>

            <div className="delivery-confirm-info">
              <p><span>Người nhận</span><strong>{form.tenNguoiNhan}</strong></p>
              <p><span>Số điện thoại</span><strong>{form.soDienThoaiNhan}</strong></p>
              <p className="wide"><span>Địa chỉ</span><strong>{displayAddress}</strong></p>
              {form.thongTinDiaChi ? <p className="wide"><span>Chi tiết</span><strong>{form.thongTinDiaChi}</strong></p> : null}
              <p><span>Thời gian nhận</span><strong>{form.loaiThoiGianNhan === 'HEN_GIO' ? formatReceiveTime(form.thoiGianNhanMongMuon) : 'Giao sớm nhất'}</strong></p>
              <p><span>Thanh toán</span><strong>{form.phuongThucThanhToan === 'COD' ? 'COD' : 'VietQR'}</strong></p>
            </div>

            <div className="delivery-confirm-items">
              {cart.items.map((item) => <p key={itemId(item)}><span>{item.soLuong} × {item.tenMonAn}</span><strong>{formatMoney(Number(item.gia || 0) * Number(item.soLuong || 0))}</strong></p>)}
            </div>
            <div className="delivery-confirm-money">
              <p><span>Tạm tính</span><strong>{formatMoney(cart.total)}</strong></p>
              <p><span>Giảm giá</span><strong>-{formatMoney(promotionDiscount)}</strong></p>
              <p><span>Phí giao hàng</span><strong>{formatMoney(deliveryFee)}</strong></p>
              <div><span>Tổng thanh toán</span><strong>{formatMoney(total)}</strong></div>
            </div>
            <div className="delivery-confirm-actions">
              <button type="button" className="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>Quay lại</button>
              <button type="button" className="primary" onClick={createOrder} disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{submitting ? 'Đang tạo đơn...' : 'Xác nhận đặt hàng'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
