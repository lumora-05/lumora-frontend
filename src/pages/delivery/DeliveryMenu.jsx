import {
  Bike,
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
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { categoryApi, menuApi } from '../../api/menuApi';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';

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

export default function DeliveryMenu() {
  const cart = useCart();
  const toast = useToast();
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    <main className="delivery-public-page">
      <DeliveryPublicHeader />

      <section className="delivery-hero">
        <div className="delivery-public-container delivery-hero-grid">
          <div>
            <span className="delivery-eyebrow"><Bike size={16} /> Đặt món trực tuyến · Giao tận nơi</span>
            <h1>Món ngon từ LUMORA<br /><em>giao đến tận cửa.</em></h1>
            <p>
              Chọn món, nhập địa chỉ nhận hàng và theo dõi tiến trình giao món chỉ trong vài bước.
              Nhà hàng sẽ xác nhận đơn trước khi chuyển xuống bếp.
            </p>
            <div className="delivery-hero-benefits">
              <span><Clock3 size={17} /> Xác nhận rõ thời gian giao</span>
              <span><MapPin size={17} /> Phí giao theo khu vực phục vụ</span>
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

      <section className="delivery-public-container delivery-menu-section">
        <div className="delivery-menu-toolbar">
          <div>
            <span>Thực đơn trực tuyến</span>
            <h2>Chọn món bạn yêu thích</h2>
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
                  <h3>{food?.tenMonAn || 'Món ăn'}</h3>
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
