import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed
} from 'lucide-react';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { menuApi } from '../../api/menuApi';
import { useCart } from '../../context/CartContext';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';

export default function FoodDetail() {
  const { qrToken, foodId } = useParams();
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [added, setAdded] = useState(false);
  const cart = useCart();

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
    loadFood();
  }, [foodId]);

  const total = useMemo(() => Number(food?.gia || 0) * quantity, [food, quantity]);
  const available = food?.trangThai !== false && food?.trangThai !== 'NGUNG_BAN' && food?.conHang !== false;

  function addToCart() {
    if (!food || !available) return;
    cart.add({ ...food, ghiChu: note.trim() }, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
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
                ? <img src={imageUrl(food.hinhAnh)} alt={food.tenMonAn} />
                : <span><UtensilsCrossed size={78} /></span>}
              <em className={available ? 'available' : 'unavailable'}>{available ? 'Đang phục vụ' : 'Tạm hết món'}</em>
            </div>

            <article className="customer-detail-content">
              <span className="customer-detail-category">{food.danhMuc?.tenDanhMuc || 'Món ăn'}</span>
              <div className="customer-detail-title-row">
                <h1>{food.tenMonAn}</h1>
                <strong>{formatMoney(food.gia)}</strong>
              </div>
              <p>{food.moTa || 'Món ăn được chế biến tươi ngon từ nguyên liệu được lựa chọn kỹ lưỡng tại nhà hàng.'}</p>

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
        </section>
      )}
    </main>
  );
}
