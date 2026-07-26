import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { promotionApi } from '../../api/promotionApi';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import { formatMoney } from '../../utils/formatMoney';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';

const emptyForm = {
  tenKhuyenMai: '',
  maCode: '',
  moTa: '',
  loaiGiam: 'PERCENT',
  giaTriGiam: '',
  giaTriDonToiThieu: '0',
  giamToiDa: '',
  gioiHanSuDung: '',
  soLuotDaDung: 0,
  ngayBatDau: '',
  ngayKetThuc: '',
  trangThai: true,
};

function toDateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function formatDateOnly(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function promotionType(row) {
  const value = String(row?.loaiGiam || row?.loaiGiamGia || 'PERCENT').toUpperCase();
  return ['SO_TIEN', 'FIXED', 'AMOUNT', 'TIEN'].includes(value) ? 'FIXED' : 'PERCENT';
}

function typeLabel(type) {
  return type === 'FIXED' ? 'Số tiền' : 'Phần trăm';
}

function valueLabel(row) {
  const value = Number(row?.giaTriGiam || 0);
  return promotionType(row) === 'FIXED' ? formatMoney(value) : `${value}%`;
}

function usageLabel(row) {
  const used = Number(row?.soLuotDaDung || 0);
  const limit = row?.gioiHanSuDung;
  return limit == null ? `${used} / Không giới hạn` : `${used} / ${Number(limit)}`;
}

function getPromotionStatus(row) {
  if (row?.trangThai === false) {
    return { code: 'DISABLED', label: 'Tạm tắt', className: 'disabled' };
  }

  const used = Number(row?.soLuotDaDung || 0);
  const limit = row?.gioiHanSuDung == null ? null : Number(row.gioiHanSuDung);
  if (limit != null && used >= limit) {
    return { code: 'EXHAUSTED', label: 'Hết lượt', className: 'ended' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = row?.ngayBatDau ? new Date(`${toDateOnly(row.ngayBatDau)}T00:00:00`) : null;
  const end = row?.ngayKetThuc ? new Date(`${toDateOnly(row.ngayKetThuc)}T23:59:59`) : null;

  if (start && start > today) {
    return { code: 'UPCOMING', label: 'Sắp diễn ra', className: 'upcoming' };
  }
  if (end && end < today) {
    return { code: 'ENDED', label: 'Đã kết thúc', className: 'ended' };
  }
  return { code: 'ACTIVE', label: 'Đang áp dụng', className: 'active' };
}

export default function PromotionManage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
      const response = await promotionApi.getPage({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
        status: statusFilter,
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
      toast.error(errorMessageOf(err, 'Không thể tải danh sách khuyến mãi'));
    }
  }

  useEffect(() => {
    load();
  }, [page, size, debouncedKeyword, statusFilter]);

  const pageItems = paginationItems(page, totalPages);
  const displayRange = pageDisplayRange(page, size, numberOfElements, totalElements);
  const rulesLocked = editing != null && Number(form.soLuotDaDung || 0) > 0;

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  }

  function openEditForm(row) {
    setEditing(row.maKhuyenMai || row.id);
    setForm({
      tenKhuyenMai: row.tenKhuyenMai || '',
      maCode: row.maCode || row.code || '',
      moTa: row.moTa || '',
      loaiGiam: promotionType(row),
      giaTriGiam: row.giaTriGiam ?? '',
      giaTriDonToiThieu: row.giaTriDonToiThieu ?? 0,
      giamToiDa: row.giamToiDa ?? '',
      gioiHanSuDung: row.gioiHanSuDung ?? '',
      soLuotDaDung: row.soLuotDaDung ?? 0,
      ngayBatDau: toDateOnly(row.ngayBatDau),
      ngayKetThuc: toDateOnly(row.ngayKetThuc),
      trangThai: row.trangThai !== false,
    });
    setOpenForm(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(false);
  }

  async function submit(event) {
    event.preventDefault();

    const discountValue = Number(form.giaTriGiam);
    const minimumOrder = Number(form.giaTriDonToiThieu || 0);
    const maximumDiscount = form.giamToiDa === '' ? null : Number(form.giamToiDa);
    const usageLimit = form.gioiHanSuDung === '' ? null : Number(form.gioiHanSuDung);

    if (!form.maCode.trim()) {
      toast.error('Vui lòng nhập mã khuyến mãi');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      toast.error('Giá trị giảm phải lớn hơn 0');
      return;
    }
    if (form.loaiGiam === 'PERCENT' && discountValue > 100) {
      toast.error('Giá trị giảm theo phần trăm không được vượt quá 100');
      return;
    }
    if (!Number.isFinite(minimumOrder) || minimumOrder < 0) {
      toast.error('Giá trị đơn tối thiểu không hợp lệ');
      return;
    }
    if (maximumDiscount != null && (!Number.isFinite(maximumDiscount) || maximumDiscount <= 0)) {
      toast.error('Mức giảm tối đa phải lớn hơn 0 hoặc để trống');
      return;
    }
    if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
      toast.error('Giới hạn sử dụng phải là số nguyên từ 1 trở lên hoặc để trống');
      return;
    }
    if (usageLimit != null && usageLimit < Number(form.soLuotDaDung || 0)) {
      toast.error('Giới hạn sử dụng không được nhỏ hơn số lượt đã dùng');
      return;
    }
    if (form.ngayBatDau && form.ngayKetThuc && form.ngayKetThuc < form.ngayBatDau) {
      toast.error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      return;
    }

    const payload = {
      tenKhuyenMai: form.tenKhuyenMai.trim(),
      maCode: form.maCode.trim().toUpperCase(),
      moTa: form.moTa.trim() || null,
      loaiGiam: form.loaiGiam,
      giaTriGiam: discountValue,
      giaTriDonToiThieu: minimumOrder,
      giamToiDa: maximumDiscount,
      gioiHanSuDung: usageLimit,
      ngayBatDau: form.ngayBatDau,
      ngayKetThuc: form.ngayKetThuc,
      trangThai: form.trangThai === true || form.trangThai === 'true',
    };

    try {
      const isCreating = editing == null;
      const response = editing
        ? await promotionApi.update(editing, payload)
        : await promotionApi.create(payload);
      toast.success(messageOf(response, editing ? 'Cập nhật khuyến mãi thành công' : 'Thêm khuyến mãi thành công'));
      closeForm();
      if (isCreating && page !== 0) setPage(0);
      else load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Lưu khuyến mãi thất bại'));
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
      const response = await promotionApi.remove(deleteTarget.maKhuyenMai || deleteTarget.id);
      toast.success(messageOf(response, 'Đã tắt khuyến mãi'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(errorMessageOf(err, 'Tắt khuyến mãi thất bại'));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <section className="promotion-page">
      <div className="promotion-toolbar">
        <label className="promotion-search">
          <Search size={21} />
          <input
            value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setPage(0); }}
            placeholder="Tìm kiếm khuyến mãi..."
          />
        </label>

        <select
          className="promotion-status-filter"
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang áp dụng</option>
          <option value="UPCOMING">Sắp diễn ra</option>
          <option value="ENDED">Đã kết thúc</option>
          <option value="DISABLED">Tạm tắt</option>
        </select>

        <button className="promotion-add-btn" type="button" onClick={openCreateForm}>
          <Plus size={20} />
          Thêm khuyến mãi
        </button>
      </div>

      <div className="promotion-table-card">
        <table className="promotion-table">
          <thead>
            <tr>
              <th>Tên khuyến mãi</th>
              <th>Mã code</th>
              <th>Ưu đãi</th>
              <th>Điều kiện</th>
              <th>Lượt sử dụng</th>
              <th>Thời gian áp dụng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const status = getPromotionStatus(row);
              const minimum = Number(row.giaTriDonToiThieu || 0);
              const maximum = row.giamToiDa == null ? null : Number(row.giamToiDa);
              return (
                <tr key={row.maKhuyenMai || row.id || index}>
                  <td>
                    <div className="promotion-name-cell">
                      <strong>{row.tenKhuyenMai || 'Khuyến mãi chưa đặt tên'}</strong>
                      <span>{row.moTa || 'Chưa có mô tả khuyến mãi'}</span>
                    </div>
                  </td>
                  <td className="promotion-code">{row.maCode || row.code || '—'}</td>
                  <td>
                    <div className="promotion-benefit-cell">
                      <strong className="promotion-value">{valueLabel(row)}</strong>
                      <span>{typeLabel(promotionType(row))}</span>
                    </div>
                  </td>
                  <td>
                    <div className="promotion-condition-cell">
                      <span>Đơn từ {formatMoney(minimum)}</span>
                      <span>{maximum == null ? 'Không giới hạn mức giảm' : `Giảm tối đa ${formatMoney(maximum)}`}</span>
                    </div>
                  </td>
                  <td><span className="promotion-usage">{usageLabel(row)}</span></td>
                  <td className="promotion-period">
                    {formatDateOnly(row.ngayBatDau)} - {formatDateOnly(row.ngayKetThuc)}
                  </td>
                  <td>
                    <span className={`promotion-status ${status.className}`}>{status.label}</span>
                  </td>
                  <td>
                    <div className="promotion-actions">
                      <button type="button" title="Sửa khuyến mãi" onClick={() => openEditForm(row)}>
                        <Pencil size={18} />
                      </button>
                      <button
                        className="delete"
                        type="button"
                        title="Tắt khuyến mãi"
                        onClick={() => askRemove(row)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan="8" className="promotion-empty">Không tìm thấy khuyến mãi phù hợp</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="promotion-footer">
          <span>Hiển thị {displayRange.from} - {displayRange.to} trong tổng số {totalElements} khuyến mãi</span>
          <div className="promotion-pagination">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>‹</button>
            {pageItems.map((item) => (
              <button type="button" key={item} className={item === page ? 'current' : ''} onClick={() => setPage(item)}>{item + 1}</button>
            ))}
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={totalPages === 0 || page >= totalPages - 1}>›</button>
          </div>
          <select className="pagination-size-select" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
            <option value="10">10 / trang</option>
            <option value="20">20 / trang</option>
            <option value="50">50 / trang</option>
          </select>
        </div>
      </div>

      {openForm && (
        <div className="promotion-modal-backdrop" onMouseDown={closeForm}>
          <form className="promotion-modal promotion-modal-wide" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="promotion-modal-head">
              <div>
                <h3>{editing ? 'Cập nhật khuyến mãi' : 'Thêm khuyến mãi'}</h3>
                <p>{editing ? 'Chỉnh sửa thông tin chương trình ưu đãi' : 'Thiết lập đầy đủ điều kiện áp dụng chương trình ưu đãi'}</p>
              </div>
              <button type="button" onClick={closeForm}><X size={20} /></button>
            </div>

            {rulesLocked && (
              <div className="promotion-lock-note">
                Khuyến mãi đã được áp dụng cho đơn hàng. Mã và quy tắc giảm giá được khóa để bảo toàn dữ liệu hóa đơn.
              </div>
            )}

            <div className="promotion-modal-grid">
              <label>
                <span>Tên khuyến mãi</span>
                <input required maxLength="100" value={form.tenKhuyenMai} onChange={(event) => setForm({ ...form, tenKhuyenMai: event.target.value })} placeholder="Ví dụ: Giảm cuối tuần" />
              </label>

              <label>
                <span>Mã code</span>
                <input required maxLength="50" disabled={rulesLocked} value={form.maCode} onChange={(event) => setForm({ ...form, maCode: event.target.value.toUpperCase() })} placeholder="Ví dụ: WEEKEND10" />
              </label>

              <label>
                <span>Loại giảm</span>
                <select disabled={rulesLocked} value={form.loaiGiam} onChange={(event) => setForm({ ...form, loaiGiam: event.target.value })}>
                  <option value="PERCENT">Giảm theo phần trăm</option>
                  <option value="FIXED">Giảm theo số tiền</option>
                </select>
              </label>

              <label>
                <span>Giá trị giảm</span>
                <input required disabled={rulesLocked} min="0.01" step={form.loaiGiam === 'FIXED' ? '1000' : '0.01'} type="number" value={form.giaTriGiam} onChange={(event) => setForm({ ...form, giaTriGiam: event.target.value })} placeholder={form.loaiGiam === 'FIXED' ? 'Ví dụ: 50000' : 'Ví dụ: 10'} />
              </label>

              <label>
                <span>Giá trị đơn tối thiểu</span>
                <input disabled={rulesLocked} min="0" step="1000" type="number" value={form.giaTriDonToiThieu} onChange={(event) => setForm({ ...form, giaTriDonToiThieu: event.target.value })} placeholder="0 nếu không yêu cầu" />
              </label>

              <label>
                <span>Mức giảm tối đa</span>
                <input disabled={rulesLocked} min="0.01" step="1000" type="number" value={form.giamToiDa} onChange={(event) => setForm({ ...form, giamToiDa: event.target.value })} placeholder="Để trống nếu không giới hạn" />
              </label>

              <label>
                <span>Giới hạn sử dụng</span>
                <input min="1" step="1" type="number" value={form.gioiHanSuDung} onChange={(event) => setForm({ ...form, gioiHanSuDung: event.target.value })} placeholder="Để trống nếu không giới hạn" />
              </label>

              <label>
                <span>Đã sử dụng</span>
                <input value={form.soLuotDaDung || 0} disabled />
              </label>

              <label>
                <span>Ngày bắt đầu</span>
                <input required type="date" value={form.ngayBatDau} onChange={(event) => setForm({ ...form, ngayBatDau: event.target.value })} />
              </label>

              <label>
                <span>Ngày kết thúc</span>
                <input required type="date" value={form.ngayKetThuc} onChange={(event) => setForm({ ...form, ngayKetThuc: event.target.value })} />
              </label>

              <label className="full">
                <span>Mô tả</span>
                <textarea rows="3" maxLength="255" value={form.moTa} onChange={(event) => setForm({ ...form, moTa: event.target.value })} placeholder="Mô tả ngắn về chương trình khuyến mãi" />
              </label>

              <label className="full">
                <span>Trạng thái</span>
                <select value={String(form.trangThai)} onChange={(event) => setForm({ ...form, trangThai: event.target.value })}>
                  <option value="true">Kích hoạt</option>
                  <option value="false">Tạm tắt</option>
                </select>
              </label>
            </div>

            <div className="promotion-modal-actions">
              <button type="button" className="cancel" onClick={closeForm}>Hủy</button>
              <button type="submit" className="save">{editing ? 'Cập nhật' : 'Lưu khuyến mãi'}</button>
            </div>
          </form>
        </div>
      )}
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={confirmRemove}
        loading={deleteLoading}
        title="Xác nhận tắt khuyến mãi"
        description="Bạn có chắc chắn muốn tắt khuyến mãi này không?"
        itemName={deleteTarget?.tenKhuyenMai}
        warning="Khuyến mãi sẽ ngừng áp dụng cho đơn mới, nhưng các đơn đã áp dụng vẫn giữ nguyên số tiền giảm."
        confirmText="Tắt khuyến mãi"
      />

    </section>
  );
}
