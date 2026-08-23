import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { categoryApi } from '../../api/menuApi';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';

const emptyForm = { tenDanhMuc: '', tenDanhMucEn: '', moTa: '', moTaEn: '', trangThai: true };

export default function CategoryManage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const debouncedKeyword = useDebounce(keyword, 350);

  async function load() {
    try {
      const response = await categoryApi.getPage({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
      });
      const result = normalizePage(response, size);
      if (result.totalPages > 0 && page >= result.totalPages) {
        setPage(result.totalPages - 1);
        return;
      }
      setRows(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setNumberOfElements(result.numberOfElements);
    } catch (err) {
      toast.error(errorMessageOf(err, 'Không thể tải danh sách danh mục'));
    }
  }

  useEffect(() => { load(); }, [page, size, debouncedKeyword]);

  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, numberOfElements, totalElements);

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  }

  function openEditForm(item) {
    setEditing(item.maDanhMuc);
    setForm({
      tenDanhMuc: item.tenDanhMuc || '',
      tenDanhMucEn: item.tenDanhMucEn || '',
      moTa: item.moTa || '',
      moTaEn: item.moTaEn || '',
      trangThai: item.trangThai !== false,
    });
    setOpenForm(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(false);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      trangThai: form.trangThai === true || form.trangThai === 'true',
    };

    try {
      const isCreating = editing == null;
      const res = editing
        ? await categoryApi.update(editing, payload)
        : await categoryApi.create(payload);
      toast.success(messageOf(res, editing ? 'Cập nhật danh mục thành công' : 'Thêm danh mục thành công'));
      closeForm();
      if (isCreating && page !== 0) setPage(0);
      else load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Lưu danh mục thất bại'));
    }
  }

  function askRemove(item) {
    setDeleteTarget(item);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteTarget(null);
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await categoryApi.remove(deleteTarget.maDanhMuc);
      toast.success(messageOf(res, 'Xóa danh mục thành công'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Xóa danh mục thất bại'));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="category-page">

      <div className="category-toolbar">
        <label className="category-search">
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
            placeholder="Tìm kiếm danh mục..."
          />
          <Search size={21} />
        </label>

        <button className="category-add-btn" onClick={openCreateForm}>
          <Plus size={20} />
          Thêm danh mục
        </button>
      </div>

      <div className="category-table-card">
        <table className="category-table">
          <thead>
            <tr>
              <th>Tên danh mục</th>
              <th>Mô tả</th>
              <th>Số món</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.maDanhMuc}>
                <td className="category-name">{item.tenDanhMuc}</td>
                <td className="category-desc">{item.moTa || 'Không có mô tả'}</td>
                <td className="category-count">{item.soMon ?? 0}</td>
                <td>
                  <span className={item.trangThai !== false ? 'status-pill active' : 'status-pill inactive'}>
                    <i />
                    {item.trangThai !== false ? 'Hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </td>
                <td>
                  <div className="category-actions">
                    <button title="Sửa danh mục" onClick={() => openEditForm(item)}>
                      <Pencil size={18} />
                    </button>
                    <button className="delete" title="Xóa danh mục" onClick={() => askRemove(item)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan="5" className="category-empty">Không tìm thấy danh mục phù hợp</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="category-footer">
          <span>Hiển thị {displayRange.from} - {displayRange.to} trong tổng số {totalElements} danh mục</span>
          <div className="category-pagination">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>‹</button>
            {pageItems.map((item) => (
              <button type="button" key={item} className={item === page ? 'current' : ''} onClick={() => setPage(item)}>{item + 1}</button>
            ))}
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={totalPages === 0 || page >= totalPages - 1}>›</button>
          </div>
          <select className="pagination-size-select" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
            <option value="10">10 / trang</option>
            <option value="20">20 / trang</option>
            <option value="50">50 / trang</option>
          </select>
        </div>
      </div>

      {openForm && (
        <div className="category-modal-backdrop" onMouseDown={closeForm}>
          <form className="category-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
            <div className="category-modal-head">
              <div>
                <h3>{editing ? 'Cập nhật danh mục' : 'Thêm danh mục'}</h3>
                <p>{editing ? 'Chỉnh sửa thông tin danh mục' : 'Nhập thông tin danh mục mới'}</p>
              </div>
              <button type="button" onClick={closeForm}><X size={20} /></button>
            </div>

            <label>
              <span>Tên danh mục</span>
              <input
                required
                value={form.tenDanhMuc}
                onChange={(e) => setForm({ ...form, tenDanhMuc: e.target.value })}
                placeholder="Ví dụ: Món chính"
              />
            </label>

            <label>
              <span>Tên danh mục (English)</span>
              <input
                value={form.tenDanhMucEn}
                onChange={(e) => setForm({ ...form, tenDanhMucEn: e.target.value })}
                placeholder="Example: Main course"
              />
            </label>

            <label>
              <span>Mô tả</span>
              <textarea
                rows="4"
                value={form.moTa}
                onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                placeholder="Ví dụ: Các món ăn chính của nhà hàng"
              />
            </label>


            <label>
              <span>Mô tả (English)</span>
              <textarea
                rows="4"
                value={form.moTaEn}
                onChange={(e) => setForm({ ...form, moTaEn: e.target.value })}
                placeholder="Example: The restaurant's main dishes"
              />
            </label>

            <label>
              <span>Trạng thái</span>
              <select
                value={String(form.trangThai)}
                onChange={(e) => setForm({ ...form, trangThai: e.target.value })}
              >
                <option value="true">Hoạt động</option>
                <option value="false">Ngừng hoạt động</option>
              </select>
            </label>

            <div className="category-modal-actions">
              <button type="button" className="cancel" onClick={closeForm}>Hủy</button>
              <button className="save">{editing ? 'Cập nhật' : 'Lưu danh mục'}</button>
            </div>
          </form>
        </div>
      )}
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={confirmRemove}
        loading={deleteLoading}
        title="Xác nhận xóa danh mục"
        description="Bạn có chắc chắn muốn xóa danh mục này không?"
        itemName={deleteTarget?.tenDanhMuc}
        warning="Hành động này không thể hoàn tác và danh mục sẽ bị xóa khỏi hệ thống."
        confirmText="Xóa danh mục"
      />

    </section>
  );
}
