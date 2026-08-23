import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed
} from 'lucide-react';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { menuApi } from '../../api/menuApi';
import { tableApi } from '../../api/tableApi';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import { useLanguage } from '../../context/LanguageContext';
import { usePublicContentTranslations } from '../../hooks/usePublicContentTranslations';
import { localizedFoodCategory, localizedFoodDescription, localizedFoodName } from '../../utils/localizedContent';

export default function FoodDetail() {
  const { qrToken, foodId } = useParams();
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [added, setAdded] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const cart = useCart();
  const toast = useToast();
  const { language } = useLanguage();
  const translationFoods = useMemo(
    () => (food ? [food, ...recommendations] : recommendations),
    [food, recommendations],
  );
  usePublicContentTranslations({ language, foods: translationFoods, categories: [] });

  async function loadFood() {
    try {
      setLoading(true);
      setError('');
      const response = await menuApi.getById(foodId);
      setFood(response?.data || response);
    } catch (err) {
      setError(err?.message || 'Không thể tải thông tin món ăn.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuantity(1);
    setNote('');
    setAdded(false);
    setRecommendations([]);
    setFood(null);
    loadFood();
  }, [foodId]);

  useEffect(() => {
    if (!food || !qrToken) {
      setRecommendations([]);
      return undefined;
    }

    let active = true;

    async function loadRecommendations() {
      try {
        const currentId = String(food.maMonAn ?? food.id ?? foodId);
        const categoryId = food.danhMuc?.maDanhMuc ?? food.danhMuc?.id ?? food.maDanhMuc;
        const params = { page: 0, size: 8 };

        if (categoryId != null) params.categoryId = Number(categoryId);

        async function getItems(query) {
          const response = await tableApi.customerMenuByQrToken(qrToken, query);
          const data = response?.data ?? response;
          return Array.isArray(data?.content)
            ? data.content
            : Array.isArray(data)
              ? data
              : [];
        }

        const sameCategoryItems = await getItems(params);
        let items = sameCategoryItems;

        const countAvailableRelated = (list) => list.filter((item) => (
          String(item.maMonAn ?? item.id) !== currentId
          && item.trangThai !== false
          && item.trangThai !== 'NGUNG_BAN'
          && item.conHang !== false
        )).length;

        if (categoryId != null && countAvailableRelated(items) < 3) {
          const allItems = await getItems({ page: 0, size: 12 });
          const merged = new Map();
          [...sameCategoryItems, ...allItems].forEach((item, index) => {
            merged.set(String(item.maMonAn ?? item.id ?? index), item);
          });
          items = Array.from(merged.values());
        }

        const related = items
          .filter((item) => String(item.maMonAn ?? item.id) !== currentId)
          .filter((item) => item.trangThai !== false && item.trangThai !== 'NGUNG_BAN' && item.conHang !== false)
          .slice(0, 3);

        if (active) setRecommendations(related);
      } catch {
        if (active) setRecommendations([]);
      }
    }

    loadRecommendations();

    return () => {
      active = false;
    };
  }, [food, foodId, qrToken]);

  const total = useMemo(() => Number(food?.gia || 0) * quantity, [food, quantity]);
  const available = food?.trangThai !== false && food?.trangThai !== 'NGUNG_BAN' && food?.conHang !== false;

  function addToCart() {
    if (!food || !available) return;
    cart.add({ ...food, ghiChu: note.trim() }, quantity);
    toast.success(`Đã thêm ${localizedFoodName(food, language, 'món ăn')} vào giỏ hàng`, {
      id: 'customer-add-to-cart',
      duration: 1000
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function addRecommendationToCart(item) {
    cart.add(item);
    toast.success(`Đã thêm ${localizedFoodName(item, language, 'món ăn')} vào giỏ hàng`, {
      id: 'customer-add-to-cart',
      duration: 1000
    });
  }

  return (
    <main className="customer-flow-page">
      <CustomerHeader />

      {loading ? (
        <div className="customer-menu-access-state">
          <LoaderCircle className="spin" size={34} />
          <h2>Đang tải món ăn...</h2>
        </div>
      ) : error || !food ? (
        <div className="customer-menu-access-state error">
          <RefreshCw size={34} />
          <h2>Không thể hiển thị món ăn</h2>
          <p>{error || 'Món ăn không tồn tại hoặc đã ngừng phục vụ.'}</p>
          <button type="button" onClick={loadFood}>Thử lại</button>
        </div>
      ) : (
        <section className="customer-detail-container">
          <Link className="customer-back-link" to={`/table/${qrToken}`}><ArrowLeft size={18} /> Quay lại thực đơn</Link>

          <div className="customer-detail-card">
            <div className="customer-detail-image">
              {food.hinhAnh
                ? <img src={imageUrl(food.hinhAnh)} alt={localizedFoodName(food, language, 'Món ăn')} data-i18n-skip="true" />
                : <span><UtensilsCrossed size={78} /></span>}
              <em className={available ? 'available' : 'unavailable'}>{available ? 'Đang phục vụ' : 'Tạm hết món'}</em>
            </div>

            <article className="customer-detail-content">
              <span className="customer-detail-category" data-i18n-skip="true">{localizedFoodCategory(food, language, 'Món ăn')}</span>
              <div className="customer-detail-title-row">
                <h1 data-i18n-skip="true">{localizedFoodName(food, language, 'Món ăn')}</h1>
                <strong>{formatMoney(food.gia)}</strong>
              </div>
              <p data-i18n-skip="true">{localizedFoodDescription(food, language, language === 'en' ? 'Freshly prepared with carefully selected ingredients.' : 'Món ăn được chế biến tươi ngon từ nguyên liệu được lựa chọn kỹ lưỡng tại nhà hàng.')}</p>

              <div className="customer-detail-control-row">
                <div>
                  <span>Số lượng</span>
                  <small>Chọn số phần muốn gọi</small>
                </div>
                <div className="customer-detail-qty">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={18} /></button>
                  <strong>{quantity}</strong>
                  <button type="button" onClick={() => setQuantity((value) => value + 1)}><Plus size={18} /></button>
                </div>
              </div>

              <label className="customer-detail-note">
                <span>Ghi chú</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú nếu có, ví dụ: ít cay, không hành..." />
              </label>

              <div className="customer-detail-total">
                <span>Tạm tính</span>
                <strong>{formatMoney(total)}</strong>
              </div>

              <button className={`customer-detail-add ${added ? 'added' : ''}`} type="button" disabled={!available} onClick={addToCart}>
                {added ? <><Check size={20} /> Đã thêm vào giỏ hàng</> : <><ShoppingBag size={20} /> Thêm vào giỏ hàng</>}
              </button>
            </article>
          </div>

          {recommendations.length ? (
            <section className="customer-detail-recommendations" aria-labelledby="customer-related-title">
              <div className="customer-detail-recommendations-head">
                <h2 id="customer-related-title">Có thể bạn cũng thích</h2>
                <Link to={`/table/${qrToken}`}>Xem thêm <ChevronRight size={16} /></Link>
              </div>

              <div className="customer-detail-recommendations-grid">
                {recommendations.map((item, index) => {
                  const itemId = item.maMonAn ?? item.id;
                  return (
                    <article className="customer-detail-recommendation-card" key={itemId ?? index}>
                      <Link className="customer-detail-recommendation-image" to={`/table/${qrToken}/foods/${itemId}`}>
                        {item.hinhAnh
                          ? <img src={imageUrl(item.hinhAnh)} alt={localizedFoodName(item, language, 'Món ăn')} data-i18n-skip="true" />
                          : <span><UtensilsCrossed size={32} /></span>}
                      </Link>

                      <div className="customer-detail-recommendation-body">
                        <Link to={`/table/${qrToken}/foods/${itemId}`} data-i18n-skip="true">{localizedFoodName(item, language, 'Món ăn')}</Link>
                        <p data-i18n-skip="true">{localizedFoodDescription(item, language, language === 'en' ? 'Freshly prepared at LUMORA.' : 'Món ăn được chế biến tươi ngon tại nhà hàng.')}</p>
                        <div>
                          <strong>{formatMoney(item.gia)}</strong>
                          <button
                            type="button"
                            aria-label={`Thêm ${localizedFoodName(item, language, 'món ăn')} vào giỏ hàng`}
                            data-i18n-skip="true"
                            onClick={() => addRecommendationToCart(item)}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </section>
      )}
    </main>
  );
}
