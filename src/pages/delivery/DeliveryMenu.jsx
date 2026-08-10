import {
  Bike,
  CheckCircle2,
  ChefHat,
  Clock3,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import GooglePlaceAutocomplete from '../../components/maps/GooglePlaceAutocomplete';
import GoogleRouteMap from '../../components/maps/GoogleRouteMap';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { categoryApi, menuApi } from '../../api/menuApi';
import { deliveryApi } from '../../api/deliveryApi';
import { deliveryAreaLabel, unwrapDeliveryResponse } from '../../utils/delivery';
import { readDeliveryAddress, saveDeliveryAddress } from '../../utils/deliveryAddress';
import { formatMoney } from '../../utils/formatMoney';
import {
  formatDistanceMeters,
  formatDurationSeconds,
  googleMapsEnabled,
} from '../../utils/googleMaps';
import { imageUrl } from '../../utils/imageUrl';

const DISTRICTS = ['Thanh Khê', 'Hải Châu', 'Sơn Trà', 'Ngũ Hành Sơn', 'Cẩm Lệ', 'Liên Chiểu', 'Hòa Vang'];

function unwrapRows(response) {
  const data = response?.data ?? response ?? [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function foodId(food) {
  return food?.maMonAn ?? food?.id;
}

function categoryId(category) {
  return category?.maDanhMuc ?? category?.id;
}

function foodCategoryId(food) {
  return food?.danhMuc?.maDanhMuc ?? food?.maDanhMuc ?? food?.categoryId;
}

function categoryName(category) {
  return category?.tenDanhMuc ?? category?.name ?? 'Danh mục';
}

function initialAddressState() {
  const saved = readDeliveryAddress();
  return {
    selectedPlace: saved?.selectedPlace || null,
    quote: saved?.quote || null,
    form: {
      diaChiChiTiet: saved?.form?.diaChiChiTiet || '',
      phuongXa: saved?.form?.phuongXa || '',
      quanHuyen: saved?.form?.quanHuyen || '',
      tinhThanh: saved?.form?.tinhThanh || 'Đà Nẵng',
    },
  };
}

export default function DeliveryMenu() {
  const cart = useCart();
  const toast = useToast();
  const initialAddress = useMemo(initialAddressState, []);
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(initialAddress.selectedPlace);
  const [addressForm, setAddressForm] = useState(initialAddress.form);
  const [quote, setQuote] = useState(initialAddress.quote);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [addressValidated, setAddressValidated] = useState(false);

  const addressReady = Boolean(quote) && addressValidated;

  useEffect(() => {
    const saved = readDeliveryAddress();
    if (!saved?.quote) return;
    const savedPlace = saved.selectedPlace || null;
    const savedForm = saved.form || {};
    verifyAddress({
      diaChiChiTiet: savedForm.diaChiChiTiet || null,
      phuongXa: savedForm.phuongXa || null,
      quanHuyen: savedForm.quanHuyen || null,
      tinhThanh: savedForm.tinhThanh || 'Đà Nẵng',
      googlePlaceId: savedPlace?.placeId || null,
      googleFormattedAddress: savedPlace?.formattedAddress || null,
    }, savedPlace);
  }, []);

  useEffect(() => {
    if (!addressReady) {
      setFoods([]);
      setCategories([]);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    Promise.all([menuApi.getActive({ skipAuth: true }), categoryApi.getActive({ skipAuth: true })])
      .then(([menuResponse, categoryResponse]) => {
        if (!active) return;
        setFoods(unwrapRows(menuResponse).filter((food) => food?.trangThai !== false));
        setCategories(unwrapRows(categoryResponse).filter((category) => category?.trangThai !== false));
      })
      .catch((requestError) => {
        if (!active) return;
        setError(errorMessageOf(requestError, 'Không thể tải thực đơn giao hàng.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [addressReady]);

  const filteredFoods = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return foods.filter((food) => {
      const matchesCategory = selectedCategory === 'ALL'
        || String(foodCategoryId(food)) === String(selectedCategory);
      const matchesKeyword = !query
        || String(food?.tenMonAn || '').toLocaleLowerCase('vi').includes(query)
        || String(food?.moTa || '').toLocaleLowerCase('vi').includes(query);
      return matchesCategory && matchesKeyword;
    });
  }, [foods, keyword, selectedCategory]);

  function updateAddressField(field) {
    return (event) => {
      const value = event.target.value;
      setAddressForm((current) => ({ ...current, [field]: value }));
      setQuote(null);
      setAddressValidated(false);
      setQuoteError('');
    };
  }

  async function verifyAddress(payload, nextPlace = selectedPlace) {
    setQuoteLoading(true);
    setAddressValidated(false);
    setQuoteError('');
    try {
      const response = await deliveryApi.quote(payload);
      const value = unwrapDeliveryResponse(response);
      setQuote(value);
      setAddressValidated(true);
      saveDeliveryAddress({
        selectedPlace: nextPlace,
        form: {
          diaChiChiTiet: payload.diaChiChiTiet || '',
          phuongXa: payload.phuongXa || '',
          quanHuyen: payload.quanHuyen || '',
          tinhThanh: payload.tinhThanh || 'Đà Nẵng',
        },
        quote: value,
      });
      toast.success('Địa chỉ nằm trong phạm vi giao hàng.', { id: 'delivery-address-ready', duration: 1500 });
    } catch (requestError) {
      setQuote(null);
      setAddressValidated(false);
      saveDeliveryAddress(null);
      setQuoteError(errorMessageOf(requestError, 'Nhà hàng hiện chưa thể giao đến địa chỉ này.'));
    } finally {
      setQuoteLoading(false);
    }
  }

  function handleGooglePlaceSelected(place) {
    setSelectedPlace(place);
    const nextForm = {
      diaChiChiTiet: place.diaChiChiTiet || place.formattedAddress || '',
      phuongXa: place.phuongXa || '',
      quanHuyen: place.quanHuyen || '',
      tinhThanh: place.tinhThanh || 'Đà Nẵng',
    };
    setAddressForm(nextForm);
    setQuote(null);
    setAddressValidated(false);
    verifyAddress({
      ...nextForm,
      googlePlaceId: place.placeId,
      googleFormattedAddress: place.formattedAddress,
    }, place);
  }

  function verifyFallbackAddress() {
    if (!addressForm.quanHuyen || !addressForm.phuongXa.trim() || !addressForm.diaChiChiTiet.trim()) {
      toast.error('Vui lòng nhập đầy đủ địa chỉ giao hàng.');
      return;
    }
    verifyAddress({
      ...addressForm,
      googlePlaceId: null,
      googleFormattedAddress: null,
    }, null);
  }

  function changeAddress() {
    setQuote(null);
    setAddressValidated(false);
    setQuoteError('');
    saveDeliveryAddress(null);
  }

  function addToCart(food) {
    const id = foodId(food);
    const existing = cart.items.find((item) => String(foodId(item)) === String(id));
    if (!existing && cart.items.length >= 30) {
      toast.error('Một đơn chỉ được chọn tối đa 30 loại món.');
      return;
    }
    if (Number(existing?.soLuong || 0) >= 50) {
      toast.error('Mỗi món chỉ được đặt tối đa 50 suất trong một đơn.');
      return;
    }
    if (cart.count >= 100) {
      toast.error('Một đơn chỉ được đặt tối đa 100 suất món.');
      return;
    }
    cart.add(food, 1);
    toast.success(`Đã thêm ${food?.tenMonAn || 'món ăn'} vào giỏ hàng`, {
      id: 'delivery-add-cart',
      duration: 1200,
    });
  }

  return (
    <main className="delivery-public-page delivery-home-menu">
      <DeliveryPublicHeader homeStyle />

      <section className="delivery-hero delivery-home-hero">
        <div className="delivery-home-hero-bg" aria-hidden="true">
          <img src="/lunora-hero.png" alt="" />
          <div className="delivery-home-hero-overlay" />
        </div>
        <div className="delivery-public-container delivery-hero-grid">
          <div>
            <span className="delivery-eyebrow"><Bike size={16} /> Thực đơn trực tuyến · Giao tận nơi</span>
            <h1 className="delivery-home-serif">Hương vị LUMORA<br /><em>giao đến tận cửa.</em></h1>
            <p>
              Chọn địa chỉ giao trước để hệ thống kiểm tra giờ nhận đơn, phạm vi phục vụ, phí giao
              và thời gian nhận dự kiến rồi mới hiển thị thực đơn khả dụng.
            </p>
            <div className="delivery-hero-benefits">
              <span><Clock3 size={17} /> Thời gian nhận dự kiến rõ ràng</span>
              <span><MapPin size={17} /> Phí giao theo địa chỉ thực tế</span>
              <span><ShieldCheck size={17} /> COD hoặc VietQR</span>
            </div>
          </div>
          <div className="delivery-hero-card">
            <div className="delivery-hero-icon"><ShoppingBag size={34} /></div>
            <strong>Giỏ hàng của bạn</strong>
            <span>{cart.count} suất món</span>
            <b>{formatMoney(cart.total)}</b>
            <Link to="/delivery/checkout">Kiểm tra và đặt món</Link>
          </div>
        </div>
      </section>

      <section className="delivery-public-container delivery-address-gate">
        <div className="delivery-checkout-card">
          <div className="delivery-card-title">
            <span><MapPin size={20} /></span>
            <div>
              <h2>Địa chỉ giao hàng</h2>
              <p>Hệ thống kiểm tra nhà hàng đang nhận đơn và địa chỉ có thuộc phạm vi giao trước khi chọn món.</p>
            </div>
          </div>

          {addressReady ? (
            <>
              <div className="delivery-google-address">
                <CheckCircle2 size={18} />
                <div>
                  <strong>{quote.diaChiDayDu}</strong>
                  <small>
                    {quote.googleMaps && quote.quangDuongMet ? `${formatDistanceMeters(quote.quangDuongMet)} · ` : `${deliveryAreaLabel(quote.khuVucGiaoHang)} · `}
                    Phí giao {formatMoney(quote.phiGiaoHang)} · nhận dự kiến khoảng {formatDurationSeconds(quote.thoiGianNhanDuKienGiay || quote.thoiGianDuKienGiay)}
                  </small>
                </div>
              </div>
              {selectedPlace && <GoogleRouteMap destination={selectedPlace} encodedPolyline={quote?.encodedPolyline} />}
              <button className="delivery-address-change" type="button" onClick={changeAddress}>Đổi địa chỉ giao hàng</button>
            </>
          ) : googleMapsEnabled ? (
            <GooglePlaceAutocomplete onPlaceSelected={handleGooglePlaceSelected} disabled={quoteLoading} />
          ) : (
            <div className="delivery-address-fallback">
              <div className="delivery-form-grid two">
                <label><span>Tỉnh/Thành phố *</span><div><MapPin size={18} /><select value={addressForm.tinhThanh} onChange={updateAddressField('tinhThanh')}><option value="Đà Nẵng">Đà Nẵng</option></select></div></label>
                <label><span>Quận/Huyện *</span><div><MapPin size={18} /><select value={addressForm.quanHuyen} onChange={updateAddressField('quanHuyen')}><option value="">Chọn quận/huyện</option>{DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}</select></div></label>
                <label><span>Phường/Xã *</span><div><MapPin size={18} /><input value={addressForm.phuongXa} onChange={updateAddressField('phuongXa')} maxLength={120} placeholder="Ví dụ: Chính Gián" /></div></label>
                <label><span>Địa chỉ chi tiết *</span><div><MapPin size={18} /><input value={addressForm.diaChiChiTiet} onChange={updateAddressField('diaChiChiTiet')} maxLength={500} placeholder="Số nhà, tên đường" /></div></label>
              </div>
              <button className="delivery-address-change primary" type="button" disabled={quoteLoading} onClick={verifyFallbackAddress}>{quoteLoading ? 'Đang kiểm tra...' : 'Kiểm tra địa chỉ'}</button>
            </div>
          )}

          {quoteLoading ? <div className="delivery-quote-box"><LoaderCircle className="spin" size={17} /> Đang kiểm tra giờ nhận đơn, phạm vi giao và phí...</div> : null}
          {quoteError ? <div className="delivery-quote-box error"><MapPin size={17} />{quoteError}</div> : null}
        </div>
      </section>

      <section className="delivery-public-container delivery-menu-section">
        <div className="delivery-menu-toolbar">
          <div>
            <span>Thực đơn trực tuyến</span>
            <h2 className="delivery-home-serif">Chọn món bạn yêu thích</h2>
          </div>
          <label>
            <Search size={20} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm kiếm món ăn..."
              disabled={!addressReady}
            />
          </label>
        </div>

        {!addressReady ? (
          <div className="delivery-state-card"><MapPin size={34} /><strong>Hãy xác nhận địa chỉ giao hàng trước để xem thực đơn khả dụng.</strong></div>
        ) : (
          <>
            <div className="delivery-category-tabs">
              <button
                type="button"
                className={selectedCategory === 'ALL' ? 'active' : ''}
                onClick={() => setSelectedCategory('ALL')}
              >
                Tất cả món
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={categoryId(category)}
                  className={String(selectedCategory) === String(categoryId(category)) ? 'active' : ''}
                  onClick={() => setSelectedCategory(String(categoryId(category)))}
                >
                  {categoryName(category)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="delivery-state-card"><LoaderCircle className="spin" size={34} /><strong>Đang tải thực đơn...</strong></div>
            ) : error ? (
              <div className="delivery-state-card error"><UtensilsCrossed size={34} /><strong>{error}</strong></div>
            ) : (
              <div className="delivery-food-grid">
                {!filteredFoods.length ? (
                  <div className="delivery-state-card"><Search size={32} /><strong>Không tìm thấy món phù hợp.</strong></div>
                ) : null}
                {filteredFoods.map((food, index) => (
                  <article className="delivery-food-card" key={foodId(food) ?? index}>
                    <div className="delivery-food-image">
                      {food?.hinhAnh
                        ? <img src={imageUrl(food.hinhAnh)} alt={food.tenMonAn} />
                        : <span><ChefHat size={42} /></span>}
                    </div>
                    <div className="delivery-food-body">
                      <small>{food?.danhMuc?.tenDanhMuc || food?.tenDanhMuc || 'Món ăn LUMORA'}</small>
                      <h3 className="delivery-home-serif">{food?.tenMonAn || 'Món ăn'}</h3>
                      <p>{food?.moTa || 'Món ăn được chuẩn bị chỉn chu và đóng gói phù hợp để giao tận nơi.'}</p>
                      <div>
                        <strong>{formatMoney(food?.gia)}</strong>
                        <button type="button" onClick={() => addToCart(food)}><Plus size={18} /> Thêm</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {cart.count > 0 ? (
        <Link className="delivery-floating-cart" to="/delivery/checkout">
          <ShoppingBag size={20} />
          <span>{cart.count} suất món</span>
          <strong>{formatMoney(cart.total)}</strong>
        </Link>
      ) : null}
    </main>
  );
}
