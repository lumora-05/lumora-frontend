import {
  ChefHat,
  Clock3,
  LoaderCircle,
  LogIn,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { categoryApi, menuApi } from '../../api/menuApi';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import { continueAsGuest, getCustomerUser, hasContinuedAsGuest } from '../../utils/customerSession';
import { useLanguage } from '../../context/LanguageContext';
import { localizedCategoryName, localizedFoodCategory, localizedFoodDescription, localizedFoodName } from '../../utils/localizedContent';
import { usePublicContentTranslations } from '../../hooks/usePublicContentTranslations';


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

const PENDING_ADD_KEY = 'lumora_delivery_pending_add';

export default function DeliveryMenu() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authChoiceFood, setAuthChoiceFood] = useState(null);
  const [sharedBannerUrl, setSharedBannerUrl] = useState('');
  const translationRevision = usePublicContentTranslations({ language, foods, categories });

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    systemSettingApi.getPublic()
      .then((response) => {
        const settings = systemSettingData(response);
        setSharedBannerUrl(settings?.bannerUrl || '');
      })
      .catch(() => setSharedBannerUrl(''));
  }, []);

  useEffect(() => {
    if (!getCustomerUser() && !hasContinuedAsGuest()) return;
    const raw = sessionStorage.getItem(PENDING_ADD_KEY);
    if (!raw) return;

    sessionStorage.removeItem(PENDING_ADD_KEY);
    try {
      const pendingFood = JSON.parse(raw);
      if (pendingFood) performAddToCart(pendingFood);
    } catch {
      // Bỏ qua dữ liệu tạm không hợp lệ.
    }
  }, []);

  const filteredFoods = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase(language === 'en' ? 'en' : 'vi');
    return foods.filter((food) => {
      const matchesCategory = selectedCategory === 'ALL'
        || String(foodCategoryId(food)) === String(selectedCategory);
      const matchesKeyword = !query
        || String(localizedFoodName(food, language, '')).toLocaleLowerCase(language === 'en' ? 'en' : 'vi').includes(query)
        || String(localizedFoodDescription(food, language, '')).toLocaleLowerCase(language === 'en' ? 'en' : 'vi').includes(query);
      return matchesCategory && matchesKeyword;
    });
  }, [foods, keyword, selectedCategory, language, translationRevision]);

  function performAddToCart(food) {
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
    toast.success(`Đã thêm ${localizedFoodName(food, language, 'món ăn')} vào giỏ hàng`, {
      id: 'delivery-add-cart',
      duration: 1200,
    });
  }

  function addToCart(food) {
    if (!getCustomerUser() && !hasContinuedAsGuest()) {
      setAuthChoiceFood(food);
      return;
    }
    performAddToCart(food);
  }

  function continueWithoutLogin() {
    const food = authChoiceFood;
    continueAsGuest();
    setAuthChoiceFood(null);
    if (food) performAddToCart(food);
  }

  function loginBeforeAdding() {
    if (authChoiceFood) {
      sessionStorage.setItem(PENDING_ADD_KEY, JSON.stringify(authChoiceFood));
    }
    setAuthChoiceFood(null);
    navigate('/login?next=/menu');
  }

  return (
    <main className="delivery-public-page delivery-home-menu">
      <DeliveryPublicHeader homeStyle />

      <section className="delivery-hero delivery-home-hero">
        <div className="delivery-home-hero-bg" aria-hidden="true">
          <img src={imageUrl(sharedBannerUrl) || "/menu-hero.png"} alt="" />
          <div className="delivery-home-hero-overlay" />
        </div>
        <div className="delivery-public-container delivery-hero-grid">
          <div>
            <span className="delivery-eyebrow">Tinh hoa ẩm thực</span>
            <h1 className="delivery-home-serif">Khám phá<br />thực đơn Lumora</h1>
            <p>
              Tuyển chọn những nguyên liệu tươi ngon nhất, chế biến tinh tế bởi đội ngũ đầu bếp tài hoa.
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
            <Link to="/menu/checkout">Kiểm tra và đặt món</Link>
          </div>
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
            />
          </label>
        </div>

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
              data-i18n-skip="true"
            >
              {localizedCategoryName(category, language, 'Danh mục')}
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
                <Link
                  className="delivery-food-image delivery-food-image-link"
                  to={`/menu/foods/${foodId(food)}`}
                  aria-label={`Xem chi tiết ${localizedFoodName(food, language, 'món ăn')}`}
                  data-i18n-skip="true"
                >
                  {food?.hinhAnh
                    ? <img src={imageUrl(food.hinhAnh)} alt={localizedFoodName(food, language, 'Món ăn')} />
                    : <span><ChefHat size={42} /></span>}
                </Link>
                <div className="delivery-food-body">
                  <small data-i18n-skip="true">{localizedFoodCategory(food, language, 'Món ăn LUMORA')}</small>
                  <h3 className="delivery-home-serif">
                    <Link
                      className="delivery-food-title-link"
                      to={`/menu/foods/${foodId(food)}`}
                      data-i18n-skip="true"
                    >
                      {localizedFoodName(food, language, 'Món ăn')}
                    </Link>
                  </h3>
                  <p data-i18n-skip="true">{localizedFoodDescription(food, language, language === 'en' ? 'Carefully prepared and packaged for delivery.' : 'Món ăn được chuẩn bị chỉn chu và đóng gói phù hợp để giao tận nơi.')}</p>
                  <div>
                    <strong>{formatMoney(food?.gia)}</strong>
                    <button type="button" onClick={() => addToCart(food)}><Plus size={18} /> Thêm</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {cart.count > 0 ? (
        <Link className="delivery-floating-cart" to="/menu/checkout">
          <ShoppingBag size={20} />
          <span>{cart.count} suất món</span>
          <strong>{formatMoney(cart.total)}</strong>
        </Link>
      ) : null}

      {authChoiceFood ? (
        <div className="delivery-account-choice-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthChoiceFood(null)}>
          <section className="delivery-account-choice-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-account-choice-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="delivery-account-choice-close" type="button" onClick={() => setAuthChoiceFood(null)} aria-label="Đóng">
              <X size={18} />
            </button>
            <span className="delivery-account-choice-icon"><UserRound size={24} /></span>
            <span className="delivery-account-choice-kicker">Đặt món tại LUMORA</span>
            <h2 id="delivery-account-choice-title">Bạn muốn tiếp tục như thế nào?</h2>
            <p>Đăng nhập để lưu lịch sử đơn hàng và tích điểm, hoặc tiếp tục đặt món mà không cần tài khoản.</p>
            <div className="delivery-account-choice-food">
              <ShoppingBag size={18} />
              <span>Món đang chọn</span>
              <strong data-i18n-skip="true">{localizedFoodName(authChoiceFood, language, 'Món ăn')}</strong>
            </div>
            <div className="delivery-account-choice-actions">
              <button type="button" className="primary" onClick={loginBeforeAdding}>
                <LogIn size={18} /> Đăng nhập
              </button>
              <button type="button" className="secondary" onClick={continueWithoutLogin}>
                Tiếp tục không đăng nhập
              </button>
            </div>
            <small>Bạn chỉ cần chọn một lần trong phiên đặt món này.</small>
          </section>
        </div>
      ) : null}
    </main>
  );
}
