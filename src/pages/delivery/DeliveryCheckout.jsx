import {
  ArrowLeft,
  Banknote,
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
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import GooglePlaceAutocomplete from '../../components/maps/GooglePlaceAutocomplete';
import GoogleRouteMap from '../../components/maps/GoogleRouteMap';
import { deliveryApi } from '../../api/deliveryApi';
import { promotionApi } from '../../api/promotionApi';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import {
  deliveryAreaLabel,
  normalizePhone,
  unwrapDeliveryResponse,
} from '../../utils/delivery';
import { formatMoney } from '../../utils/formatMoney';
import {
  formatDistanceMeters,
  formatDurationSeconds,
  googleMapsEnabled,
} from '../../utils/googleMaps';
import { imageUrl } from '../../utils/imageUrl';
import { readDeliveryAddress, saveDeliveryAddress } from '../../utils/deliveryAddress';

const DISTRICTS = ['Thanh Khê', 'Hải Châu', 'Sơn Trà', 'Ngũ Hành Sơn', 'Cẩm Lệ', 'Liên Chiểu', 'Hòa Vang'];

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

export default function DeliveryCheckout() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const requestIdRef = useRef(createRequestId());
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState(() => readDeliveryAddress()?.quote || null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [promotions, setPromotions] = useState([]);
  const savedAddress = useMemo(initialDeliveryAddress, []);
  const [selectedPlace, setSelectedPlace] = useState(savedAddress?.selectedPlace || null);
  const [form, setForm] = useState({
    tenNguoiNhan: '',
    soDienThoaiNhan: '',
    diaChiChiTiet: savedAddress?.form?.diaChiChiTiet || '',
    phuongXa: savedAddress?.form?.phuongXa || '',
    quanHuyen: savedAddress?.form?.quanHuyen || '',
    tinhThanh: savedAddress?.form?.tinhThanh || 'Đà Nẵng',
    ghiChuGiaoHang: '',
    maCodeKhuyenMai: '',
    phuongThucThanhToan: 'COD',
    ghiChuDonHang: '',
  });

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
    const useGoogleQuote = googleMapsEnabled && Boolean(selectedPlace?.placeId);
    if (googleMapsEnabled && !useGoogleQuote) {
      setQuote(null);
      setQuoteError('');
      setQuoteLoading(false);
      return undefined;
    }
    if (!useGoogleQuote && (!form.tinhThanh || !form.quanHuyen)) {
      setQuote(null);
      setQuoteError('');
      return undefined;
    }

    let active = true;
    setQuoteLoading(true);
    setQuoteError('');
    deliveryApi.quote({
      tinhThanh: form.tinhThanh || null,
      quanHuyen: form.quanHuyen || null,
      phuongXa: form.phuongXa || null,
      diaChiChiTiet: form.diaChiChiTiet || null,
      googlePlaceId: useGoogleQuote ? selectedPlace.placeId : null,
      googleFormattedAddress: useGoogleQuote ? selectedPlace.formattedAddress : null,
    }).then((response) => {
      if (active) {
        const value = unwrapDeliveryResponse(response);
        setQuote(value);
        saveDeliveryAddress({
          selectedPlace,
          form: {
            diaChiChiTiet: form.diaChiChiTiet,
            phuongXa: form.phuongXa,
            quanHuyen: form.quanHuyen,
            tinhThanh: form.tinhThanh,
          },
          quote: value,
        });
      }
    }).catch((error) => {
      if (active) {
        setQuote(null);
        setQuoteError(errorMessageOf(error, 'Địa chỉ này chưa thuộc phạm vi giao hàng.'));
      }
    }).finally(() => {
      if (active) setQuoteLoading(false);
    });
    return () => { active = false; };
  }, [
    form.tinhThanh,
    form.quanHuyen,
    form.phuongXa,
    form.diaChiChiTiet,
    selectedPlace,
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

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  function handleGooglePlaceSelected(place) {
    setSelectedPlace(place);
    setQuote(null);
    setQuoteError('');
    setForm((current) => ({
      ...current,
      diaChiChiTiet: place.diaChiChiTiet || place.formattedAddress || '',
      phuongXa: place.phuongXa || '',
      quanHuyen: place.quanHuyen || '',
      tinhThanh: place.tinhThanh || 'Đà Nẵng',
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!cart.items.length) {
      toast.error('Giỏ hàng đang trống.');
      return;
    }

    const phone = normalizePhone(form.soDienThoaiNhan);
    if (!/^\+?[0-9]{9,15}$/.test(phone)) {
      toast.error('Số điện thoại nhận hàng không hợp lệ.');
      return;
    }
    if (!form.tenNguoiNhan.trim()) {
      toast.error('Vui lòng nhập họ tên người nhận.');
      return;
    }
    if (googleMapsEnabled) {
      if (!selectedPlace?.placeId) {
        toast.error('Vui lòng chọn địa chỉ từ danh sách gợi ý Google Maps.');
        return;
      }
    } else if (!form.diaChiChiTiet.trim() || !form.phuongXa.trim() || !form.quanHuyen) {
      toast.error('Vui lòng nhập đầy đủ địa chỉ giao hàng.');
      return;
    }
    if (!quote || quoteError) {
      toast.error('Địa chỉ chưa được backend xác nhận phí giao hàng.');
      return;
    }
    if (cart.count > 100 || cart.items.some((item) => Number(item.soLuong || 0) > 50)) {
      toast.error('Một đơn tối đa 100 suất và mỗi món tối đa 50 suất.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await deliveryApi.create({
        clientRequestId: requestIdRef.current,
        tenNguoiNhan: form.tenNguoiNhan.trim(),
        soDienThoaiNhan: phone,
        diaChiChiTiet: form.diaChiChiTiet.trim(),
        phuongXa: form.phuongXa.trim(),
        quanHuyen: form.quanHuyen,
        tinhThanh: form.tinhThanh || null,
        googlePlaceId: selectedPlace?.placeId || null,
        googleFormattedAddress: selectedPlace?.formattedAddress || null,
        ghiChuGiaoHang: form.ghiChuGiaoHang.trim() || null,
        maCodeKhuyenMai: promotionCode || null,
        phuongThucThanhToan: form.phuongThucThanhToan,
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
      toast.success(form.phuongThucThanhToan === 'COD' ? 'Đặt món thành công. Đơn đã được chuyển xuống bếp.' : 'Đơn đã được kiểm tra. Vui lòng thanh toán VietQR để chuyển xuống bếp.');
      navigate(`/delivery/orders/${encodeURIComponent(trackingToken)}`, {
        replace: true,
        state: { order },
      });
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tạo đơn giao hàng.'));
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
          <Link to="/delivery"><ArrowLeft size={18} /> Quay lại thực đơn</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader compact />
      <section className="delivery-public-container delivery-checkout-heading">
        <Link to="/delivery"><ArrowLeft size={18} /> Tiếp tục chọn món</Link>
        <span>Hoàn tất đơn hàng</span>
        <h1>Thông tin giao món</h1>
        <p>Hệ thống kiểm tra lại món, nguyên liệu, giá và địa chỉ trước khi tạo đơn; đơn hợp lệ được xử lý ngay theo phương thức thanh toán.</p>
      </section>

      <form className="delivery-public-container delivery-checkout-grid" onSubmit={submit}>
        <div className="delivery-checkout-main">
          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><UserRound size={20} /></span><div><h2>Người nhận</h2></div></div>
            <div className="delivery-form-grid two">
              <label><span>Họ tên người nhận *</span><div><UserRound size={18} /><input required value={form.tenNguoiNhan} onChange={updateField('tenNguoiNhan')} maxLength={120} placeholder="Nguyễn Văn A" /></div></label>
              <label><span>Số điện thoại *</span><div><Phone size={18} /><input required value={form.soDienThoaiNhan} onChange={updateField('soDienThoaiNhan')} maxLength={20} placeholder="0901234567" inputMode="tel" /></div></label>
            </div>
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><MapPin size={20} /></span><div><h2>Địa chỉ giao hàng</h2><p>{googleMapsEnabled ? 'Chọn địa chỉ Google Maps để tính quãng đường và phí giao thực tế' : 'Backend tự xác định khu vực và phí giao hàng'}</p></div></div>
            {googleMapsEnabled ? (
              <>
                <GooglePlaceAutocomplete onPlaceSelected={handleGooglePlaceSelected} />
                {selectedPlace && (
                  <div className="delivery-google-address">
                    <MapPin size={18} />
                    <div>
                      <strong>{selectedPlace.formattedAddress}</strong>
                      <small>{[selectedPlace.phuongXa, selectedPlace.quanHuyen, selectedPlace.tinhThanh].filter(Boolean).join(' · ') || 'Địa chỉ đã được Google Maps chuẩn hóa'}</small>
                    </div>
                  </div>
                )}
                {selectedPlace && <GoogleRouteMap destination={selectedPlace} encodedPolyline={quote?.encodedPolyline} />}
              </>
            ) : (
              <div className="delivery-form-grid two">
                <label><span>Tỉnh/Thành phố *</span><div><MapPin size={18} /><select value={form.tinhThanh} onChange={updateField('tinhThanh')}><option value="Đà Nẵng">Đà Nẵng</option></select></div></label>
                <label><span>Quận/Huyện *</span><div><MapPin size={18} /><select required value={form.quanHuyen} onChange={updateField('quanHuyen')}><option value="">Chọn quận/huyện</option>{DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}</select></div></label>
                <label><span>Phường/Xã *</span><div><MapPin size={18} /><input required value={form.phuongXa} onChange={updateField('phuongXa')} maxLength={120} placeholder="Ví dụ: Chính Gián" /></div></label>
                <label><span>Địa chỉ chi tiết *</span><div><MapPin size={18} /><input required value={form.diaChiChiTiet} onChange={updateField('diaChiChiTiet')} maxLength={500} placeholder="Số nhà, tên đường" /></div></label>
              </div>
            )}
            <label className="delivery-order-note"><span>Ghi chú giao hàng</span><input value={form.ghiChuGiaoHang} onChange={updateField('ghiChuGiaoHang')} maxLength={500} placeholder="Gọi trước khi đến, số tầng..." /></label>
            <div className={`delivery-quote-box ${quoteError ? 'error' : ''}`}>
              {quoteLoading ? (
                <><LoaderCircle className="spin" size={17} /> Google Maps đang tính quãng đường và phí...</>
              ) : quote ? (
                <><CheckCircle2 size={17} /><span>{quote.googleMaps ? `${formatDistanceMeters(quote.quangDuongMet)} · nhận dự kiến ${formatDurationSeconds(quote.thoiGianNhanDuKienGiay || quote.thoiGianDuKienGiay)} · ` : `${deliveryAreaLabel(quote.khuVucGiaoHang)} · `}Phí giao <b>{formatMoney(deliveryFee)}</b></span></>
              ) : (
                <><MapPin size={17} /><span>{quoteError || (googleMapsEnabled ? 'Chọn địa chỉ trong gợi ý Google Maps để tính phí.' : 'Chọn quận/huyện để hệ thống tính phí.')}</span></>
              )}
            </div>
            {googleMapsEnabled && quote && !quote.googleMaps && (
              <small className="delivery-google-fallback">Backend chưa có GOOGLE_MAPS_SERVER_API_KEY nên đang dùng bảng phí khu vực dự phòng.</small>
            )}
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><CreditCard size={20} /></span><div><h2>Khuyến mãi & thanh toán</h2><p>Mã khuyến mãi được backend kiểm tra lại ngay trước khi nhận đơn</p></div></div>
            <label className="delivery-order-note delivery-promotion-field">
              <span><TicketPercent size={16} /> Mã khuyến mãi</span>
              <input
                list="delivery-active-promotions"
                value={form.maCodeKhuyenMai}
                onChange={updateField('maCodeKhuyenMai')}
                maxLength={50}
                placeholder="Nhập mã nếu có"
              />
              <datalist id="delivery-active-promotions">
                {promotions.map((promotion) => <option key={promotion.maKhuyenMai || promotion.maCode} value={promotion.maCode}>{promotion.tenKhuyenMai}</option>)}
              </datalist>
              {promotionCode ? (
                selectedPromotion && promotionDiscount > 0
                  ? <small className="delivery-promotion-hint success">Áp dụng dự kiến: -{formatMoney(promotionDiscount)}</small>
                  : <small className="delivery-promotion-hint">Backend sẽ kiểm tra hiệu lực, số lượt và giá trị đơn tối thiểu khi bạn đặt món.</small>
              ) : null}
            </label>
            <div className="delivery-payment-options">
              <label className={form.phuongThucThanhToan === 'COD' ? 'active' : ''}>
                <input type="radio" name="payment" value="COD" checked={form.phuongThucThanhToan === 'COD'} onChange={updateField('phuongThucThanhToan')} />
                <span><Banknote size={22} /></span><div><strong>Thanh toán khi nhận hàng</strong><small>Thanh toán cho người giao sau khi nhận món</small></div><CheckCircle2 size={20} />
              </label>
              <label className={form.phuongThucThanhToan === 'VIETQR' ? 'active' : ''}>
                <input type="radio" name="payment" value="VIETQR" checked={form.phuongThucThanhToan === 'VIETQR'} onChange={updateField('phuongThucThanhToan')} />
                <span><CreditCard size={22} /></span><div><strong>Chuyển khoản VietQR</strong><small>Tạo mã VietQR sau khi đặt; đơn xuống bếp ngay khi thanh toán được ghi nhận</small></div><CheckCircle2 size={20} />
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
          <button className="delivery-submit-order" type="submit" disabled={submitting || !quote}>
            {submitting ? <LoaderCircle className="spin" size={19} /> : <ShoppingBag size={19} />}
            {submitting ? 'Đang gửi đơn...' : 'Đặt món giao tận nơi'}
          </button>
          <small className="delivery-submit-note">Backend kiểm tra giờ nhận đơn, phạm vi giao, món còn bán, nguyên liệu, giá và khuyến mãi trước khi tạo đơn. COD chuyển thẳng xuống bếp; VietQR xuống bếp sau khi thanh toán được ghi nhận.</small>
        </aside>
      </form>
    </main>
  );
}
