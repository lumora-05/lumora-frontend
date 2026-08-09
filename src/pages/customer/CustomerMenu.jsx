import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CakeSlice,
  ChevronDown,
  ChevronRight,
  ChefHat,
  CupSoda,
  Grid2X2,
  Leaf,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { tableApi } from '../../api/tableApi';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import '../../styles/home.css';

const PAGE_SIZE = 8;

function foodId(food) {
  return food.maMonAn ?? food.id;
}

function categoryId(cat) {
  return cat.maDanhMuc ?? cat.id;
}

function categoryName(cat) {
  return cat.tenDanhMuc ?? cat.name ?? 'Danh mục';
}

function categoryIconType(name = '') {
  const value = String(name).toLowerCase();
  if (value.includes('nổi') || value.includes('hot') || value.includes('đặc')) return 'featured';
  if (value.includes('chính') || value.includes('món ăn')) return 'main';
  if (value.includes('salad')) return 'salad';
  if (value.includes('uống') || value.includes('nước') || value.includes('trà') || value.includes('cafe')) return 'drink';
  if (value.includes('tráng') || value.includes('ngọt') || value.includes('bánh')) return 'dessert';
  if (value.includes('chay') || value.includes('healthy')) return 'vegan';
  return 'default';
}

function CategoryIcon({ type }) {
  const props = { size: 20, strokeWidth: 2.1 };
  switch (type) {
    case 'featured': return <Star {...props} />;
    case 'main': return <UtensilsCrossed {...props} />;
    case 'salad':
    case 'vegan': return <Leaf {...props} />;
    case 'drink': return <CupSoda {...props} />;
    case 'dessert': return <CakeSlice {...props} />;
    default: return <ChefHat {...props} />;
  }
}

function mergeFoods(current, incoming) {
  const merged = new Map();
  [...current, ...incoming].forEach((food, index) => {
    merged.set(String(foodId(food) ?? `food-${index}`), food);
  });
  return Array.from(merged.values());
}

function foodDescription(food) {
  return food?.moTaNgan
    ?? food?.moTa
    ?? food?.mota
    ?? food?.description
    ?? 'Hương vị hấp dẫn, được chuẩn bị từ nguyên liệu tươi ngon tại LUMORA.';
}

function foodBadge(food, index) {
  const text = `${food?.tenMonAn ?? ''} ${foodDescription(food)}`.toLowerCase();
  if (text.includes('salad') || text.includes('healthy') || text.includes('rau')) {
    return { tone: 'healthy', label: 'Healthy' };
  }
  if (index === 0) return { tone: 'hot', label: 'Bán chạy' };
  if (index === 1) return { tone: 'chef', label: 'Đầu bếp gợi ý' };
  if (index === 2) return { tone: 'healthy', label: 'Healthy' };
  if (index === 3) return { tone: 'new', label: 'Mới' };
  return null;
}

export default function CustomerMenu() {
  const { qrToken } = useParams();
  const cart = useCart();
  const toast = useToast();
  const requestSequence = useRef(0);
  const [foods, setFoods] = useState([]);
  const [cats, setCats] = useState([]);
  const [table, setTable] = useState(null);
  const [q, setQ] = useState('');
  const debouncedQuery = useDebounce(q, 350);
  const [cat, setCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [menuError, setMenuError] = useState('');
  const [pageInfo, setPageInfo] = useState({
    page: 0,
    totalElements: 0,
    totalPages: 0,
    last: true,
  });

  const loadTableAccess = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      setMenuError('');
      setAccessReady(false);
      const response = await tableApi.customerTableByQrToken(qrToken);
      const data = response?.data ?? response;
      setTable(data?.banAn ?? data?.table ?? null);
      setCats(data?.danhMuc ?? data?.categories ?? []);
      setAccessReady(true);
    } catch (error) {
      setTable(null);
      setFoods([]);
      setCats([]);
      setLoadError(error?.message || 'Không thể truy cập thực đơn của bàn này. Vui lòng quét lại mã QR hoặc liên hệ nhân viên.');
    } finally {
      setLoading(false);
    }
  }, [qrToken]);

  const loadMenuPage = useCallback(async (page = 0, append = false) => {
    const requestId = ++requestSequence.current;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setMenuLoading(true);
        setMenuError('');
      }

      const response = await tableApi.customerMenuByQrToken(qrToken, {
        page,
        size: PAGE_SIZE,
        keyword: debouncedQuery.trim() || undefined,
        categoryId: cat === 'all' ? undefined : Number(cat),
      });

      if (requestId !== requestSequence.current) return;

      const data = response?.data ?? response;
      const nextFoods = Array.isArray(data?.content) ? data.content : [];

      setFoods((current) => (append ? mergeFoods(current, nextFoods) : nextFoods));
      setPageInfo({
        page: Number(data?.page ?? page),
        totalElements: Number(data?.totalElements ?? nextFoods.length),
        totalPages: Number(data?.totalPages ?? (nextFoods.length ? 1 : 0)),
        last: Boolean(data?.last ?? true),
      });
    } catch (error) {
      if (requestId !== requestSequence.current) return;

      const message = error?.message || 'Không thể tải danh sách món ăn. Vui lòng thử lại.';
      if (append) {
        toast.error(message);
      } else {
        setFoods([]);
        setPageInfo({ page: 0, totalElements: 0, totalPages: 0, last: true });
        setMenuError(message);
      }
    } finally {
      if (requestId === requestSequence.current) {
        setMenuLoading(false);
        setLoadingMore(false);
      }
    }
  }, [cat, debouncedQuery, qrToken, toast]);

  useEffect(() => {
    loadTableAccess();
  }, [loadTableAccess]);

  useEffect(() => {
    if (!accessReady) return;
    loadMenuPage(0, false);
  }, [accessReady, loadMenuPage]);

  const categoryList = useMemo(() => cats.map((item) => ({
    id: String(categoryId(item)),
    name: categoryName(item),
    iconType: categoryIconType(categoryName(item)),
  })), [cats]);

  const tableName = table?.tenBan || table?.soBan || 'Bàn';
  const currentTitle = cat === 'all'
    ? 'Tất cả món'
    : categoryList.find((item) => item.id === String(cat))?.name || 'Danh sách món';

  function handleAdd(food) {
    cart.add(food);
    toast.success(`Đã thêm ${food.tenMonAn || 'món ăn'} vào giỏ hàng`, {
      id: 'customer-add-to-cart',
      duration: 1000,
    });
  }

  function handleLoadMore() {
    if (loadingMore || pageInfo.last) return;
    loadMenuPage(pageInfo.page + 1, true);
  }

  return (
    <main className="customer-flow-page customer-menu-showcase-page">
      <CustomerHeader tableName={tableName} variant="menu-showcase" />

      <div className="customer-menu-home-clone v0-home">
        {loading ? (
          <div className="customer-menu-access-state">
            <LoaderCircle className="spin" size={34} />
            <h2>Đang tải thực đơn...</h2>
            <p>Hệ thống đang kiểm tra thông tin bàn và danh sách món.</p>
          </div>
        ) : loadError ? (
          <div className="customer-menu-access-state error">
            <AlertTriangle size={38} />
            <h2>Chưa thể mở thực đơn</h2>
            <p>{loadError}</p>
            <button type="button" onClick={loadTableAccess}><RefreshCw size={18} /> Thử lại</button>
          </div>
        ) : (
          <section className="v0-shell v0-section v0-menu-section customer-menu-home-section">
            <div className="v0-section-head">
              <span className="v0-eyebrow">Thực đơn</span>
              <h2 className="v0-serif">Những món ăn được yêu thích nhất</h2>
              <p>
                Tuyển chọn từ căn bếp LUMORA — mỗi món là sự kết hợp giữa nguyên liệu tươi và bàn tay khéo léo của đầu bếp.
              </p>
            </div>

            {menuError ? (
              <div className="customer-menu-inline-state error">
                <AlertTriangle size={27} />
                <div>
                  <strong>Không thể tải món ăn</strong>
                  <span>{menuError}</span>
                </div>
                <button type="button" onClick={() => loadMenuPage(0, false)}><RefreshCw size={17} /> Thử lại</button>
              </div>
            ) : menuLoading ? (
              <div className="customer-menu-inline-state customer-menu-home-state">
                <LoaderCircle className="spin" size={29} />
                <div>
                  <strong>Đang tải món ăn...</strong>
                  <span>Mỗi lần hiển thị tối đa {PAGE_SIZE} món.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="v0-dish-grid">
                  {!foods.length ? <div className="customer-menu-empty customer-menu-home-empty">Không tìm thấy món phù hợp.</div> : null}
                  {foods.map((food, index) => {
                    const badge = foodBadge(food, index);
                    const detailUrl = `/table/${qrToken}/foods/${foodId(food)}`;
                    return (
                      <article className="v0-dish-card" key={foodId(food) || index}>
                        <div className="v0-dish-image-wrap">
                          <Link className="customer-menu-home-image-link" to={detailUrl}>
                            {food.hinhAnh
                              ? <img src={imageUrl(food.hinhAnh)} alt={food.tenMonAn} />
                              : <span className="customer-menu-home-image-placeholder"><UtensilsCrossed size={42} /></span>}
                          </Link>
                          {badge ? <span className="v0-dish-tag">{badge.label}</span> : null}
                        </div>
                        <div className="v0-dish-body">
                          <h3 className="v0-serif">
                            <Link className="customer-menu-home-title-link" to={detailUrl}>{food.tenMonAn}</Link>
                          </h3>
                          <p>{foodDescription(food)}</p>
                          <div className="v0-dish-bottom">
                            <span className="v0-serif v0-price">{formatMoney(food.gia)}</span>
                            <button type="button" className="v0-button v0-button-primary v0-dish-add v0-pill" onClick={() => handleAdd(food)}>
                              <Plus size={16} />
                              Thêm
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {!pageInfo.last && foods.length ? (
                  <div className="v0-menu-more">
                    <button type="button" className="v0-button v0-button-outline v0-pill customer-menu-home-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? <LoaderCircle className="spin" size={18} /> : null}
                      {loadingMore ? 'Đang tải thêm...' : 'Xem thêm món'}
                      {!loadingMore ? <ChevronDown size={18} /> : null}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function ShoppingCartProxy() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 2-1.69l1.38-7.31H5.12" />
    </svg>
  );
}
