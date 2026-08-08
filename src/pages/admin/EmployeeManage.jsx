import { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { tableApi } from '../../api/tableApi';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';

const emptyForm = {
  hoTen: '',
  soDienThoai: '',
  email: '',
  tenDangNhap: '',
  matKhau: '123456',
  tenVaiTro: 'WAITER',
  khuVucPhuTrach: '',
  danhSachKhuVucPhuTrach: [],
  trangThai: 'DANG_LAM_VIEC'
};

const ROLE_OPTIONS = [
  { value: 'all', label: 'Tất cả vai trò' },
  { value: 'ADMIN', label: 'Quản lý' },
  { value: 'CASHIER', label: 'Thu ngân' },
  { value: 'WAITER', label: 'Phục vụ' },
  { value: 'KITCHEN', label: 'Bếp' }
];

function roleCode(row) {
  return (row?.vaiTro?.tenVaiTro || row?.tenVaiTro || row?.role || 'WAITER').replace('ROLE_', '');
}

function roleLabel(code) {
  switch ((code || '').replace('ROLE_', '')) {
    case 'ADMIN': return 'Quản lý';
    case 'CASHIER': return 'Thu ngân';
    case 'KITCHEN': return 'Bếp';
    case 'WAITER': return 'Phục vụ';
    default: return code || 'Nhân viên';
  }
}

function roleClass(code) {
  switch ((code || '').replace('ROLE_', '')) {
    case 'ADMIN': return 'manager';
    case 'CASHIER': return 'cashier';
    case 'KITCHEN': return 'kitchen';
    case 'WAITER': return 'waiter';
    default: return 'default';
  }
}


function assignedAreas(row) {
  const multi = Array.isArray(row?.danhSachKhuVucPhuTrach)
    ? row.danhSachKhuVucPhuTrach
    : [];
  const legacy = typeof row?.khuVucPhuTrach === 'string' ? row.khuVucPhuTrach.trim() : '';
  return [...new Set([
    ...multi.map((value) => String(value || '').trim()),
    legacy,
  ].filter(Boolean))];
}

function tableArea(row) {
  const value = row?.khuVuc?.tenKhuVuc
    || row?.tenKhuVuc
    || (typeof row?.khuVuc === 'string' ? row.khuVuc : '')
    || row?.tang
    || 'Khu vực chung';
  return String(value).trim() || 'Khu vực chung';
}

function unwrapRows(response) {
  const raw = response?.data ?? response ?? [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.content)) return raw.content;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

function statusLabel(code) {
  switch (code) {
    case 'DANG_LAM_VIEC': return 'Hoạt động';
    case 'TAM_NGHI': return 'Tạm nghỉ';
    case 'DA_NGHI': return 'Đã nghỉ việc';
    default: return code || 'Hoạt động';
  }
}

function statusClass(code) {
  switch (code) {
    case 'DANG_LAM_VIEC': return 'active';
    case 'TAM_NGHI': return 'pause';
    case 'DA_NGHI': return 'inactive';
    default: return 'active';
  }
}

export default function EmployeeManage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [areaOptions, setAreaOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [openForm, setOpenForm] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const debouncedKeyword = useDebounce(keyword, 350);

  async function loadAreas() {
    try {
      const response = await tableApi.getAll();
      const names = [...new Set(unwrapRows(response).map(tableArea).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi'));
      setAreaOptions(names);
    } catch {
      setAreaOptions([]);
      toast.info('Không thể tải danh sách khu vực từ quản lý bàn');
    }
  }

  async function load() {
    try {
      const response = await employeeApi.getPage({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
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
      toast.error(errorMessageOf(err, 'Không thể tải danh sách nhân viên'));
    }
  }

  useEffect(() => {
    load();
  }, [page, size, debouncedKeyword, roleFilter]);

  useEffect(() => {
    loadAreas();
  }, []);

  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, numberOfElements, totalElements);
  const selectableAreas = [...new Set([
    ...areaOptions,
    ...(form.danhSachKhuVucPhuTrach || []),
    form.khuVucPhuTrach?.trim(),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  }

  function openEditForm(item) {
    setEditing(item.maNhanVien || item.id);
    setForm({
      hoTen: item.hoTen || '',
      soDienThoai: item.soDienThoai || '',
      email: item.email || '',
      tenDangNhap: item.tenDangNhap || '',
      matKhau: '',
      tenVaiTro: roleCode(item),
      khuVucPhuTrach: assignedAreas(item)[0] || '',
      danhSachKhuVucPhuTrach: assignedAreas(item),
      trangThai: item.trangThai || 'DANG_LAM_VIEC'
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
    const selectedAreas = form.tenVaiTro === 'WAITER'
      ? [...new Set((form.danhSachKhuVucPhuTrach || []).map((area) => String(area).trim()).filter(Boolean))]
      : [];

    if (form.tenVaiTro === 'WAITER' && selectedAreas.length === 0) {
      toast.error('Vui lòng chọn ít nhất một khu vực phụ trách');
      return;
    }

    const payload = {
      ...form,
      tenVaiTro: form.tenVaiTro,
      // Giữ trường cũ để tương thích ngược; backend mới ưu tiên danh sách nhiều khu vực.
      khuVucPhuTrach: form.tenVaiTro === 'WAITER' ? (selectedAreas[0] || null) : null,
      danhSachKhuVucPhuTrach: form.tenVaiTro === 'WAITER' ? selectedAreas : [],
      matKhau: form.matKhau || undefined
    };

    try {
      const isCreating = editing == null;
      const res = editing
        ? await employeeApi.update(editing, payload)
        : await employeeApi.create(payload);
      toast.success(messageOf(res, editing ? 'Cập nhật nhân viên thành công' : 'Thêm nhân viên thành công'));
      closeForm();
      if (isCreating && page !== 0) setPage(0);
      else load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Lưu nhân viên thất bại'));
    }
  }

  function askRemove(row) {
    setDeleteTarget(row);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteTarget(null);
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await employeeApi.remove(deleteTarget.maNhanVien || deleteTarget.id);
      toast.success(messageOf(res, 'Xóa nhân viên thành công'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Xóa nhân viên thất bại'));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="employee-page">
      <div className="employee-toolbar">
        <label className="employee-search">
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
            placeholder="Tìm kiếm nhân viên..."
          />
          <Search size={21} />
        </label>

        <select className="employee-role-filter" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}>
          {ROLE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        <button className="employee-add-btn" type="button" onClick={openCreateForm}>
          <Plus size={20} />
          Thêm nhân viên
        </button>
      </div>

      <div className="employee-table-card">
        <div className="employee-table-scroll">
          <table className="employee-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ tên</th>
              <th>Tên đăng nhập</th>
              <th>Số điện thoại</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Khu vực phụ trách</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.maNhanVien || item.id || index}>
                <td className="employee-stt">{page * size + index + 1}</td>
                <td className="employee-name">{item.hoTen || 'Chưa cập nhật'}</td>
                <td className="employee-username">{item.tenDangNhap || item.username || '—'}</td>
                <td>{item.soDienThoai || '—'}</td>
                <td>{item.email || '—'}</td>
                <td>
                  <span className={`employee-role-badge ${roleClass(roleCode(item))}`}>
                    {roleLabel(roleCode(item))}
                  </span>
                </td>
                <td>
                  {roleCode(item) === 'WAITER' ? (
                    assignedAreas(item).length > 0 ? (
                      <div className="employee-area-badges">
                        {assignedAreas(item).map((area) => (
                          <span className="employee-area-badge assigned" key={area}>
                            <MapPin size={14} />
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="employee-area-badge unassigned">
                        <MapPin size={14} />
                        Chưa phân công
                      </span>
                    )
                  ) : (
                    <span className="employee-area-empty">—</span>
                  )}
                </td>
                <td>
                  <span className={`employee-status-badge ${statusClass(item.trangThai)}`}>
                    <i />
                    {statusLabel(item.trangThai)}
                  </span>
                </td>
                <td>
                  <div className="employee-actions">
                    <button type="button" title="Sửa nhân viên" onClick={() => openEditForm(item)}>
                      <Pencil size={18} />
                    </button>
                    <button className="delete" type="button" title="Xóa nhân viên" onClick={() => askRemove(item)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan="9" className="employee-empty">Không tìm thấy nhân viên phù hợp</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>

        <div className="employee-footer">
          <span>Hiển thị {displayRange.from} - {displayRange.to} trong tổng số {totalElements} nhân viên</span>
          <div className="employee-pagination">
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
        <div className="employee-modal-backdrop" onMouseDown={closeForm}>
          <form className="employee-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
            <div className="employee-modal-head">
              <div>
                <h3>{editing ? 'Cập nhật nhân viên' : 'Thêm nhân viên'}</h3>
                <p>{editing ? 'Chỉnh sửa thông tin nhân viên' : 'Nhập thông tin nhân viên mới'}</p>
              </div>
              <button type="button" onClick={closeForm}><X size={20} /></button>
            </div>

            <div className="employee-modal-grid">
              <label>
                <span>Họ tên</span>
                <input
                  required
                  value={form.hoTen}
                  onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn An"
                />
              </label>

              <label>
                <span>Số điện thoại</span>
                <input
                  required
                  value={form.soDienThoai}
                  onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
                  placeholder="Ví dụ: 0901 234 567"
                />
              </label>

              <label>
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Ví dụ: an.nguyen@email.com"
                />
              </label>

              <label>
                <span>Tên đăng nhập</span>
                <input
                  required
                  value={form.tenDangNhap}
                  onChange={(e) => setForm({ ...form, tenDangNhap: e.target.value })}
                  placeholder="Ví dụ: nguyenvanan"
                />
              </label>

              <label>
                <span>Mật khẩu</span>
                <input
                  type="password"
                  value={form.matKhau}
                  onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
                  placeholder={editing ? 'Để trống nếu không đổi mật khẩu' : 'Nhập mật khẩu'}
                />
              </label>

              <label>
                <span>Vai trò</span>
                <select
                  value={form.tenVaiTro}
                  onChange={(e) => {
                    const tenVaiTro = e.target.value;
                    setForm((current) => ({
                      ...current,
                      tenVaiTro,
                      khuVucPhuTrach: tenVaiTro === 'WAITER' ? current.khuVucPhuTrach : '',
                      danhSachKhuVucPhuTrach: tenVaiTro === 'WAITER'
                        ? current.danhSachKhuVucPhuTrach
                        : [],
                    }));
                  }}
                >
                  {ROLE_OPTIONS.filter((item) => item.value !== 'all').map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              {form.tenVaiTro === 'WAITER' && (
                <div className="full employee-area-field">
                  <span className="employee-area-title">Khu vực phụ trách</span>
                  {selectableAreas.length > 0 ? (
                    <div className="employee-area-options">
                      {selectableAreas.map((area) => {
                        const checked = (form.danhSachKhuVucPhuTrach || []).includes(area);
                        return (
                          <label className={`employee-area-option ${checked ? 'selected' : ''}`} key={area}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setForm((current) => {
                                  const areas = current.danhSachKhuVucPhuTrach || [];
                                  const nextAreas = areas.includes(area)
                                    ? areas.filter((item) => item !== area)
                                    : [...areas, area];
                                  return {
                                    ...current,
                                    khuVucPhuTrach: nextAreas[0] || '',
                                    danhSachKhuVucPhuTrach: nextAreas,
                                  };
                                });
                              }}
                            />
                            <span>{area}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                  <small>
                    Có thể chọn một hoặc nhiều khu vực. Phục vụ chỉ thấy bàn, đơn và yêu cầu thuộc các khu vực được phân công.
                  </small>
                  {selectableAreas.length === 0 && (
                    <small className="employee-area-warning">
                      Chưa có khu vực nào. Hãy gán khu vực cho bàn trước khi tạo nhân viên phục vụ.
                    </small>
                  )}
                </div>
              )}

              <label className="full">
                <span>Trạng thái</span>
                <select value={form.trangThai} onChange={(e) => setForm({ ...form, trangThai: e.target.value })}>
                  <option value="DANG_LAM_VIEC">Hoạt động</option>
                  <option value="TAM_NGHI">Tạm nghỉ</option>
                  <option value="DA_NGHI">Đã nghỉ việc</option>
                </select>
              </label>
            </div>

            <div className="employee-modal-actions">
              <button type="button" className="cancel" onClick={closeForm}>Hủy</button>
              <button type="submit" className="save">{editing ? 'Cập nhật' : 'Lưu nhân viên'}</button>
            </div>
          </form>
        </div>
      )}
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={confirmRemove}
        loading={deleteLoading}
        title="Xác nhận xóa nhân viên"
        description="Bạn có chắc chắn muốn xóa nhân viên này không?"
        itemName={deleteTarget?.hoTen}
        warning="Hành động này không thể hoàn tác và hồ sơ nhân viên sẽ bị xóa khỏi hệ thống."
        confirmText="Xóa nhân viên"
      />

    </section>
  );
}
