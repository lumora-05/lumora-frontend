import {
  BookOpenText,
  ChefHat,
  LoaderCircle,
  Search,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { errorMessageOf } from '../../context/ToastContext';
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
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);
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
        setError(errorMessageOf(requestError, 'Không thể tải thực đơn.'));
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
            <span className="delivery-eyebrow"><BookOpenText size={16} /> Thực đơn LUMORA</span>
            <h1 className="delivery-home-serif">Khám phá hương vị<br /><em>tại LUMORA.</em></h1>
            <p>
              Xem danh sách món ăn, giá bán và thông tin món đang phục vụ tại nhà hàng.
            </p>
          </div>
          <div className="delivery-hero-card delivery-menu-info-card">
            <div className="delivery-hero-icon"><ChefHat size={34} /></div>
            <strong>Thực đơn hiện tại</strong>
            <span>{foods.length} món đang phục vụ</span>
            <b>{categories.length} danh mục</b>
          </div>
        </div>
      </section>

      <section className="delivery-public-container delivery-menu-section">
        <div className="delivery-menu-toolbar">
          <div>
            <span>Thực đơn</span>
            <h2 className="delivery-home-serif">Chọn món bạn muốn khám phá</h2>
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
                  <h3 className="delivery-home-serif">{food?.tenMonAn || 'Món ăn'}</h3>
                  <p>{food?.moTa || 'Món ăn được chuẩn bị chỉn chu từ nguyên liệu được nhà hàng tuyển chọn.'}</p>
                  <div>
                    <strong>{formatMoney(food?.gia)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
