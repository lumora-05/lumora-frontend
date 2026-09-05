import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
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
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { deliveryAreaLabel, normalizePhone, unwrapDeliveryResponse } from '../../utils/delivery';
import { formatMoney } from '../../utils/formatMoney';
import { formatDistanceMeters, formatDurationSeconds } from '../../utils/mapUtils';
import { imageUrl } from '../../utils/imageUrl';
import { readDeliveryAddress, saveDeliveryAddress } from '../../utils/deliveryAddress';
import { getCustomerUser, onCustomerSessionChange } from '../../utils/customerSession';
import { useLanguage } from '../../context/LanguageContext';
import { localizedFoodName, localizedPromotionName } from '../../utils/localizedContent';
import { usePublicContentTranslations } from '../../hooks/usePublicContentTranslations';

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


const DELIVERY_CITY = 'Đà Nẵng';
const RESTAURANT_PICKUP_ADDRESS = '191 Hoàng Diệu, Phường Hải Châu, Thành phố Đà Nẵng';

function normalizeAdminText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function suggestionStreetText(suggestion, fallback = '') {
  const house = String(suggestion?.soNha || '').trim();
  const street = String(suggestion?.tenDuong || '').trim();
  if (house && street) return `${house} ${street}`.trim();

  const firstLabelPart = String(suggestion?.label || '').split(',')[0].trim();
  if (firstLabelPart) return firstLabelPart;
  if (house || street) return [house, street].filter(Boolean).join(' ').trim();
  return String(fallback || '').trim();
}

function splitStreetText(value) {
  const text = String(value || '').trim();
  if (!text) return { soNha: '', tenDuong: '' };
  const match = text.match(/^([^\s,]*\d[^\s,]*)\s+(.+)$/u);
  if (!match) return { soNha: '', tenDuong: text };
  return { soNha: match[1].trim(), tenDuong: match[2].trim() };
}

function DeliveryAddressAutocomplete({
  value,
  disabled = false,
  loading = false,
  suggestions = [],
  error = '',
  selected = false,
  onChange,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!fieldRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!disabled && !selected && String(value || '').trim().length >= 3) {
      setOpen(true);
    }
  }, [disabled, selected, value, loading, suggestions, error]);

  return (
    <label className="delivery-form-wide delivery-address-autocomplete-field">
      <span>Địa chỉ nhận hàng *</span>
      <div ref={fieldRef} className={`delivery-address-autocomplete ${open ? 'open' : ''} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}>
        <MapPin size={18} />
        <input
          required
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            if (!disabled) setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
          placeholder="Nhập số nhà, tên đường (ví dụ: 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng)"
          autoComplete="off"
          disabled={disabled}
          aria-expanded={open}
        />
        {loading ? (
          <LoaderCircle className="spin delivery-address-autocomplete-status" size={17} />
        ) : selected ? (
          <CheckCircle2 className="delivery-address-autocomplete-status success" size={18} />
        ) : null}

        {open && !disabled && !selected ? (
          <div className="delivery-address-suggestion-menu" role="listbox">
            <div className="delivery-address-suggestion-hint">
              Gõ ít nhất 3 ký tự rồi chọn đúng địa chỉ trong danh sách
            </div>
            <div className="delivery-address-suggestion-options">
              {suggestions.length ? suggestions.map((option, index) => (
                <button
                  key={`${option.selectionToken || option.label || index}-${index}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <MapPin size={16} />
                  <span>
                    <strong>{option.label || [option.soNha, option.tenDuong].filter(Boolean).join(' ')}</strong>
                    <small>{[option.phuongXa, option.tinhThanh].filter(Boolean).join(', ')}</small>
                  </span>
                </button>
              )) : (
                <div className={`delivery-address-suggestion-empty ${error ? 'error' : ''}`}>
                  {loading
                    ? 'Đang tìm địa chỉ phù hợp...'
                    : error || (String(value || '').trim().length < 3
                      ? 'Nhập ít nhất 3 ký tự để tìm địa chỉ.'
                      : 'Không tìm thấy địa chỉ phù hợp. Hãy nhập cụ thể hơn.')}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <small className={`delivery-address-selection-help ${selected ? 'success' : ''}`}>
        {selected
          ? 'Đã chọn địa chỉ từ bản đồ. Hệ thống sẽ dùng đúng vị trí này để tính phí giao hàng.'
          : 'Bạn cần chọn một gợi ý địa chỉ, không chỉ nhập chữ rồi bỏ qua danh sách.'}
      </small>
    </label>
  );
}

export default function DeliveryCheckout() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const requestIdRef = useRef(createRequestId());
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customer, setCustomer] = useState(getCustomerUser());
  const savedAddress = useMemo(initialDeliveryAddress, []);
  const savedAddressMatchesDeliveryCity = !savedAddress?.form?.tinhThanh
    || normalizeAdminText(savedAddress.form.tinhThanh) === normalizeAdminText(DELIVERY_CITY);
  const [quote, setQuote] = useState(() => (savedAddressMatchesDeliveryCity && savedAddress?.addressSelectionToken ? savedAddress?.quote || null : null));
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [promotions, setPromotions] = useState([]);
  const [deliveryMaxDistanceKm, setDeliveryMaxDistanceKm] = useState(null);
  usePublicContentTranslations({ language, foods: cart.items });
  const [addressQuery, setAddressQuery] = useState(() => savedAddressMatchesDeliveryCity
    ? (savedAddress?.addressQuery || [savedAddress?.form?.soNha, savedAddress?.form?.tenDuong].filter(Boolean).join(' '))
    : '');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSuggestionLoading, setAddressSuggestionLoading] = useState(false);
  const [addressSuggestionError, setAddressSuggestionError] = useState('');
  const [addressSelectionToken, setAddressSelectionToken] = useState(() => savedAddressMatchesDeliveryCity ? (savedAddress?.addressSelectionToken || '') : '');
  const [selectedAddressLabel, setSelectedAddressLabel] = useState(() => savedAddressMatchesDeliveryCity ? (savedAddress?.selectedAddressLabel || '') : '');
  const [form, setForm] = useState({
    tenNguoiNhan: '',
    soDienThoaiNhan: '',
    soNha: savedAddressMatchesDeliveryCity ? (savedAddress?.form?.soNha || '') : '',
    tenDuong: savedAddressMatchesDeliveryCity ? (savedAddress?.form?.tenDuong || '') : '',
    phuongXa: savedAddressMatchesDeliveryCity ? (savedAddress?.form?.phuongXa || '') : '',
    tinhThanh: DELIVERY_CITY,
    thongTinDiaChi: '',
    ghiChuGiaoHang: '',
    phuongThucNhanHang: 'GIAO_TAN_NOI',
    maCodeKhuyenMai: '',
    phuongThucThanhToan: 'COD',
    loaiThoiGianNhan: 'SOM_NHAT',
    thoiGianNhanMongMuon: '',
    ghiChuDonHang: '',
  });


  useEffect(() => onCustomerSessionChange(() => setCustomer(getCustomerUser())), []);

  useEffect(() => {
    if (!customer) return;
    setForm((current) => ({
      ...current,
      tenNguoiNhan: current.tenNguoiNhan || customer.hoTen || '',
      soDienThoaiNhan: current.soDienThoaiNhan || customer.soDienThoai || '',
    }));
  }, [customer]);

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

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const settings = systemSettingData(response);
        const maxDistance = Number(settings?.deliveryMaxDistanceKm);
        setDeliveryMaxDistanceKm(Number.isFinite(maxDistance) && maxDistance > 0 ? maxDistance : null);
      })
      .catch(() => {
        if (active) setDeliveryMaxDistanceKm(null);
      });
    return () => { active = false; };
  }, []);

  const isPickup = form.phuongThucNhanHang === 'TU_DEN_LAY';

  const deliveryCityReady = String(form.tinhThanh || '').trim() === DELIVERY_CITY;
  const selectedAddressReady = deliveryCityReady && Boolean(String(form.phuongXa || '').trim());

  useEffect(() => {
    const query = addressQuery.trim();
    if (!deliveryCityReady || addressSelectionToken || query.length < 3) {
      setAddressSuggestions([]);
      setAddressSuggestionLoading(false);
      if (query.length < 3 || !deliveryCityReady) setAddressSuggestionError('');
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setAddressSuggestionLoading(true);
      setAddressSuggestionError('');
      deliveryApi.addressSuggestions({
        query,
        tinhThanh: DELIVERY_CITY,
      })
        .then((response) => {
          if (!active) return;
          const rows = unwrapDeliveryResponse(response);
          setAddressSuggestions(Array.isArray(rows) ? rows : []);
          if (!Array.isArray(rows) || rows.length === 0) {
            setAddressSuggestionError('Không tìm thấy địa chỉ phù hợp. Hãy nhập đầy đủ số nhà và tên đường.');
          }
        })
        .catch((error) => {
          if (!active) return;
          setAddressSuggestions([]);
          setAddressSuggestionError(errorMessageOf(
            error,
            'Không thể tải gợi ý địa chỉ. Vui lòng thử lại.',
          ));
        })
        .finally(() => {
          if (active) setAddressSuggestionLoading(false);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    deliveryCityReady,
    addressQuery,
    addressSelectionToken,
  ]);

  useEffect(() => {
    if (isPickup || !addressSelectionToken || !selectedAddressReady) {
      setQuote(null);
      setQuoteLoading(false);
      return undefined;
    }

    let active = true;
    setQuoteLoading(true);
    setQuoteError('');
    deliveryApi.quote({
      tinhThanh: form.tinhThanh.trim(),
      phuongXa: form.phuongXa.trim(),
      soNha: form.soNha.trim() || null,
      tenDuong: form.tenDuong.trim() || null,
      thongTinDiaChi: null,
      diaChiChiTiet: suggestionStreetText({ label: selectedAddressLabel }, addressQuery) || null,
      googlePlaceId: null,
      googleFormattedAddress: null,
      addressSelectionToken,
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
          addressQuery,
          selectedAddressLabel,
          addressSelectionToken,
          quote: value,
        });
      })
      .catch((error) => {
        if (!active) return;
        setQuote(null);
        setQuoteError(errorMessageOf(
          error,
          'Không thể tính phí từ địa chỉ đã chọn. Vui lòng chọn lại địa chỉ trong danh sách gợi ý.',
        ));
        setAddressSelectionToken('');
        setSelectedAddressLabel('');
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => { active = false; };
  }, [
    selectedAddressReady,
    isPickup,
    addressSelectionToken,
    addressQuery,
    selectedAddressLabel,
    form.tinhThanh,
    form.phuongXa,
    form.soNha,
    form.tenDuong,
  ]);

  const deliveryFee = isPickup ? 0 : Number(quote?.phiGiaoHang || 0);
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
  const displayAddress = isPickup ? RESTAURANT_PICKUP_ADDRESS : quote?.diaChiDayDu || selectedAddressLabel || [
    addressQuery.trim(),
    form.phuongXa,
    form.tinhThanh,
  ].filter(Boolean).join(', ');

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  function resetChosenAddress({ clearQuery = false } = {}) {
    setAddressSelectionToken('');
    setSelectedAddressLabel('');
    setAddressSuggestions([]);
    setAddressSuggestionError('');
    setQuote(null);
    setQuoteError('');
    setQuoteLoading(false);
    setForm((current) => ({ ...current, soNha: '', tenDuong: '', phuongXa: '', tinhThanh: DELIVERY_CITY }));
    if (clearQuery) setAddressQuery('');
  }

  function changeAddressQuery(value) {
    setAddressQuery(value);
    setAddressSelectionToken('');
    setSelectedAddressLabel('');
    setAddressSuggestions([]);
    setAddressSuggestionError('');
    setQuote(null);
    setQuoteError('');
    setForm((current) => ({ ...current, soNha: '', tenDuong: '', phuongXa: '', tinhThanh: DELIVERY_CITY }));
  }

  function chooseAddressSuggestion(suggestion) {
    if (!suggestion?.selectionToken) {
      toast.error('Gợi ý địa chỉ không hợp lệ. Vui lòng chọn kết quả khác.');
      return;
    }

    const streetText = suggestionStreetText(suggestion, addressQuery);
    const parsed = splitStreetText(streetText);
    setAddressQuery(streetText || String(suggestion.label || '').trim());
    setForm((current) => ({
      ...current,
      soNha: String(suggestion.soNha || parsed.soNha || '').trim(),
      tenDuong: String(suggestion.tenDuong || parsed.tenDuong || '').trim(),
      phuongXa: String(suggestion.phuongXa || '').trim(),
      tinhThanh: DELIVERY_CITY,
    }));
    setAddressSelectionToken(suggestion.selectionToken);
    setSelectedAddressLabel(String(suggestion.label || '').trim());
    setAddressSuggestions([]);
    setAddressSuggestionError('');
    setQuote(null);
    setQuoteError('');
  }

  function validateBeforeConfirm() {
    if (!cart.items.length) return 'Giỏ hàng đang trống.';
    const phone = normalizePhone(form.soDienThoaiNhan);
    if (!/^\+?[0-9]{9,15}$/.test(phone)) return 'Số điện thoại nhận hàng không hợp lệ.';
    if (!form.tenNguoiNhan.trim()) return 'Vui lòng nhập họ tên người nhận.';
    if (!isPickup) {
      if (!deliveryCityReady) return 'Lumora hiện chỉ hỗ trợ giao hàng trong khu vực Đà Nẵng.';
      if (!addressQuery.trim()) return 'Vui lòng nhập địa chỉ nhận hàng.';
      if (!addressSelectionToken) return 'Vui lòng chọn đúng địa chỉ trong danh sách gợi ý.';
      if (!form.phuongXa.trim()) return 'Địa chỉ đã chọn chưa xác định được phường/xã. Vui lòng chọn gợi ý khác.';
      if (quoteLoading) return 'Hệ thống đang xác định địa chỉ và tính phí giao hàng.';
      if (quoteError) return quoteError;
      if (!quote) return 'Vui lòng chờ hệ thống xác thực địa chỉ và tính phí giao hàng.';
    }
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
        phuongThucNhanHang: form.phuongThucNhanHang,
        soNha: isPickup ? null : (form.soNha.trim() || null),
        tenDuong: isPickup ? null : (form.tenDuong.trim() || null),
        phuongXa: isPickup ? null : form.phuongXa.trim(),
        tinhThanh: isPickup ? null : form.tinhThanh.trim(),
        thongTinDiaChi: null,
        diaChiChiTiet: isPickup ? null : (suggestionStreetText({ label: selectedAddressLabel }, addressQuery) || null),
        googlePlaceId: null,
        googleFormattedAddress: null,
        addressSelectionToken: isPickup ? null : addressSelectionToken,
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
        <DeliveryPublicHeader homeStyle />
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
      <DeliveryPublicHeader homeStyle />
      <section className="delivery-public-container delivery-checkout-heading delivery-checkout-heading-simple">
        <Link to="/menu"><ArrowLeft size={18} /> Tiếp tục chọn món</Link>
      </section>

      <form className="delivery-public-container delivery-checkout-grid" onSubmit={submit}>
        <div className="delivery-checkout-main">
          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><MapPin size={20} /></span><div><h2>Thông tin nhận hàng</h2><p>Nhập thông tin người nhận và chọn cách nhận món</p></div></div>

            <div className="delivery-checkout-subsection">
              
              <div className="delivery-form-grid two">
                <label><span>Họ tên người nhận *</span><div><UserRound size={18} /><input required value={form.tenNguoiNhan} onChange={updateField('tenNguoiNhan')} maxLength={120} placeholder="Nguyễn Văn A" /></div></label>
                <label><span>Số điện thoại *</span><div><Phone size={18} /><input required value={form.soDienThoaiNhan} onChange={updateField('soDienThoaiNhan')} maxLength={20} placeholder="0901234567" inputMode="tel" /></div></label>
              </div>
            </div>


            <div className="delivery-checkout-subsection">
              <h3>Phương thức nhận hàng</h3>
              <div className="delivery-receive-methods">
                <label className={form.phuongThucNhanHang === 'GIAO_TAN_NOI' ? 'active' : ''}>
                  <input type="radio" name="receive-method" value="GIAO_TAN_NOI" checked={form.phuongThucNhanHang === 'GIAO_TAN_NOI'} onChange={updateField('phuongThucNhanHang')} />
                  <img className="delivery-receive-method-image" src="/delivery-icons/delivery-bike.png" alt="" aria-hidden="true" />
                  <div><strong>Giao hàng tận nơi</strong><small>Đơn sẽ được giao đến địa chỉ của bạn</small></div>
                  <span className="delivery-receive-method-check" aria-hidden="true" />
                </label>
                <label className={form.phuongThucNhanHang === 'TU_DEN_LAY' ? 'active' : ''}>
                  <input type="radio" name="receive-method" value="TU_DEN_LAY" checked={form.phuongThucNhanHang === 'TU_DEN_LAY'} onChange={(event) => { updateField('phuongThucNhanHang')(event); setQuote(null); setQuoteError(''); setQuoteLoading(false); }} />
                  <img className="delivery-receive-method-image" src="/delivery-icons/pickup-bag.png" alt="" aria-hidden="true" />
                  <div><strong>Nhận tại nhà hàng</strong><small>Đến lấy tại nhà hàng Lumora</small></div>
                  <span className="delivery-receive-method-check" aria-hidden="true" />
                </label>
              </div>
            </div>


            {isPickup ? (
              <div className="delivery-checkout-subsection">
                <h3>Địa điểm nhận món</h3>
                <div className="delivery-pickup-location">
                  <MapPin size={19} />
                  <div><strong>Lumora Restaurant</strong><span>{RESTAURANT_PICKUP_ADDRESS}</span></div>
                </div>
                <label className="delivery-order-note"><span>Ghi chú nhận hàng</span><input value={form.ghiChuGiaoHang} onChange={updateField('ghiChuGiaoHang')} maxLength={500} placeholder="Ví dụ: Gọi khi món sẵn sàng..." /></label>
              </div>
            ) : (
            <div className="delivery-checkout-subsection">
              <h3>Địa chỉ nhận hàng</h3>
              <div className="delivery-da-nang-notice">
                <MapPin size={18} />
                <div>
                  <strong>{deliveryMaxDistanceKm != null
                    ? `Lumora giao hàng trong phạm vi ${deliveryMaxDistanceKm} km quanh nhà hàng tại Đà Nẵng.`
                    : 'Lumora hỗ trợ giao hàng quanh nhà hàng tại Đà Nẵng.'}</strong>
                  <span>Nhập địa chỉ của bạn để kiểm tra khoảng cách và phí giao hàng.</span>
                </div>
              </div>
              <div className="delivery-form-grid delivery-address-grid delivery-address-grid-single">
                <DeliveryAddressAutocomplete
                  value={addressQuery}
                  loading={addressSuggestionLoading}
                  suggestions={addressSuggestions}
                  error={addressSuggestionError}
                  selected={Boolean(addressSelectionToken)}
                  onChange={changeAddressQuery}
                  onSelect={chooseAddressSuggestion}
                />
              </div>

            {quote?.quangDuongMet && quote?.diaChiDayDu ? (
              <div className="delivery-map-address">
                <MapPin size={18} />
                <div><strong>{quote.diaChiDayDu}</strong><small>Địa chỉ đã được xác thực trước khi đặt hàng.</small></div>
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
                <><MapPin size={17} /><span>{quoteError || (addressSelectionToken
                  ? 'Đang chờ hệ thống tính phí từ địa chỉ đã chọn.'
                  : 'Nhập địa chỉ cụ thể và chọn đúng một gợi ý để hệ thống tính phí giao hàng.')}</span></>
              )}
            </div>
            </div>
            )}
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
              <datalist id="delivery-active-promotions">{promotions.map((promotion) => <option key={promotion.maKhuyenMai || promotion.maCode} value={promotion.maCode}>{localizedPromotionName(promotion, language, promotion.tenKhuyenMai || promotion.maCode)}</option>)}</datalist>
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
                <div className="delivery-summary-image">{item?.hinhAnh ? <img src={imageUrl(item.hinhAnh)} alt={localizedFoodName(item, language, 'Món ăn')} /> : <ShoppingBag size={22} />}</div>
                <div className="delivery-summary-copy"><strong>{localizedFoodName(item, language, 'Món ăn')}</strong><span>{formatMoney(item.gia)}</span><input value={item.ghiChu || ''} onChange={(event) => cart.updateNote(itemId(item), event.target.value)} maxLength={255} placeholder="Ghi chú món..." /></div>
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
            <p><span>Phí giao hàng</span><strong>{isPickup ? formatMoney(0) : (quote ? formatMoney(deliveryFee) : 'Chờ địa chỉ')}</strong></p>
            <div><span>Tổng thanh toán</span><strong>{isPickup || quote ? formatMoney(total) : formatMoney(cart.total)}</strong></div>
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
              <p className="wide"><span>Phương thức nhận</span><strong>{isPickup ? 'Đến lấy tại nhà hàng' : 'Giao tận nơi'}</strong></p>
              <p className="wide"><span>{isPickup ? 'Địa điểm nhận' : 'Địa chỉ'}</span><strong>{displayAddress}</strong></p>
              <p><span>Thời gian nhận</span><strong>{form.loaiThoiGianNhan === 'HEN_GIO' ? formatReceiveTime(form.thoiGianNhanMongMuon) : 'Giao sớm nhất'}</strong></p>
              <p><span>Thanh toán</span><strong>{form.phuongThucThanhToan === 'COD' ? 'COD' : 'VietQR'}</strong></p>
            </div>

            <div className="delivery-confirm-items">
              {cart.items.map((item) => <p key={itemId(item)}><span>{item.soLuong} × {localizedFoodName(item, language, 'Món ăn')}</span><strong>{formatMoney(Number(item.gia || 0) * Number(item.soLuong || 0))}</strong></p>)}
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
