import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Search, Utensils } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { unwrapList } from '../../utils/kitchenData';
import { pageDisplayRange, paginationItems } from '../../utils/pagination';

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

const FILTERS = [
  ['ALL', 'Tất cả'],
  ['ACTIVE', 'Đang phục vụ'],
  ['OUT', 'Hết món'],
];

export default function KitchenMenuList() {
  const toast = useToast();
  const [foods, setFoods] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(8);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await menuApi.getAll();
      setFoods(unwrapList(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được tình trạng món'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    ALL: foods.length,
    ACTIVE: foods.filter((food) => food?.trangThai !== false).length,
    OUT: foods.filter((food) => food?.trangThai === false).length,
  }), [foods]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return foods
      .filter((food) => filter === 'ALL' || (filter === 'ACTIVE' ? food?.trangThai !== false : food?.trangThai === false))
      .filter((food) => !q || `${food?.tenMonAn || ''} ${categoryName(food)}`.toLowerCase().includes(q));
  }, [foods, keyword, filter]);

  const totalElements = filtered.length;
  const totalPages = totalElements ? Math.ceil(totalElements / size) : 0;
  const pageRows = useMemo(() => filtered.slice(page * size, page * size + size), [filtered, page, size]);
  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, pageRows.length, totalElements);

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1);
    if (totalPages === 0 && page !== 0) setPage(0);
  }, [page, totalPages]);

  function changeFilter(value) {
    setFilter(value);
    setPage(0);
  }

  function changeKeyword(event) {
    setKeyword(event.target.value);
    setPage(0);
  }

  async function toggleFood(food) {
    const id = foodId(food);
    const nextStatus = food?.trangThai === false;
    setUpdatingId(id);
    try {
      const response = await menuApi.update(id, updatePayload(food, nextStatus));
      toast.success(messageOf(response, nextStatus ? 'Đã mở bán lại món ăn' : 'Đã báo hết món'));
      setFoods((current) => current.map((item) => foodId(item) === id ? { ...item, trangThai: nextStatus } : item));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật trạng thái món'));
      await load(false);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="kitchen-page">
      <div className="kitchen-menu-summary">
        <article><span><Utensils size={20} /></span><div><small>Tổng thực đơn</small><strong>{counts.ALL}</strong></div></article>
        <article className="active"><span><CheckCircle2 size={20} /></span><div><small>Đang phục vụ</small><strong>{counts.ACTIVE}</strong></div></article>
        <article className="out"><span><AlertTriangle size={20} /></span><div><small>Đã báo hết</small><strong>{counts.OUT}</strong></div></article>
      </div>

      <div className="kitchen-card kitchen-menu-card">
        <div className="kitchen-list-toolbar kitchen-menu-toolbar">
          <div className="kitchen-queue-tabs">
            {FILTERS.map(([value, label]) => (
              <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => changeFilter(value)}>
                {label}<span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="kitchen-modern-search">
            <Search size={18} />
            <input value={keyword} onChange={changeKeyword} placeholder="Tìm theo tên món hoặc danh mục..." />
          </label>
        </div>

        <div className="kitchen-table-scroll">
          <table className="kitchen-list-table kitchen-menu-status-table kitchen-action-table">
            <thead><tr><th>STT</th><th>Tên món</th><th>Danh mục</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="kitchen-table-empty">Đang tải tình trạng món...</td></tr> : null}
              {!loading && pageRows.map((food, index) => {
                const active = food?.trangThai !== false;
                const id = foodId(food);
                return (
                  <tr key={id || index}>
                    <td data-label="STT">{page * size + index + 1}</td>
                    <td data-label="Tên món"><b>{food?.tenMonAn || 'Món ăn'}</b><small>{food?.moTa || 'Không có mô tả'}</small></td>
                    <td data-label="Danh mục">{categoryName(food)}</td>
                    <td data-label="Trạng thái"><span className={`kitchen-food-status ${active ? 'on' : 'off'}`}>{active ? 'Đang phục vụ' : 'Hết món'}</span></td>
                    <td data-label="Thao tác">
                      <button type="button" className={`kitchen-stock-button ${active ? 'report' : 'reopen'}`} disabled={updatingId === id} onClick={() => toggleFood(food)}>
                        {active ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}
                        {updatingId === id ? 'Đang cập nhật...' : active ? 'Báo hết món' : 'Mở lại món'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && !pageRows.length ? <tr><td colSpan="5" className="kitchen-table-empty">Không có món ăn phù hợp.</td></tr> : null}
            </tbody>
          </table>
        </div>

        {!loading ? (
          <div className="kitchen-menu-pagination">
            <span>Hiển thị <b>{displayRange.from} - {displayRange.to}</b> trong tổng số <b>{totalElements}</b> món</span>
            <div className="kitchen-pagination-buttons">
              <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="Trang trước">
                <ChevronLeft size={17} />
              </button>
              {pageItems.map((item) => (
                <button type="button" key={item} className={item === page ? 'active' : ''} onClick={() => setPage(item)}>{item + 1}</button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={totalPages === 0 || page >= totalPages - 1} aria-label="Trang sau">
                <ChevronRight size={17} />
              </button>
            </div>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} aria-label="Số món mỗi trang">
              <option value="8">8 / trang</option>
              <option value="12">12 / trang</option>
              <option value="20">20 / trang</option>
            </select>
          </div>
        ) : null}
      </div>
    </section>
  );
}
