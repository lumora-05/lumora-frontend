import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { unwrapList } from '../../utils/kitchenData';

function foodId(food) {
  return food?.maMonAn || food?.id;
}

function categoryName(food) {
  return food?.danhMuc?.tenDanhMuc || food?.tenDanhMuc || 'Chưa phân loại';
}

function updatePayload(food, active) {
  const payload = {
    tenMonAn: food?.tenMonAn,
    gia: food?.gia,
    moTa: food?.moTa || '',
    hinhAnh: food?.hinhAnh || '',
    trangThai: active,
  };
  const categoryId = food?.danhMuc?.maDanhMuc || food?.maDanhMuc;
  if (categoryId !== undefined && categoryId !== null && categoryId !== '') payload.maDanhMuc = Number(categoryId);
  return payload;
}

export default function KitchenOutOfStock() {
  const toast = useToast();
  const [foods, setFoods] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    try {
      const response = await menuApi.getAll();
      setFoods(unwrapList(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được danh sách món'));
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return foods.filter((food) => !q || `${food?.tenMonAn || ''} ${categoryName(food)}`.toLowerCase().includes(q));
  }, [foods, keyword]);

  async function toggleFood(food) {
    const id = foodId(food);
    const nextStatus = food?.trangThai === false;
    setUpdatingId(id);
    try {
      const response = await menuApi.update(id, updatePayload(food, nextStatus));
      toast.success(messageOf(response, nextStatus ? 'Đã mở bán lại món ăn' : 'Đã báo hết món'));
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật trạng thái món'));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="kitchen-page">
      <div className="kitchen-card kitchen-out-card">
        <div className="kitchen-list-toolbar">
          <div className="kitchen-section-intro warning">
            <span><AlertTriangle size={20} /></span>
            <div><h3>Báo hết món</h3><p>Món hết sẽ không hiển thị để khách hàng tiếp tục gọi</p></div>
          </div>
          <label className="kitchen-modern-search">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm món cần cập nhật..." />
          </label>
        </div>

        <div className="kitchen-table-scroll">
          <table className="kitchen-list-table">
            <thead><tr><th>STT</th><th>Tên món</th><th>Danh mục</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {filtered.map((food, index) => {
                const active = food?.trangThai !== false;
                return (
                  <tr key={foodId(food) || index}>
                    <td>{index + 1}</td>
                    <td><b>{food?.tenMonAn || 'Món ăn'}</b></td>
                    <td>{categoryName(food)}</td>
                    <td><span className={`kitchen-food-status ${active ? 'on' : 'off'}`}>{active ? 'Đang phục vụ' : 'Hết món'}</span></td>
                    <td>
                      <button className={`kitchen-stock-button ${active ? 'report' : 'reopen'}`} disabled={updatingId === foodId(food)} onClick={() => toggleFood(food)}>
                        {active ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}
                        {updatingId === foodId(food) ? 'Đang cập nhật...' : active ? 'Báo hết món' : 'Mở lại món'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? <tr><td colSpan="5" className="kitchen-table-empty">Không có món ăn phù hợp.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
