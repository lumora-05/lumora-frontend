import { useEffect, useState } from 'react';
import { BookOpen, Edit3, ImageIcon, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { categoryApi, menuApi } from '../../api/menuApi';
import { uploadApi } from '../../api/uploadApi';
import Modal from '../../components/common/Modal';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import FoodRecipeModal from '../../components/menu/FoodRecipeModal';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';

const empty = {
  maDanhMuc: '',
  tenMonAn: '',
  gia: '',
  moTa: '',
  hinhAnh: '',
  trangThai: true
};

function unwrapList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getUploadUrl(res) {
  const data = res?.data ?? res;
  if (typeof data === 'string') return data;
  return data?.url || data?.path || data?.fileUrl || data?.hinhAnh || data?.anh || '';
}


function statusText(row) {
  if (row.trangThai === false) return 'Đã ẩn';
  return 'Đang bán';
}

export default function MenuManage() {
  const toast = useToast();
  const [foods, setFoods] = useState([]);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(8);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [recipeTarget, setRecipeTarget] = useState(null);
  const [recipeConfigured, setRecipeConfigured] = useState({});
  const debouncedKeyword = useDebounce(keyword, 350);

  async function load() {
    try {
      const response = await menuApi.getPage({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
        categoryId: catFilter === 'all' ? undefined : Number(catFilter),
      });
      const result = normalizePage(response, size);
      if (result.totalPages > 0 && page >= result.totalPages) {
        setPage(result.totalPages - 1);
        return;
      }
      setFoods(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setNumberOfElements(result.numberOfElements);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể tải danh sách món ăn'));
    }
  }

  useEffect(() => {
    categoryApi.getAll()
      .then((response) => setCats(unwrapList(response)))
      .catch((err) => toast.error(errorMessageOf(err, 'Không thể tải danh mục món ăn')));
  }, []);

  useEffect(() => {
    load();
  }, [page, size, debouncedKeyword, catFilter]);

  useEffect(() => {
    const foodIds = foods
      .map((food) => Number(food.maMonAn))
      .filter((id) => Number.isFinite(id));

    if (!foodIds.length) return undefined;

    let cancelled = false;

    setRecipeConfigured((current) => {
      const next = { ...current };
      foodIds.forEach((id) => {
        if (typeof next[id] !== 'boolean') next[id] = false;
      });
      return next;
    });

    Promise.allSettled(
      foodIds.map(async (id) => {
        const response = await menuApi.getRecipe(id);
        const recipe = response?.data ?? response ?? {};
        return {
          id,
          configured: Array.isArray(recipe?.nguyenLieu) && recipe.nguyenLieu.length > 0,
        };
      }),
    ).then((results) => {
      if (cancelled) return;
      setRecipeConfigured((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.id] = result.value.configured;
          }
        });
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [foods]);

  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, numberOfElements, totalElements);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();

    const payload = {
      ...form,
      maDanhMuc: Number(form.maDanhMuc),
      gia: Number(form.gia),
      trangThai: form.trangThai === true || form.trangThai === 'true'
    };

    try {
      const isCreating = editing == null;
      const res = editing
        ? await menuApi.update(editing, payload)
        : await menuApi.create(payload);

      toast.success(messageOf(res, editing ? 'Cập nhật món ăn thành công' : 'Thêm món ăn thành công'));
      setForm(empty);
      setEditing(null);
      setModalOpen(false);
      if (isCreating && page !== 0) setPage(0);
      else load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Lưu món ăn thất bại'));
    }
  }

  function edit(r) {
    setEditing(r.maMonAn);
    setForm({
      maDanhMuc: r.danhMuc?.maDanhMuc || r.maDanhMuc || '',
      tenMonAn: r.tenMonAn || '',
      gia: r.gia || '',
      moTa: r.moTa || '',
      hinhAnh: r.hinhAnh || '',
      trangThai: r.trangThai !== false
    });
    setModalOpen(true);
  }

  function askRemove(food) {
    setDeleteTarget(food);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteTarget(null);
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await menuApi.remove(deleteTarget.maMonAn);
      toast.success(messageOf(res, 'Xóa món ăn thành công'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Xóa món ăn thất bại'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function chooseFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const r = await uploadApi.foodImage(file);
      const url = getUploadUrl(r);
      if (!url) throw new Error('Không lấy được đường dẫn ảnh sau khi upload');
      setForm((v) => ({ ...v, hinhAnh: url }));
      toast.success(messageOf(r, 'Upload ảnh món ăn thành công'));
    } catch (err) {
      toast.error(errorMessageOf(err, 'Upload ảnh thất bại. Bạn có thể nhập URL ảnh thủ công.'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <section className="page menu-list-page">
      <div className="menu-toolbar-card">
        <label className="menu-search-box">
          <input
            placeholder="Tìm kiếm món ăn theo tên món, danh mục..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
          />
          <Search size={22} />
        </label>

        <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(0); }}>
          <option value="all">Tất cả danh mục</option>
          {cats.map((c) => (
            <option key={c.maDanhMuc} value={c.maDanhMuc}>{c.tenDanhMuc}</option>
          ))}
        </select>

        <button className="add-food-btn" type="button" onClick={openCreate}>
          <Plus size={20} /> Thêm món ăn
        </button>
      </div>

      <div className="menu-table-card">
        <table className="modern-menu-table">
          <thead>
            <tr>
              <th>Món ăn</th>
              <th>Danh mục</th>
              <th>Giá bán</th>
              <th>Trạng thái</th>
              <th>Công thức</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {foods.length ? foods.map((food, index) => (
              <tr key={food.maMonAn || index}>
                <td>
                  <div className="menu-food-info">
                    {food.hinhAnh ? (
                      <img src={imageUrl(food.hinhAnh)} alt={food.tenMonAn} />
                    ) : (
                      <div className="menu-food-placeholder">🍽️</div>
                    )}
                    <div>
                      <strong>{food.tenMonAn}</strong>
                      <span>{food.moTa || 'Món ăn trong thực đơn nhà hàng'}</span>
                    </div>
                  </div>
                </td>
                <td><span className="menu-cat-pill">{food.danhMuc?.tenDanhMuc || food.tenDanhMuc || 'Chưa phân loại'}</span></td>
                <td><b className="menu-price">{formatMoney(food.gia)}</b></td>
                <td><span className={`menu-status-pill ${food.trangThai === false ? 'off' : 'on'}`}>{statusText(food)}</span></td>
                <td>
                  <span className={`menu-recipe-pill ${recipeConfigured[food.maMonAn] ? 'configured' : 'missing'}`}>
                    {recipeConfigured[food.maMonAn] ? 'Đã thiết lập' : 'Chưa thiết lập'}
                  </span>
                </td>
                <td>
                  <div className="menu-actions">
                    <button type="button" title="Thiết lập công thức nguyên liệu" className="recipe" onClick={() => setRecipeTarget(food)}><BookOpen size={18} /></button>
                    <button type="button" title="Sửa món" onClick={() => edit(food)}><Edit3 size={18} /></button>
                    <button type="button" title="Xóa món" className="delete" onClick={() => askRemove(food)}><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="empty">Không có món ăn phù hợp</td></tr>
            )}
          </tbody>
        </table>

        <div className="menu-table-footer">
          <span>Hiển thị {displayRange.from} - {displayRange.to} trong tổng số {totalElements} món</span>
          <div className="pagination-demo">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>‹</button>
            {pageItems.map((item) => (
              <button type="button" key={item} className={item === page ? 'active' : ''} onClick={() => setPage(item)}>{item + 1}</button>
            ))}
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={totalPages === 0 || page >= totalPages - 1}>›</button>
          </div>
          <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
            <option value="8">8 / trang</option>
            <option value="12">12 / trang</option>
            <option value="20">20 / trang</option>
          </select>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Cập nhật món ăn' : 'Thêm món ăn'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={submit} className="food-form modern-food-modal-form">
          <label>
            <span>Danh mục</span>
            <select required value={form.maDanhMuc} onChange={(e) => setForm({ ...form, maDanhMuc: e.target.value })}>
              <option value="">Chọn danh mục</option>
              {cats.map((c) => <option key={c.maDanhMuc} value={c.maDanhMuc}>{c.tenDanhMuc}</option>)}
            </select>
          </label>

          <label>
            <span>Tên món</span>
            <input required placeholder="Ví dụ: Gà nướng mật ong" value={form.tenMonAn} onChange={(e) => setForm({ ...form, tenMonAn: e.target.value })} />
          </label>

          <label>
            <span>Giá bán</span>
            <input required min="0" type="number" placeholder="Ví dụ: 150000" value={form.gia} onChange={(e) => setForm({ ...form, gia: e.target.value })} />
          </label>

          <label>
            <span>Trạng thái</span>
            <select value={String(form.trangThai)} onChange={(e) => setForm({ ...form, trangThai: e.target.value })}>
              <option value="true">Đang bán</option>
              <option value="false">Đã ẩn</option>
            </select>
          </label>

          <div className="food-image-field full-field">
            <div className="compact-food-preview">
              {form.hinhAnh ? (
                <img src={imageUrl(form.hinhAnh)} alt="Ảnh món ăn xem trước" />
              ) : (
                <div className="compact-food-placeholder">
                  <ImageIcon size={28} />
                  <span>Chưa có ảnh</span>
                </div>
              )}
            </div>

            <div className="food-image-controls">
              <label>
                <span>Ảnh món ăn</span>
                
              </label>

              <label className={`file-upload compact-upload${uploading ? ' uploading' : ''}`}>
                <UploadCloud size={18} />
                <span>{uploading ? 'Đang tải ảnh...' : 'Chọn ảnh từ máy'}</span>
                <small>JPG, PNG hoặc WEBP</small>
                <input type="file" accept="image/*" onChange={chooseFile} disabled={uploading} />
              </label>
            </div>
          </div>

          <label className="full-field">
            <span>Mô tả</span>
            <textarea rows="3" placeholder="Mô tả ngắn về món ăn" value={form.moTa} onChange={(e) => setForm({ ...form, moTa: e.target.value })} />
          </label>


          <div className="form-actions full-field food-form-actions">
            <button type="button" className="btn food-cancel-btn" onClick={() => setModalOpen(false)}><X size={16} /> Hủy</button>
            <button className="btn food-save-btn" type="submit">{editing ? 'Cập nhật món' : 'Lưu món'}</button>
          </div>
        </form>
      </Modal>
      <FoodRecipeModal
        open={Boolean(recipeTarget)}
        food={recipeTarget}
        onClose={() => setRecipeTarget(null)}
        onSaved={({ foodId, hasRecipe }) => {
          setRecipeConfigured((current) => ({ ...current, [foodId]: hasRecipe }));
        }}
      />
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={confirmRemove}
        loading={deleteLoading}
        title="Xác nhận xóa món ăn"
        description="Bạn có chắc chắn muốn xóa món ăn này không?"
        itemName={deleteTarget?.tenMonAn}
        warning="Hành động này không thể hoàn tác và món ăn sẽ bị xóa khỏi thực đơn."
        confirmText="Xóa món ăn"
      />

    </section>
  );
}
