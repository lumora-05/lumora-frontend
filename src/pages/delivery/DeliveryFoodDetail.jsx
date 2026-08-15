import {
  ArrowLeft,
  ChefHat,
  LoaderCircle,
  LogIn,
  Minus,
  Plus,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { menuApi } from '../../api/menuApi';
import { useCart } from '../../context/CartContext';
import { errorMessageOf, useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import {
  localizedFoodCategory,
  localizedFoodDescription,
  localizedFoodName,
} from '../../utils/localizedContent';
import {
  continueAsGuest,
  getCustomerUser,
  hasContinuedAsGuest,
} from '../../utils/customerSession';

const PENDING_ADD_KEY = 'lumora_delivery_pending_add';

function itemId(food) {
  return food?.maMonAn ?? food?.id;
}

export default function DeliveryFoodDetail() {
  const { foodId } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const { language } = useLanguage();
  const [food, setFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authChoiceOpen, setAuthChoiceOpen] = useState(false);

  const available = food?.trangThai !== false && food?.trangThai !== 'NGUNG_BAN';
  const total = useMemo(() => Number(food?.gia || 0) * quantity, [food, quantity]);

  async function loadFood() {
    setLoading(true);
    setError('');
    try {
      const response = await menuApi.getById(foodId);
      const data = response?.data ?? response;
      if (!data || typeof data !== 'object') throw new Error('Món ăn không tồn tại.');
      setFood(data);
    } catch (requestError) {
      setFood(null);
      setError(errorMessageOf(requestError, 'Không thể tải thông tin món ăn.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuantity(1);
    setAuthChoiceOpen(false);
    loadFood();
  }, [foodId]);

  useEffect(() => {
    if (!food || (!getCustomerUser() && !hasContinuedAsGuest())) return;
    const raw = sessionStorage.getItem(PENDING_ADD_KEY);
    if (!raw) return;

    try {
      const pending = JSON.parse(raw);
      if (String(itemId(pending)) !== String(itemId(food))) return;
      sessionStorage.removeItem(PENDING_ADD_KEY);
      const pendingQuantity = Math.max(1, Number(pending?.__deliveryQuantity || 1));
      performAddToCart(food, pendingQuantity);
    } catch {
      sessionStorage.removeItem(PENDING_ADD_KEY);
    }
  }, [food]);

  function performAddToCart(targetFood, amount = quantity) {
    const id = itemId(targetFood);
    const existing = cart.items.find((item) => String(itemId(item)) === String(id));
    const addAmount = Math.max(1, Number(amount) || 1);

    if (!existing && cart.items.length >= 30) {
      toast.error('Một đơn chỉ được chọn tối đa 30 loại món.');
      return;
    }
    if (Number(existing?.soLuong || 0) + addAmount > 50) {
      toast.error('Mỗi món chỉ được đặt tối đa 50 suất trong một đơn.');
      return;
    }
    if (cart.count + addAmount > 100) {
      toast.error('Một đơn chỉ được đặt tối đa 100 suất món.');
      return;
    }

    cart.add(targetFood, addAmount);
    toast.success(`Đã thêm ${localizedFoodName(targetFood, language, 'món ăn')} vào giỏ hàng`, {
      id: 'delivery-add-cart',
      duration: 1200,
    });
  }

  function addToCart() {
    if (!food || !available) return;
    if (!getCustomerUser() && !hasContinuedAsGuest()) {
      setAuthChoiceOpen(true);
      return;
    }
    performAddToCart(food, quantity);
  }

  function continueWithoutLogin() {
    continueAsGuest();
    setAuthChoiceOpen(false);
    performAddToCart(food, quantity);
  }

  function loginBeforeAdding() {
    sessionStorage.setItem(PENDING_ADD_KEY, JSON.stringify({
      ...food,
      __deliveryQuantity: quantity,
    }));
    setAuthChoiceOpen(false);
    navigate(`/menu/account/login?next=${encodeURIComponent(`/menu/foods/${foodId}`)}`);
  }

  return (
    <main className="delivery-public-page delivery-home-menu delivery-food-detail-page">
      <DeliveryPublicHeader homeStyle />

      <section className="delivery-public-container delivery-food-detail-shell">
        {loading ? (
          <div className="delivery-state-card delivery-food-detail-state">
            <LoaderCircle className="spin" size={34} />
            <strong>Đang tải thông tin món ăn...</strong>
          </div>
        ) : error || !food ? (
          <div className="delivery-state-card delivery-food-detail-state error">
            <UtensilsCrossed size={36} />
            <strong>Không thể hiển thị món ăn</strong>
            <p>{error || 'Món ăn không tồn tại hoặc đã ngừng phục vụ.'}</p>
            <div className="delivery-food-detail-error-actions">
              <button type="button" onClick={loadFood}>Thử lại</button>
              <Link to="/menu">Quay lại thực đơn</Link>
            </div>
          </div>
        ) : (
          <>
            <nav className="delivery-food-detail-breadcrumb" aria-label="Đường dẫn">
              <Link to="/">Trang chủ</Link>
              <span>/</span>
              <Link to="/menu">Thực đơn</Link>
              <span>/</span>
              <strong>{localizedFoodName(food, language, 'Món ăn')}</strong>
            </nav>

            <div className="delivery-food-detail-grid">
              <div className="delivery-food-detail-image-wrap">
                <div className="delivery-food-detail-image">
                  {food?.hinhAnh ? (
                    <img src={imageUrl(food.hinhAnh)} alt={localizedFoodName(food, language, 'Món ăn')} />
                  ) : (
                    <span><ChefHat size={86} /></span>
                  )}
                </div>
              </div>

              <article className="delivery-food-detail-content">
                <span className="delivery-food-detail-category">
                  {localizedFoodCategory(food, language, 'Món ăn LUMORA')}
                </span>
                <h1 className="delivery-home-serif">{localizedFoodName(food, language, 'Món ăn')}</h1>
                <strong className="delivery-food-detail-price">{formatMoney(food?.gia)}</strong>
                <p className="delivery-food-detail-description">
                  {localizedFoodDescription(
                    food,
                    language,
                    language === 'en'
                      ? 'Carefully prepared by LUMORA and ready for online ordering.'
                      : 'Món ăn được LUMORA chuẩn bị chỉn chu và sẵn sàng để bạn đặt trực tuyến.'
                  )}
                </p>

                <div className="delivery-food-detail-status-card">
                  <div>
                    <span>Danh mục</span>
                    <strong>{localizedFoodCategory(food, language, 'Món ăn')}</strong>
                  </div>
                  <div>
                    <span>Tình trạng</span>
                    <strong className={available ? 'available' : 'unavailable'}>
                      {available ? 'Còn món' : 'Tạm ngừng phục vụ'}
                    </strong>
                  </div>
                </div>

                <div className="delivery-food-detail-purchase">
                  <div className="delivery-food-detail-quantity-block">
                    <span>Số lượng</span>
                    <div className="delivery-food-detail-quantity">
                      <button
                        type="button"
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                        aria-label="Giảm số lượng"
                      >
                        <Minus size={18} />
                      </button>
                      <strong>{quantity}</strong>
                      <button
                        type="button"
                        onClick={() => setQuantity((current) => Math.min(50, current + 1))}
                        aria-label="Tăng số lượng"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="delivery-food-detail-total">
                    <span>Thành tiền</span>
                    <strong>{formatMoney(total)}</strong>
                  </div>
                </div>

                <button
                  className="delivery-food-detail-add"
                  type="button"
                  disabled={!available}
                  onClick={addToCart}
                >
                  <ShoppingBag size={19} />
                  {available ? 'Thêm vào giỏ' : 'Tạm ngừng phục vụ'}
                </button>

                <Link className="delivery-food-detail-back" to="/menu">
                  <ArrowLeft size={17} /> Quay lại thực đơn
                </Link>
              </article>
            </div>
          </>
        )}
      </section>

      {cart.count > 0 ? (
        <Link className="delivery-floating-cart" to="/menu/checkout">
          <ShoppingBag size={20} />
          <span>{cart.count} suất món</span>
          <strong>{formatMoney(cart.total)}</strong>
        </Link>
      ) : null}

      {authChoiceOpen && food ? (
        <div className="delivery-account-choice-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthChoiceOpen(false)}>
          <section className="delivery-account-choice-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-detail-account-choice-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="delivery-account-choice-close" type="button" onClick={() => setAuthChoiceOpen(false)} aria-label="Đóng">
              <X size={18} />
            </button>
            <span className="delivery-account-choice-icon"><UserRound size={24} /></span>
            <span className="delivery-account-choice-kicker">Đặt món tại LUMORA</span>
            <h2 id="delivery-detail-account-choice-title">Bạn muốn tiếp tục như thế nào?</h2>
            <p>Đăng nhập để lưu lịch sử đơn hàng và tích điểm, hoặc tiếp tục đặt món mà không cần tài khoản.</p>
            <div className="delivery-account-choice-food">
              <ShoppingBag size={18} />
              <span>Món đang chọn</span>
              <strong>{localizedFoodName(food, language, 'Món ăn')} · {quantity} suất</strong>
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
