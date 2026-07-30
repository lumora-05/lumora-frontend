import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Boxes,
  CalendarDays,
  CircleAlert,
  Clock3,
  ClipboardX,
  History,
  Layers3,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Recycle,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { inventoryApi } from '../../api/inventoryApi';
import { useDebounce } from '../../hooks/useDebounce';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { formatDate } from '../../utils/formatDate';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import FoodSafetyWorkspace from '../../components/inventory/FoodSafetyWorkspace';

const emptyIngredient = {
  tenNguyenLieu: '',
  donViTinh: 'kg',
  soLuongTon: '0',
  mucTonToiThieu: '0',
  giaNhap: '',
  moTa: '',
  trangThai: true,
};

const emptyAdjustment = {
  loaiGiaoDich: 'NHAP',
  soLuong: '',
  donGiaNhap: '',
  lyDo: '',
};

const emptyWaste = {
  batchId: '',
  soLuong: '',
  maLyDo: '',
  ghiChu: '',
};

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function createEmptyBatch() {
  return {
    ingredientId: '',
    soLo: '',
    ngayNhap: todayIso(),
    ngaySanXuat: '',
    hanSuDung: '',
    soLuongNhap: '',
    donGiaNhap: '',
    nhaCungCap: '',
    ghiChu: '',
    trangThai: true,
  };
}

function unwrapData(response, fallback = null) {
  return response?.data ?? response ?? fallback;
}

function unwrapList(response) {
  const value = unwrapData(response, []);
  return Array.isArray(value) ? value : [];
}

function quantity(value) {
  return Number(value || 0).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function dateOnly(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function stockStatus(row) {
  const currentUsableStock = usableStock(row);
  const code = row.trangThaiTonKho || (
    currentUsableStock <= 0
      ? 'HET_HANG'
      : currentUsableStock <= Number(row.mucTonToiThieu || 0)
        ? 'SAP_HET'
        : 'CON_HANG'
  );

  if (row.trangThai === false) return { code: 'NGUNG_SU_DUNG', label: 'Ngừng sử dụng', className: 'inactive' };
  if (code === 'HET_HANG') return { code, label: 'Hết hàng', className: 'out' };
  if (code === 'SAP_HET') return { code, label: 'Sắp hết', className: 'low' };
  return { code: 'CON_HANG', label: 'Còn hàng', className: 'available' };
}

function expiryStatus(row) {
  if (row.trangThai === false) return { label: 'Ngừng sử dụng', className: 'inactive', note: '' };
  switch (row.trangThaiHanSuDung) {
    case 'HET_HAN':
      return { label: 'Đã hết hạn', className: 'expired', note: row.soNgayConLai == null ? '' : `Quá hạn ${Math.abs(Number(row.soNgayConLai))} ngày` };
    case 'SAP_HET_HAN':
      return { label: 'Sắp hết hạn', className: 'expiring', note: row.soNgayConLai == null ? '' : `Còn ${Number(row.soNgayConLai)} ngày` };
    case 'DA_DUNG_HET':
      return { label: 'Đã dùng hết', className: 'used', note: '' };
    case 'KHONG_THEO_DOI':
      return { label: 'Không theo dõi', className: 'untracked', note: '' };
    default:
      return { label: 'Còn hạn', className: 'valid', note: row.soNgayConLai == null ? '' : `Còn ${Number(row.soNgayConLai)} ngày` };
  }
}

function safetyStatus(row) {
  switch (String(row?.trangThaiAnToan || 'AN_TOAN').toUpperCase()) {
    case 'KHOA_TAM_THOI':
      return { label: 'Khóa tạm thời', className: 'locked' };
    case 'CO_SU_CO':
      return { label: 'Có sự cố', className: 'incident' };
    case 'THU_HOI':
      return { label: 'Đang thu hồi', className: 'recalled' };
    case 'DA_TIEU_HUY':
      return { label: 'Đã tiêu hủy', className: 'disposed' };
    default:
      return { label: 'An toàn', className: 'safe' };
  }
}

function transactionMeta(type) {
  if (type === 'XUAT') return { label: 'Xuất kho', className: 'export', Icon: ArrowUp };
  if (type === 'DIEU_CHINH') return { label: 'Điều chỉnh', className: 'adjust', Icon: RefreshCcw };
  if (type === 'TIEU_HUY') return { label: 'Tiêu hủy', className: 'waste', Icon: Recycle };
  return { label: 'Nhập kho', className: 'import', Icon: ArrowDown };
}

function physicalStock(row) {
  return Number(row?.soLuongTonVatLy ?? row?.soLuongTon ?? 0);
}

function usableStock(row) {
  return Number(row?.soLuongKhaDung ?? row?.soLuongTon ?? 0);
}

function pendingDisposal(row) {
  return Number(row?.soLuongChoTieuHuy ?? 0);
}

function StatCard({ icon: Icon, label, value, note, tone }) {
  return (
    <div className={`inventory-stat-card ${tone}`}>
      <span className="inventory-stat-icon"><Icon size={23} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function BatchStat({ icon: Icon, label, value, note, tone }) {
  return (
    <div className={`inventory-batch-stat ${tone}`}>
      <span><Icon size={19} /></span>
      <div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
    </div>
  );
}

function Pagination({ page, totalPages, size, numberOfElements, totalElements, onPage, onSize, noun }) {
  const items = paginationItems(page, totalPages);
  const range = pageDisplayRange(page, size, numberOfElements, totalElements);

  return (
    <div className="inventory-table-footer">
      <span>Hiển thị {range.from} - {range.to} trong tổng số {totalElements} {noun}</span>
      <div className="inventory-pagination">
        <button type="button" disabled={page === 0} onClick={() => onPage(Math.max(0, page - 1))}>‹</button>
        {items.map((item) => (
          <button type="button" key={item} className={item === page ? 'current' : ''} onClick={() => onPage(item)}>
            {item + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={totalPages === 0 || page >= totalPages - 1}
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
        >
          ›
        </button>
      </div>
      <select value={size} onChange={(event) => onSize(Number(event.target.value))}>
        <option value="10">10 / trang</option>
        <option value="20">20 / trang</option>
        <option value="50">50 / trang</option>
      </select>
    </div>
  );
}

export default function InventoryManage() {
  const toast = useToast();
  const [tab, setTab] = useState('ingredients');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [traceBatchId, setTraceBatchId] = useState(null);

  const [rows, setRows] = useState([]);
  const [statistics, setStatistics] = useState({
    tongNguyenLieu: 0,
    dangHoatDong: 0,
    sapHet: 0,
    hetHang: 0,
    tongGiaTriTonKho: 0,
    tongGiaTriTonKhaDung: 0,
    tongGiaTriChoTieuHuy: 0,
    soNguyenLieuCoHangChoTieuHuy: 0,
    soLoChoTieuHuy: 0,
  });
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('true');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const debouncedKeyword = useDebounce(keyword, 350);

  const [ingredientModal, setIngredientModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyIngredient);

  const [stockModal, setStockModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [adjustment, setAdjustment] = useState(emptyAdjustment);

  const [batchRows, setBatchRows] = useState([]);
  const [batchStatistics, setBatchStatistics] = useState({
    tongSoLo: 0,
    loDangSuDung: 0,
    loSapHetHan: 0,
    loDaHetHan: 0,
    loDaDungHet: 0,
    loKhongTheoDoiHan: 0,
    giaTriLoDaHetHan: 0,
  });
  const [batchKeyword, setBatchKeyword] = useState('');
  const [batchIngredient, setBatchIngredient] = useState('ALL');
  const [batchActive, setBatchActive] = useState('true');
  const [batchExpiry, setBatchExpiry] = useState('ALL');
  const [batchFrom, setBatchFrom] = useState('');
  const [batchTo, setBatchTo] = useState('');
  const [warningDays, setWarningDays] = useState(3);
  const [batchPage, setBatchPage] = useState(0);
  const [batchSize, setBatchSize] = useState(10);
  const [batchTotalElements, setBatchTotalElements] = useState(0);
  const [batchTotalPages, setBatchTotalPages] = useState(0);
  const [batchNumberOfElements, setBatchNumberOfElements] = useState(0);
  const debouncedBatchKeyword = useDebounce(batchKeyword, 350);
  const [batchModal, setBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState(createEmptyBatch);

  const [transactions, setTransactions] = useState([]);
  const [transactionPage, setTransactionPage] = useState(0);
  const [transactionSize, setTransactionSize] = useState(10);
  const [transactionTotalElements, setTransactionTotalElements] = useState(0);
  const [transactionTotalPages, setTransactionTotalPages] = useState(0);
  const [transactionNumberOfElements, setTransactionNumberOfElements] = useState(0);
  const [transactionType, setTransactionType] = useState('ALL');
  const [transactionIngredient, setTransactionIngredient] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [wasteReasons, setWasteReasons] = useState([]);
  const [wasteModal, setWasteModal] = useState(false);
  const [wasteIngredient, setWasteIngredient] = useState(null);
  const [wasteFixedBatch, setWasteFixedBatch] = useState(null);
  const [wasteBatchOptions, setWasteBatchOptions] = useState([]);
  const [wasteOptionsLoading, setWasteOptionsLoading] = useState(false);
  const [wasteForm, setWasteForm] = useState(emptyWaste);
  const [wasteStatistics, setWasteStatistics] = useState({
    soLanTieuHuy: 0,
    soNguyenLieuAnhHuong: 0,
    soLoAnhHuong: 0,
    tongGiaTriTieuHuy: 0,
    theoLyDo: [],
  });
  const [wasteTransactions, setWasteTransactions] = useState([]);
  const [wastePage, setWastePage] = useState(0);
  const [wasteSize, setWasteSize] = useState(10);
  const [wasteTotalElements, setWasteTotalElements] = useState(0);
  const [wasteTotalPages, setWasteTotalPages] = useState(0);
  const [wasteNumberOfElements, setWasteNumberOfElements] = useState(0);
  const [wasteIngredientFilter, setWasteIngredientFilter] = useState('ALL');
  const [wasteFrom, setWasteFrom] = useState('');
  const [wasteTo, setWasteTo] = useState('');

  async function loadStatistics() {
    try {
      const response = await inventoryApi.getStatistics();
      setStatistics((current) => ({ ...current, ...(unwrapData(response, {}) || {}) }));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải thống kê kho nguyên liệu'));
    }
  }

  async function loadIngredientOptions() {
    try {
      const response = await inventoryApi.getAll();
      setIngredientOptions(unwrapList(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách nguyên liệu'));
    }
  }

  async function loadIngredients() {
    setLoading(true);
    try {
      const response = await inventoryApi.getPage({
        page,
        size,
        keyword: debouncedKeyword.trim() || undefined,
        active: activeFilter === 'ALL' ? undefined : activeFilter === 'true',
        stockStatus: stockFilter === 'ALL' ? undefined : stockFilter,
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
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải kho nguyên liệu'));
    } finally {
      setLoading(false);
    }
  }

  async function loadBatchStatistics() {
    try {
      const response = await inventoryApi.getBatchStatistics({ warningDays });
      setBatchStatistics((current) => ({ ...current, ...(unwrapData(response, {}) || {}) }));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải thống kê hạn sử dụng'));
    }
  }

  async function loadBatches() {
    setLoading(true);
    try {
      const response = await inventoryApi.getBatchPage({
        page: batchPage,
        size: batchSize,
        keyword: debouncedBatchKeyword.trim() || undefined,
        ingredientId: batchIngredient === 'ALL' ? undefined : Number(batchIngredient),
        active: batchActive === 'ALL' ? undefined : batchActive === 'true',
        expiryStatus: batchExpiry === 'ALL' ? undefined : batchExpiry,
        from: batchFrom || undefined,
        to: batchTo || undefined,
        warningDays,
      });
      const result = normalizePage(response, batchSize);
      if (result.totalPages > 0 && batchPage >= result.totalPages) {
        setBatchPage(result.totalPages - 1);
        return;
      }
      setBatchRows(result.content);
      setBatchTotalElements(result.totalElements);
      setBatchTotalPages(result.totalPages);
      setBatchNumberOfElements(result.numberOfElements);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách lô nguyên liệu'));
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions() {
    setLoading(true);
    try {
      const response = await inventoryApi.getTransactions({
        page: transactionPage,
        size: transactionSize,
        ingredientId: transactionIngredient === 'ALL' ? undefined : Number(transactionIngredient),
        type: transactionType === 'ALL' ? undefined : transactionType,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      const result = normalizePage(response, transactionSize);
      if (result.totalPages > 0 && transactionPage >= result.totalPages) {
        setTransactionPage(result.totalPages - 1);
        return;
      }
      setTransactions(result.content);
      setTransactionTotalElements(result.totalElements);
      setTransactionTotalPages(result.totalPages);
      setTransactionNumberOfElements(result.numberOfElements);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải lịch sử nhập xuất kho'));
    } finally {
      setLoading(false);
    }
  }

  async function loadWasteReasons() {
    try {
      const response = await inventoryApi.getWasteReasons();
      setWasteReasons(unwrapList(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách lý do tiêu hủy'));
    }
  }

  async function loadWasteData() {
    setLoading(true);
    try {
      const [statisticsResponse, transactionsResponse] = await Promise.all([
        inventoryApi.getWasteStatistics({
          from: wasteFrom || undefined,
          to: wasteTo || undefined,
        }),
        inventoryApi.getTransactions({
          page: wastePage,
          size: wasteSize,
          ingredientId: wasteIngredientFilter === 'ALL' ? undefined : Number(wasteIngredientFilter),
          type: 'TIEU_HUY',
          from: wasteFrom || undefined,
          to: wasteTo || undefined,
        }),
      ]);
      setWasteStatistics((current) => ({ ...current, ...(unwrapData(statisticsResponse, {}) || {}) }));
      const result = normalizePage(transactionsResponse, wasteSize);
      if (result.totalPages > 0 && wastePage >= result.totalPages) {
        setWastePage(result.totalPages - 1);
        return;
      }
      setWasteTransactions(result.content);
      setWasteTotalElements(result.totalElements);
      setWasteTotalPages(result.totalPages);
      setWasteNumberOfElements(result.numberOfElements);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải thống kê tiêu hủy và hao hụt'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatistics();
    loadIngredientOptions();
    loadWasteReasons();
  }, []);

  useEffect(() => {
    if (tab === 'ingredients') loadIngredients();
  }, [tab, page, size, debouncedKeyword, stockFilter, activeFilter]);

  useEffect(() => {
    if (tab === 'batches') {
      loadBatches();
      loadBatchStatistics();
    }
  }, [tab, batchPage, batchSize, debouncedBatchKeyword, batchIngredient, batchActive, batchExpiry, batchFrom, batchTo, warningDays]);

  useEffect(() => {
    if (tab === 'history') loadTransactions();
  }, [tab, transactionPage, transactionSize, transactionType, transactionIngredient, fromDate, toDate]);

  useEffect(() => {
    if (tab === 'waste') loadWasteData();
  }, [tab, wastePage, wasteSize, wasteIngredientFilter, wasteFrom, wasteTo]);

  const totalInventoryValue = useMemo(
    () => formatMoney(statistics.tongGiaTriTonKho || 0),
    [statistics.tongGiaTriTonKho],
  );
  const usableInventoryValue = useMemo(
    () => formatMoney(statistics.tongGiaTriTonKhaDung ?? statistics.tongGiaTriTonKho ?? 0),
    [statistics.tongGiaTriTonKhaDung, statistics.tongGiaTriTonKho],
  );
  const pendingDisposalValue = useMemo(
    () => formatMoney(statistics.tongGiaTriChoTieuHuy || 0),
    [statistics.tongGiaTriChoTieuHuy],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyIngredient);
    setIngredientModal(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      tenNguyenLieu: row.tenNguyenLieu || '',
      donViTinh: row.donViTinh || 'kg',
      soLuongTon: String(row.soLuongTon ?? 0),
      mucTonToiThieu: String(row.mucTonToiThieu ?? 0),
      giaNhap: row.giaNhap == null ? '' : String(row.giaNhap),
      moTa: row.moTa || '',
      trangThai: row.trangThai !== false,
    });
    setIngredientModal(true);
  }

  function closeIngredientModal() {
    if (saving) return;
    setIngredientModal(false);
    setEditing(null);
    setForm(emptyIngredient);
  }

  async function saveIngredient(event) {
    event.preventDefault();
    if (!form.tenNguyenLieu.trim()) {
      toast.error('Vui lòng nhập tên nguyên liệu');
      return;
    }
    if (!form.donViTinh.trim()) {
      toast.error('Vui lòng nhập đơn vị tính');
      return;
    }

    const minimum = Number(form.mucTonToiThieu || 0);
    const initialStock = Number(form.soLuongTon || 0);
    const price = form.giaNhap === '' ? null : Number(form.giaNhap);
    if (minimum < 0 || initialStock < 0 || (price != null && price < 0)) {
      toast.error('Số lượng và giá nhập không được âm');
      return;
    }

    const payload = {
      tenNguyenLieu: form.tenNguyenLieu.trim(),
      donViTinh: form.donViTinh.trim(),
      soLuongTon: editing ? null : initialStock,
      mucTonToiThieu: minimum,
      giaNhap: price,
      moTa: form.moTa.trim() || null,
      trangThai: Boolean(form.trangThai),
    };

    setSaving(true);
    try {
      const response = editing
        ? await inventoryApi.update(editing.maNguyenLieu, payload)
        : await inventoryApi.create(payload);
      toast.success(messageOf(response, editing ? 'Cập nhật nguyên liệu thành công' : 'Thêm nguyên liệu thành công'));
      setIngredientModal(false);
      setEditing(null);
      setForm(emptyIngredient);
      if (!editing && page !== 0) setPage(0);
      else await loadIngredients();
      await Promise.all([loadStatistics(), loadIngredientOptions()]);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Lưu nguyên liệu thất bại'));
    } finally {
      setSaving(false);
    }
  }

  function openStock(row, type = 'NHAP', batch = null) {
    setSelectedIngredient(row);
    setSelectedBatch(batch);
    setAdjustment({
      ...emptyAdjustment,
      loaiGiaoDich: batch ? 'DIEU_CHINH' : type,
      donGiaNhap: type === 'NHAP' && row.giaNhap != null ? String(row.giaNhap) : '',
      soLuong: batch ? String(batch.soLuongConLai ?? 0) : '',
    });
    setStockModal(true);
  }

  function closeStockModal() {
    if (saving) return;
    setStockModal(false);
    setSelectedIngredient(null);
    setSelectedBatch(null);
    setAdjustment(emptyAdjustment);
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    const amount = Number(adjustment.soLuong);
    if (!Number.isFinite(amount) || amount < 0 || (adjustment.loaiGiaoDich !== 'DIEU_CHINH' && amount <= 0)) {
      toast.error(adjustment.loaiGiaoDich === 'DIEU_CHINH'
        ? 'Số tồn sau kiểm kho phải từ 0 trở lên'
        : 'Số lượng nhập hoặc xuất phải lớn hơn 0');
      return;
    }

    const available = Number(selectedBatch
      ? (selectedBatch.soLuongKhaDung ?? selectedBatch.soLuongConLai ?? 0)
      : (selectedIngredient?.soLuongKhaDung ?? selectedIngredient?.soLuongTon ?? 0));
    if (adjustment.loaiGiaoDich === 'XUAT' && amount > available) {
      toast.error('Số lượng xuất không được vượt quá số lượng đang tồn');
      return;
    }

    const unitPrice = adjustment.donGiaNhap === '' ? null : Number(adjustment.donGiaNhap);
    if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      toast.error('Đơn giá nhập không hợp lệ');
      return;
    }

    setSaving(true);
    try {
      const response = await inventoryApi.adjustStock(selectedIngredient.maNguyenLieu, {
        loaiGiaoDich: adjustment.loaiGiaoDich,
        soLuong: amount,
        maLo: selectedBatch?.maLo || null,
        donGiaNhap: adjustment.loaiGiaoDich === 'NHAP' ? unitPrice : null,
        lyDo: adjustment.lyDo.trim() || null,
      });
      toast.success(messageOf(response, 'Cập nhật tồn kho thành công'));
      setStockModal(false);
      setSelectedIngredient(null);
      setSelectedBatch(null);
      setAdjustment(emptyAdjustment);
      await Promise.all([loadStatistics(), loadIngredientOptions()]);
      if (tab === 'ingredients') await loadIngredients();
      if (tab === 'batches') await Promise.all([loadBatches(), loadBatchStatistics()]);
      if (tab === 'history') await loadTransactions();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Cập nhật tồn kho thất bại'));
    } finally {
      setSaving(false);
    }
  }

  async function openWaste(row, batch = null) {
    setWasteIngredient(row);
    setWasteFixedBatch(batch);
    setWasteBatchOptions(batch ? [batch] : []);
    setWasteForm({
      ...emptyWaste,
      batchId: batch ? String(batch.maLo) : '',
      soLuong: batch ? String(batch.soLuongChoTieuHuy ?? batch.soLuongConLai ?? '') : '',
      maLyDo: batch?.trangThaiHanSuDung === 'HET_HAN' ? 'QUA_HAN_SU_DUNG' : '',
    });
    setWasteModal(true);

    if (!batch) {
      setWasteOptionsLoading(true);
      try {
        const response = await inventoryApi.getBatchesByIngredient(row.maNguyenLieu, { warningDays });
        setWasteBatchOptions(unwrapList(response).filter((item) => Number(item.soLuongConLai || 0) > 0));
      } catch (error) {
        toast.error(errorMessageOf(error, 'Không thể tải danh sách lô để ghi nhận hao hụt'));
      } finally {
        setWasteOptionsLoading(false);
      }
    } else {
      setWasteOptionsLoading(false);
    }
  }

  function closeWasteModal() {
    if (saving) return;
    setWasteModal(false);
    setWasteIngredient(null);
    setWasteFixedBatch(null);
    setWasteBatchOptions([]);
    setWasteOptionsLoading(false);
    setWasteForm(emptyWaste);
  }

  async function saveWaste(event) {
    event.preventDefault();
    const amount = Number(wasteForm.soLuong);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Số lượng tiêu hủy phải lớn hơn 0');
      return;
    }
    if (!wasteForm.maLyDo) {
      toast.error('Vui lòng chọn lý do tiêu hủy');
      return;
    }
    const reason = wasteReasons.find((item) => item.maLyDo === wasteForm.maLyDo);
    if (reason?.batBuocGhiChu && !wasteForm.ghiChu.trim()) {
      toast.error('Vui lòng nhập ghi chú khi chọn lý do khác');
      return;
    }
    if (amount > wasteMaximumQuantity) {
      toast.error(`Số lượng tiêu hủy không được vượt quá ${quantity(wasteMaximumQuantity)} ${wasteIngredient?.donViTinh || ''}`);
      return;
    }

    const payload = {
      soLuong: amount,
      maLyDo: wasteForm.maLyDo,
      ghiChu: wasteForm.ghiChu.trim() || null,
      maLo: wasteChosenBatch?.maLo || null,
    };

    setSaving(true);
    try {
      const response = wasteFixedBatch
        ? await inventoryApi.disposeBatch(wasteFixedBatch.maLo, payload, { warningDays })
        : await inventoryApi.recordWaste(wasteIngredient.maNguyenLieu, payload, { warningDays });
      toast.success(messageOf(response, wasteChosenBatch ? 'Tiêu hủy lô nguyên liệu thành công' : 'Ghi nhận hao hụt thành công'));
      setWasteModal(false);
      setWasteIngredient(null);
      setWasteFixedBatch(null);
      setWasteBatchOptions([]);
      setWasteOptionsLoading(false);
      setWasteForm(emptyWaste);
      await Promise.all([loadStatistics(), loadIngredientOptions()]);
      if (tab === 'ingredients') await loadIngredients();
      if (tab === 'batches') await Promise.all([loadBatches(), loadBatchStatistics()]);
      if (tab === 'history') await loadTransactions();
      if (tab === 'waste') await loadWasteData();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Ghi nhận tiêu hủy thất bại'));
    } finally {
      setSaving(false);
    }
  }

  function deactivate(row) {
    setConfirmDialog({ type: 'ingredient', row });
  }

  function closeConfirmDialog() {
    if (confirmLoading) return;
    setConfirmDialog(null);
  }

  async function confirmDeactivate() {
    if (!confirmDialog?.row) return;
    setConfirmLoading(true);
    try {
      if (confirmDialog.type === 'batch') {
        const response = await inventoryApi.removeBatch(confirmDialog.row.maLo, { warningDays });
        toast.success(messageOf(response, 'Đã ngừng sử dụng lô nguyên liệu'));
        await Promise.all([loadBatches(), loadBatchStatistics()]);
      } else {
        const response = await inventoryApi.remove(confirmDialog.row.maNguyenLieu);
        toast.success(messageOf(response, 'Đã ngừng sử dụng nguyên liệu'));
        await Promise.all([loadIngredients(), loadStatistics(), loadIngredientOptions()]);
      }
      setConfirmDialog(null);
    } catch (error) {
      toast.error(errorMessageOf(error, confirmDialog?.type === 'batch' ? 'Không thể ngừng sử dụng lô nguyên liệu' : 'Không thể ngừng sử dụng nguyên liệu'));
    } finally {
      setConfirmLoading(false);
    }
  }

  function viewIngredientBatches(row) {
    setBatchIngredient(String(row.maNguyenLieu));
    setBatchKeyword('');
    setBatchPage(0);
    setTab('batches');
  }

  function openCreateBatch(ingredientId = '') {
    const matched = ingredientOptions.find((item) => String(item.maNguyenLieu) === String(ingredientId));
    setEditingBatch(null);
    setBatchForm({
      ...createEmptyBatch(),
      ingredientId: ingredientId ? String(ingredientId) : '',
      donGiaNhap: matched?.giaNhap == null ? '' : String(matched.giaNhap),
    });
    setBatchModal(true);
  }

  function openEditBatch(row) {
    setEditingBatch(row);
    setBatchForm({
      ingredientId: String(row.maNguyenLieu),
      soLo: row.soLo || '',
      ngayNhap: row.ngayNhap || '',
      ngaySanXuat: row.ngaySanXuat || '',
      hanSuDung: row.hanSuDung || '',
      soLuongNhap: String(row.soLuongBanDau ?? ''),
      donGiaNhap: row.donGiaNhap == null ? '' : String(row.donGiaNhap),
      nhaCungCap: row.nhaCungCap || '',
      ghiChu: '',
      trangThai: row.trangThai !== false,
    });
    setBatchModal(true);
  }

  function closeBatchModal() {
    if (saving) return;
    setBatchModal(false);
    setEditingBatch(null);
    setBatchForm(createEmptyBatch());
  }

  async function saveBatch(event) {
    event.preventDefault();
    if (!batchForm.ingredientId) {
      toast.error('Vui lòng chọn nguyên liệu');
      return;
    }
    if (!batchForm.soLo.trim()) {
      toast.error('Vui lòng nhập số lô');
      return;
    }
    if (!batchForm.ngayNhap) {
      toast.error('Vui lòng chọn ngày nhập');
      return;
    }
    if (batchForm.ngaySanXuat && batchForm.ngaySanXuat > batchForm.ngayNhap) {
      toast.error('Ngày sản xuất không được sau ngày nhập');
      return;
    }
    if (batchForm.hanSuDung && batchForm.hanSuDung < batchForm.ngayNhap) {
      toast.error('Hạn sử dụng không được trước ngày nhập');
      return;
    }

    const price = batchForm.donGiaNhap === '' ? null : Number(batchForm.donGiaNhap);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      toast.error('Đơn giá nhập không hợp lệ');
      return;
    }

    if (!editingBatch) {
      const amount = Number(batchForm.soLuongNhap);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Số lượng nhập phải lớn hơn 0');
        return;
      }
    }

    setSaving(true);
    try {
      let response;
      if (editingBatch) {
        response = await inventoryApi.updateBatch(editingBatch.maLo, {
          soLo: batchForm.soLo.trim(),
          ngayNhap: batchForm.ngayNhap || null,
          ngaySanXuat: batchForm.ngaySanXuat || null,
          hanSuDung: batchForm.hanSuDung || null,
          donGiaNhap: price,
          nhaCungCap: batchForm.nhaCungCap.trim() || null,
          trangThai: Boolean(batchForm.trangThai),
        }, { warningDays });
      } else {
        response = await inventoryApi.createBatch(Number(batchForm.ingredientId), {
          soLo: batchForm.soLo.trim(),
          ngayNhap: batchForm.ngayNhap || null,
          ngaySanXuat: batchForm.ngaySanXuat || null,
          hanSuDung: batchForm.hanSuDung || null,
          soLuongNhap: Number(batchForm.soLuongNhap),
          donGiaNhap: price,
          nhaCungCap: batchForm.nhaCungCap.trim() || null,
          ghiChu: batchForm.ghiChu.trim() || null,
        }, { warningDays });
      }
      toast.success(messageOf(response, editingBatch ? 'Cập nhật lô thành công' : 'Nhập lô nguyên liệu thành công'));
      setBatchModal(false);
      setEditingBatch(null);
      setBatchForm(createEmptyBatch());
      if (!editingBatch && batchPage !== 0) setBatchPage(0);
      else await loadBatches();
      await Promise.all([loadBatchStatistics(), loadStatistics(), loadIngredientOptions()]);
    } catch (error) {
      toast.error(errorMessageOf(error, editingBatch ? 'Cập nhật lô thất bại' : 'Nhập lô thất bại'));
    } finally {
      setSaving(false);
    }
  }

  function deactivateBatch(row) {
    if (Number(row.soLuongConLai || 0) > 0) {
      toast.error('Chỉ được ngừng sử dụng lô khi số lượng còn lại bằng 0');
      return;
    }
    setConfirmDialog({ type: 'batch', row });
  }

  function batchIngredientObject(row) {
    return ingredientOptions.find((item) => item.maNguyenLieu === row.maNguyenLieu) || {
      maNguyenLieu: row.maNguyenLieu,
      tenNguyenLieu: row.tenNguyenLieu,
      donViTinh: row.donViTinh,
      soLuongTon: row.soLuongConLai,
      giaNhap: row.donGiaNhap,
      trangThai: true,
    };
  }

  const wasteChosenBatch = wasteFixedBatch || wasteBatchOptions.find(
    (item) => String(item.maLo) === String(wasteForm.batchId),
  ) || null;
  const trackedWasteQuantity = wasteBatchOptions.reduce(
    (total, item) => total + Number(item.soLuongConLai || 0),
    0,
  );
  const wasteUntrackedQuantity = Math.max(0, physicalStock(wasteIngredient) - trackedWasteQuantity);
  const wasteMaximumQuantity = wasteChosenBatch
    ? Number(wasteChosenBatch.soLuongConLai || 0)
    : wasteUntrackedQuantity;
  const wasteUnitPrice = Number(wasteChosenBatch?.donGiaNhap ?? wasteIngredient?.giaNhap ?? 0);
  const wastePreviewValue = Number(wasteForm.soLuong || 0) * wasteUnitPrice;
  const wasteBatchIsExpired = wasteChosenBatch?.trangThaiHanSuDung === 'HET_HAN';
  const availableWasteReasons = wasteReasons.filter((item) => (
    !item.chiDungChoLoHetHan || wasteBatchIsExpired
  ));

  const selectedStockAmount = Number(selectedBatch ? selectedBatch.soLuongConLai : selectedIngredient?.soLuongTon || 0);
  const previewStock = adjustment.loaiGiaoDich === 'NHAP'
    ? selectedStockAmount + Number(adjustment.soLuong || 0)
    : adjustment.loaiGiaoDich === 'XUAT'
      ? Math.max(0, selectedStockAmount - Number(adjustment.soLuong || 0))
      : Number(adjustment.soLuong || 0);

  const confirmTitle = confirmDialog?.type === 'batch' ? 'Xác nhận ngừng sử dụng lô' : 'Xác nhận ngừng sử dụng nguyên liệu';
  const confirmDescription = confirmDialog?.type === 'batch'
    ? 'Bạn có chắc chắn muốn ngừng sử dụng lô nguyên liệu này không?'
    : 'Bạn có chắc chắn muốn ngừng sử dụng nguyên liệu này không?';
  const confirmName = confirmDialog?.type === 'batch' ? confirmDialog?.row?.soLo : confirmDialog?.row?.tenNguyenLieu;
  const confirmWarning = confirmDialog?.type === 'batch'
    ? 'Lô nguyên liệu sẽ bị ngừng sử dụng trong kho. Lịch sử nhập xuất và thông tin hạn sử dụng vẫn được giữ lại.'
    : 'Nguyên liệu sẽ bị ngừng sử dụng trong kho. Lịch sử nhập xuất vẫn được giữ lại để đối soát.';
  const confirmButtonText = confirmDialog?.type === 'batch' ? 'Ngừng sử dụng lô' : 'Ngừng sử dụng';

  return (
    <section className="inventory-page">
      <div className="inventory-stat-grid">
        <StatCard icon={Boxes} label="Tổng nguyên liệu" value={statistics.tongNguyenLieu || 0} note={`${statistics.dangHoatDong || 0} đang sử dụng`} tone="orange" />
        <StatCard
          icon={PackageCheck}
          label="Còn hàng"
          value={Math.max(0, Number(statistics.dangHoatDong || 0) - Number(statistics.sapHet || 0) - Number(statistics.hetHang || 0))}
          note="Tính theo tồn khả dụng"
          tone="green"
        />
        <StatCard icon={AlertTriangle} label="Sắp hết" value={statistics.sapHet || 0} note="Cần lên kế hoạch nhập thêm" tone="yellow" />
        <StatCard icon={Package} label="Hết hàng" value={statistics.hetHang || 0} note="Tồn khả dụng đã hết" tone="red" />
        <StatCard icon={WalletCards} label="Tồn vật lý" value={totalInventoryValue} note="Bao gồm hàng chờ tiêu hủy" tone="blue" />
        <StatCard icon={PackageCheck} label="Tồn khả dụng" value={usableInventoryValue} note="Được phép xuất và chế biến" tone="teal" />
        <StatCard
          icon={Recycle}
          label="Chờ tiêu hủy"
          value={pendingDisposalValue}
          note={`${statistics.soLoChoTieuHuy || 0} lô · ${statistics.soNguyenLieuCoHangChoTieuHuy || 0} nguyên liệu`}
          tone="purple"
        />
      </div>

      <div className="inventory-tabs">
        <button type="button" className={tab === 'ingredients' ? 'active' : ''} onClick={() => setTab('ingredients')}>
          <Boxes size={18} /> Danh sách nguyên liệu
        </button>
        <button type="button" className={tab === 'batches' ? 'active' : ''} onClick={() => setTab('batches')}>
          <Layers3 size={18} /> Lô & hạn sử dụng
        </button>
        <button type="button" className={tab === 'waste' ? 'active' : ''} onClick={() => setTab('waste')}>
          <Recycle size={18} /> Tiêu hủy & hao hụt
        </button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          <History size={18} /> Lịch sử nhập xuất
        </button>
        <button type="button" className={tab === 'traceability' ? 'active' : ''} onClick={() => setTab('traceability')}>
          <ShieldAlert size={18} /> Truy xuất & sự cố
        </button>
      </div>

      {tab === 'ingredients' && (
        <>
          <div className="inventory-toolbar">
            <label className="inventory-search">
              <Search size={20} />
              <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(0); }} placeholder="Tìm theo tên, đơn vị hoặc mô tả..." />
            </label>
            <select value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(0); }}>
              <option value="ALL">Tất cả mức tồn</option>
              <option value="CON_HANG">Còn hàng</option>
              <option value="SAP_HET">Sắp hết</option>
              <option value="HET_HANG">Hết hàng</option>
            </select>
            <select value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(0); }}>
              <option value="true">Đang sử dụng</option>
              <option value="false">Ngừng sử dụng</option>
              <option value="ALL">Tất cả trạng thái</option>
            </select>
            <button type="button" className="inventory-add-btn" onClick={openCreate}><Plus size={20} /> Thêm nguyên liệu</button>
          </div>

          <div className="inventory-table-card">
            <div className="inventory-table-scroll">
              <table className="inventory-table inventory-ingredient-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th><th>Đơn vị</th><th>Tồn vật lý</th><th>Tồn khả dụng</th><th>Chờ tiêu hủy</th><th>Mức tối thiểu</th><th>Giá nhập</th><th>Giá trị khả dụng</th><th>Trạng thái</th><th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="10" className="inventory-empty">Đang tải dữ liệu...</td></tr>
                  ) : rows.length ? rows.map((row) => {
                    const status = stockStatus(row);
                    const inventoryValue = Number(row.giaTriTonKhaDung ?? usableStock(row) * Number(row.giaNhap || 0));
                    return (
                      <tr key={row.maNguyenLieu}>
                        <td><div className="inventory-name-cell"><span><Package size={19} /></span><div><strong>{row.tenNguyenLieu}</strong><small>{row.moTa || 'Chưa có mô tả'}</small></div></div></td>
                        <td><span className="inventory-unit">{row.donViTinh}</span></td>
                        <td><strong className="inventory-quantity">{quantity(physicalStock(row))}</strong></td>
                        <td><strong className={`inventory-quantity ${status.className}`}>{quantity(usableStock(row))}</strong></td>
                        <td>
                          {pendingDisposal(row) > 0
                            ? <span className="inventory-pending-waste">{quantity(pendingDisposal(row))}</span>
                            : <span className="inventory-zero-waste">0</span>}
                        </td>
                        <td>{quantity(row.mucTonToiThieu)}</td>
                        <td>{row.giaNhap == null ? '—' : formatMoney(row.giaNhap)}</td>
                        <td><strong>{formatMoney(inventoryValue)}</strong></td>
                        <td><span className={`inventory-status ${status.className}`}>{status.label}</span></td>
                        <td>
                          <div className="inventory-actions">
                            <button type="button" title="Cập nhật tồn kho" onClick={() => openStock(row)} disabled={row.trangThai === false}><RefreshCcw size={17} /></button>
                            <button type="button" title="Ghi nhận tiêu hủy hoặc hao hụt" className="waste" onClick={() => openWaste(row)} disabled={physicalStock(row) <= 0}><Recycle size={17} /></button>
                            <button type="button" title="Xem lô và hạn sử dụng" onClick={() => viewIngredientBatches(row)}><Layers3 size={17} /></button>
                            <button type="button" title="Sửa nguyên liệu" onClick={() => openEdit(row)}><Pencil size={17} /></button>
                            <button type="button" title="Ngừng sử dụng" className="danger" onClick={() => deactivate(row)} disabled={row.trangThai === false}><Trash2 size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="10" className="inventory-empty">Không tìm thấy nguyên liệu phù hợp</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} size={size} numberOfElements={numberOfElements} totalElements={totalElements} onPage={setPage} onSize={(nextSize) => { setSize(nextSize); setPage(0); }} noun="nguyên liệu" />
          </div>
        </>
      )}

      {tab === 'batches' && (
        <>
          <div className="inventory-batch-summary">
            <BatchStat icon={Layers3} label="Tổng số lô" value={batchStatistics.tongSoLo || 0} note={`${batchStatistics.loDangSuDung || 0} lô đang sử dụng`} tone="neutral" />
            <BatchStat icon={Clock3} label="Sắp hết hạn" value={batchStatistics.loSapHetHan || 0} note={`Trong ${warningDays} ngày tới`} tone="warning" />
            <BatchStat icon={ShieldAlert} label="Đã hết hạn" value={batchStatistics.loDaHetHan || 0} note="Không được xuất sử dụng" tone="danger" />
            <BatchStat icon={Recycle} label="Chờ tiêu hủy" value={formatMoney(batchStatistics.giaTriLoDaHetHan || 0)} note="Giá trị các lô đã hết hạn" tone="value" />
          </div>

          <div className="inventory-batch-toolbar">
            <label className="inventory-search inventory-batch-search">
              <Search size={20} />
              <input value={batchKeyword} onChange={(event) => { setBatchKeyword(event.target.value); setBatchPage(0); }} placeholder="Tìm số lô, nguyên liệu hoặc nhà cung cấp..." />
            </label>
            <select value={batchIngredient} onChange={(event) => { setBatchIngredient(event.target.value); setBatchPage(0); }}>
              <option value="ALL">Tất cả nguyên liệu</option>
              {ingredientOptions.map((item) => <option key={item.maNguyenLieu} value={item.maNguyenLieu}>{item.tenNguyenLieu}</option>)}
            </select>
            <select value={batchExpiry} onChange={(event) => { setBatchExpiry(event.target.value); setBatchPage(0); }}>
              <option value="ALL">Tất cả hạn sử dụng</option>
              <option value="CON_HAN">Còn hạn</option>
              <option value="SAP_HET_HAN">Sắp hết hạn</option>
              <option value="HET_HAN">Đã hết hạn</option>
              <option value="DA_DUNG_HET">Đã dùng hết</option>
              <option value="KHONG_THEO_DOI">Không theo dõi</option>
            </select>
            <select value={batchActive} onChange={(event) => { setBatchActive(event.target.value); setBatchPage(0); }}>
              <option value="true">Đang sử dụng</option>
              <option value="false">Ngừng sử dụng</option>
              <option value="ALL">Tất cả trạng thái</option>
            </select>
            <label className="inventory-warning-days"><span>Cảnh báo trước</span><select value={warningDays} onChange={(event) => { setWarningDays(Number(event.target.value)); setBatchPage(0); }}><option value="1">1 ngày</option><option value="3">3 ngày</option><option value="7">7 ngày</option><option value="14">14 ngày</option><option value="30">30 ngày</option></select></label>
            <button type="button" className="inventory-add-btn" onClick={() => openCreateBatch(batchIngredient === 'ALL' ? '' : batchIngredient)}><Plus size={20} /> Nhập lô mới</button>
          </div>

          <div className="inventory-batch-dates">
            <label><span>Hạn dùng từ</span><input type="date" value={batchFrom} onChange={(event) => { setBatchFrom(event.target.value); setBatchPage(0); }} /></label>
            <label><span>Hạn dùng đến</span><input type="date" value={batchTo} onChange={(event) => { setBatchTo(event.target.value); setBatchPage(0); }} /></label>
            <button type="button" className="inventory-clear-filter" onClick={() => { setBatchKeyword(''); setBatchIngredient('ALL'); setBatchExpiry('ALL'); setBatchActive('true'); setBatchFrom(''); setBatchTo(''); setBatchPage(0); }}><X size={17} /> Xóa lọc</button>
          </div>

          <div className="inventory-table-card">
            <div className="inventory-table-scroll">
              <table className="inventory-table inventory-batch-table">
                <thead>
                  <tr><th>Nguyên liệu</th><th>Số lô</th><th>Ngày nhập</th><th>Hạn sử dụng</th><th>Tồn vật lý</th><th>Khả dụng</th><th>Chờ tiêu hủy</th><th>Giá nhập</th><th>Nhà cung cấp</th><th>Trạng thái</th><th>Thao tác</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="11" className="inventory-empty">Đang tải dữ liệu...</td></tr>
                  ) : batchRows.length ? batchRows.map((row) => {
                    const status = expiryStatus(row);
                    const ingredient = batchIngredientObject(row);
                    return (
                      <tr key={row.maLo}>
                        <td><div className="inventory-name-cell inventory-batch-name"><span><Layers3 size={18} /></span><div><strong>{row.tenNguyenLieu}</strong><small>{row.donViTinh}</small></div></div></td>
                        <td><strong className="inventory-lot-code">{row.soLo}</strong></td>
                        <td><div className="inventory-date-cell"><strong>{dateOnly(row.ngayNhap)}</strong>{row.ngaySanXuat && <small>NSX: {dateOnly(row.ngaySanXuat)}</small>}</div></td>
                        <td><div className="inventory-date-cell"><strong>{dateOnly(row.hanSuDung)}</strong>{status.note && <small className={status.className}>{status.note}</small>}</div></td>
                        <td><strong>{quantity(row.soLuongConLai)} {row.donViTinh}</strong><small className="inventory-mobile-note">Ban đầu: {quantity(row.soLuongBanDau)}</small></td>
                        <td><strong className="inventory-usable-batch">{quantity(row.soLuongKhaDung ?? row.soLuongConLai)} {row.donViTinh}</strong></td>
                        <td>
                          {Number(row.soLuongChoTieuHuy || 0) > 0
                            ? <span className="inventory-pending-waste">{quantity(row.soLuongChoTieuHuy)} {row.donViTinh}</span>
                            : <span className="inventory-zero-waste">0</span>}
                        </td>
                        <td>{row.donGiaNhap == null ? '—' : formatMoney(row.donGiaNhap)}</td>
                        <td className="inventory-supplier">{row.nhaCungCap || '—'}</td>
                        <td>
                          <div className="inventory-batch-status-stack">
                            <span className={`inventory-expiry-status ${status.className}`}>{status.label}</span>
                            <span className={`inventory-safety-status ${safetyStatus(row).className}`}>{safetyStatus(row).label}</span>
                          </div>
                        </td>
                        <td>
                          <div className="inventory-actions">
                            <button type="button" title="Truy xuất và xử lý sự cố lô" className="safety" onClick={() => { setTraceBatchId(row.maLo); setTab('traceability'); }}><ShieldAlert size={17} /></button>
                            <button type="button" title="Nhập, xuất hoặc kiểm kho lô" onClick={() => openStock(ingredient, 'DIEU_CHINH', row)} disabled={row.trangThai === false}><RefreshCcw size={17} /></button>
                            <button type="button" title={row.trangThaiHanSuDung === 'HET_HAN' ? 'Tiêu hủy lô hết hạn' : 'Ghi nhận hao hụt của lô'} className="waste" onClick={() => openWaste(ingredient, row)} disabled={Number(row.soLuongConLai || 0) <= 0 || row.choPhepTieuHuy === false}><Recycle size={17} /></button>
                            <button type="button" title="Sửa thông tin lô" onClick={() => openEditBatch(row)}><Pencil size={17} /></button>
                            <button type="button" title="Ngừng sử dụng lô" className="danger" onClick={() => deactivateBatch(row)} disabled={row.trangThai === false || Number(row.soLuongConLai || 0) > 0}><Trash2 size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="11" className="inventory-empty">Không tìm thấy lô nguyên liệu phù hợp</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={batchPage} totalPages={batchTotalPages} size={batchSize} numberOfElements={batchNumberOfElements} totalElements={batchTotalElements} onPage={setBatchPage} onSize={(nextSize) => { setBatchSize(nextSize); setBatchPage(0); }} noun="lô nguyên liệu" />
          </div>
        </>
      )}

      {tab === 'waste' && (
        <>
          <div className="inventory-waste-summary">
            <BatchStat icon={Recycle} label="Số lần tiêu hủy" value={wasteStatistics.soLanTieuHuy || 0} note="Trong khoảng thời gian đã chọn" tone="danger" />
            <BatchStat icon={Package} label="Nguyên liệu ảnh hưởng" value={wasteStatistics.soNguyenLieuAnhHuong || 0} note="Số nguyên liệu có phát sinh hao hụt" tone="warning" />
            <BatchStat icon={Layers3} label="Số lô ảnh hưởng" value={wasteStatistics.soLoAnhHuong || 0} note="Không tính phần tồn chưa theo lô" tone="neutral" />
            <BatchStat icon={WalletCards} label="Giá trị hao hụt" value={formatMoney(wasteStatistics.tongGiaTriTieuHuy || 0)} note="Theo đơn giá tại thời điểm ghi nhận" tone="value" />
          </div>

          <div className="inventory-waste-guide">
            <span><ClipboardX size={21} /></span>
            <div>
              <strong>Ghi nhận đúng nghiệp vụ tiêu hủy</strong>
              <p>Chọn biểu tượng <Recycle size={14} /> tại danh sách nguyên liệu hoặc từng lô. Hàng hết hạn sẽ bị loại khỏi tồn khả dụng nhưng chỉ giảm khỏi tồn vật lý sau khi xác nhận tiêu hủy.</p>
            </div>
          </div>

          <div className="inventory-history-toolbar inventory-waste-toolbar">
            <select value={wasteIngredientFilter} onChange={(event) => { setWasteIngredientFilter(event.target.value); setWastePage(0); }}>
              <option value="ALL">Tất cả nguyên liệu</option>
              {ingredientOptions.map((item) => <option key={item.maNguyenLieu} value={item.maNguyenLieu}>{item.tenNguyenLieu}</option>)}
            </select>
            <label><span>Từ ngày</span><input type="date" value={wasteFrom} onChange={(event) => { setWasteFrom(event.target.value); setWastePage(0); }} /></label>
            <label><span>Đến ngày</span><input type="date" value={wasteTo} onChange={(event) => { setWasteTo(event.target.value); setWastePage(0); }} /></label>
            <button type="button" className="inventory-clear-filter" onClick={() => { setWasteIngredientFilter('ALL'); setWasteFrom(''); setWasteTo(''); setWastePage(0); }}><X size={17} /> Xóa lọc</button>
          </div>

          {Array.isArray(wasteStatistics.theoLyDo) && wasteStatistics.theoLyDo.length > 0 && (
            <div className="inventory-waste-reasons">
              {wasteStatistics.theoLyDo.map((item) => (
                <div key={item.maLyDo}>
                  <span>{item.tenLyDo}</span>
                  <strong>{item.soLan || 0} lần</strong>
                  <small>{formatMoney(item.giaTriTieuHuy || 0)}</small>
                </div>
              ))}
            </div>
          )}

          <div className="inventory-table-card">
            <div className="inventory-table-scroll">
              <table className="inventory-table inventory-waste-table">
                <thead>
                  <tr><th>Thời gian</th><th>Nguyên liệu</th><th>Lô / Hạn sử dụng</th><th>Số lượng</th><th>Lý do</th><th>Giá trị hao hụt</th><th>Người thực hiện</th><th>Ghi chú</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="inventory-empty">Đang tải dữ liệu...</td></tr>
                  ) : wasteTransactions.length ? wasteTransactions.map((row) => (
                    <tr key={row.maGiaoDich}>
                      <td className="inventory-time">{formatDate(row.thoiGian)}</td>
                      <td><strong>{row.tenNguyenLieu}</strong><small className="inventory-mobile-note">{row.donViTinh}</small></td>
                      <td>{row.soLo ? <div className="inventory-date-cell"><strong className="inventory-lot-code">{row.soLo}</strong><small>HSD: {dateOnly(row.hanSuDung)}</small></div> : <span className="inventory-untracked-lot">Không theo lô</span>}</td>
                      <td><strong>{quantity(row.soLuong)} {row.donViTinh}</strong></td>
                      <td><span className="inventory-waste-reason-badge">{row.lyDo?.split(':')[0] || row.maLyDo || 'Khác'}</span></td>
                      <td><strong className="inventory-waste-value">{formatMoney(row.giaTriGiaoDich || 0)}</strong></td>
                      <td>{row.nguoiThucHien || 'Hệ thống'}</td>
                      <td className="inventory-reason">{row.ghiChu || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="8" className="inventory-empty">Chưa có giao dịch tiêu hủy phù hợp</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={wastePage} totalPages={wasteTotalPages} size={wasteSize} numberOfElements={wasteNumberOfElements} totalElements={wasteTotalElements} onPage={setWastePage} onSize={(nextSize) => { setWasteSize(nextSize); setWastePage(0); }} noun="giao dịch tiêu hủy" />
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="inventory-history-toolbar">
            <select value={transactionIngredient} onChange={(event) => { setTransactionIngredient(event.target.value); setTransactionPage(0); }}>
              <option value="ALL">Tất cả nguyên liệu</option>
              {ingredientOptions.map((item) => <option key={item.maNguyenLieu} value={item.maNguyenLieu}>{item.tenNguyenLieu}</option>)}
            </select>
            <select value={transactionType} onChange={(event) => { setTransactionType(event.target.value); setTransactionPage(0); }}>
              <option value="ALL">Tất cả giao dịch</option><option value="NHAP">Nhập kho</option><option value="XUAT">Xuất kho</option><option value="DIEU_CHINH">Điều chỉnh</option><option value="TIEU_HUY">Tiêu hủy / hao hụt</option>
            </select>
            <label><span>Từ ngày</span><input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setTransactionPage(0); }} /></label>
            <label><span>Đến ngày</span><input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setTransactionPage(0); }} /></label>
            <button type="button" className="inventory-clear-filter" onClick={() => { setTransactionIngredient('ALL'); setTransactionType('ALL'); setFromDate(''); setToDate(''); setTransactionPage(0); }}><X size={17} /> Xóa lọc</button>
          </div>

          <div className="inventory-table-card">
            <div className="inventory-table-scroll">
              <table className="inventory-table inventory-history-table inventory-history-expiry-table">
                <thead>
                  <tr><th>Thời gian</th><th>Nguyên liệu</th><th>Lô / Hạn sử dụng</th><th>Loại giao dịch</th><th>Số lượng</th><th>Tồn trước → sau</th><th>Đơn giá</th><th>Giá trị</th><th>Người thực hiện</th><th>Lý do / ghi chú</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="10" className="inventory-empty">Đang tải dữ liệu...</td></tr>
                  ) : transactions.length ? transactions.map((row) => {
                    const meta = transactionMeta(row.loaiGiaoDich);
                    const Icon = meta.Icon;
                    return (
                      <tr key={row.maGiaoDich}>
                        <td className="inventory-time">{formatDate(row.thoiGian)}</td>
                        <td><strong>{row.tenNguyenLieu}</strong><small className="inventory-mobile-note">{row.donViTinh}</small></td>
                        <td>{row.soLo ? <div className="inventory-date-cell"><strong className="inventory-lot-code">{row.soLo}</strong><small>HSD: {dateOnly(row.hanSuDung)}</small></div> : <span className="inventory-untracked-lot">Không theo lô</span>}</td>
                        <td><span className={`inventory-transaction ${meta.className}`}><Icon size={15} />{meta.label}</span></td>
                        <td><strong>{quantity(row.soLuong)} {row.donViTinh}</strong></td>
                        <td><span className="inventory-balance">{quantity(row.soLuongTruoc)} → {quantity(row.soLuongSau)}</span></td>
                        <td>{row.donGiaNhap == null ? '—' : formatMoney(row.donGiaNhap)}</td>
                        <td>{row.giaTriGiaoDich == null ? '—' : <strong className={row.loaiGiaoDich === 'TIEU_HUY' ? 'inventory-waste-value' : ''}>{formatMoney(row.giaTriGiaoDich)}</strong>}</td>
                        <td>{row.nguoiThucHien || 'Hệ thống'}</td>
                        <td className="inventory-reason">{row.maLyDo && <span className="inventory-waste-reason-badge">{row.lyDo?.split(':')[0] || row.maLyDo}</span>}{row.ghiChu || (!row.maLyDo ? row.lyDo : '') || '—'}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="10" className="inventory-empty">Chưa có giao dịch kho phù hợp</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={transactionPage} totalPages={transactionTotalPages} size={transactionSize} numberOfElements={transactionNumberOfElements} totalElements={transactionTotalElements} onPage={setTransactionPage} onSize={(nextSize) => { setTransactionSize(nextSize); setTransactionPage(0); }} noun="giao dịch" />
          </div>
        </>
      )}

      {tab === 'traceability' && (
        <FoodSafetyWorkspace
          ingredientOptions={ingredientOptions}
          initialBatchId={traceBatchId}
          onDataChanged={() => Promise.all([
            loadStatistics(),
            loadBatches(),
            loadBatchStatistics(),
          ])}
        />
      )}

      {ingredientModal && (
        <div className="inventory-modal-backdrop" onMouseDown={closeIngredientModal}>
          <form className="inventory-modal" onSubmit={saveIngredient} onMouseDown={(event) => event.stopPropagation()}>
            <div className="inventory-modal-head"><div><span>{editing ? 'CHỈNH SỬA NGUYÊN LIỆU' : 'THÊM NGUYÊN LIỆU MỚI'}</span><h3>{editing ? editing.tenNguyenLieu : 'Thông tin nguyên liệu'}</h3></div><button type="button" onClick={closeIngredientModal}><X size={21} /></button></div>
            <div className="inventory-form-grid">
              <label className="full"><span>Tên nguyên liệu *</span><input value={form.tenNguyenLieu} maxLength="150" onChange={(event) => setForm((value) => ({ ...value, tenNguyenLieu: event.target.value }))} placeholder="Ví dụ: Thịt bò" /></label>
              <label><span>Đơn vị tính *</span><input value={form.donViTinh} maxLength="30" onChange={(event) => setForm((value) => ({ ...value, donViTinh: event.target.value }))} placeholder="kg, g, lít..." /></label>
              <label><span>Mức tồn tối thiểu *</span><input type="number" min="0" step="0.001" value={form.mucTonToiThieu} onChange={(event) => setForm((value) => ({ ...value, mucTonToiThieu: event.target.value }))} /></label>
              <label><span>{editing ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu'}</span><input type="number" min="0" step="0.001" value={form.soLuongTon} disabled={Boolean(editing)} onChange={(event) => setForm((value) => ({ ...value, soLuongTon: event.target.value }))} /></label>
              <label><span>Giá nhập</span><input type="number" min="0" step="1000" value={form.giaNhap} onChange={(event) => setForm((value) => ({ ...value, giaNhap: event.target.value }))} placeholder="0" /></label>
              <label className="full"><span>Mô tả</span><textarea rows="3" maxLength="500" value={form.moTa} onChange={(event) => setForm((value) => ({ ...value, moTa: event.target.value }))} placeholder="Thông tin bảo quản hoặc ghi chú..." /></label>
              <label className="inventory-toggle full"><input type="checkbox" checked={form.trangThai} onChange={(event) => setForm((value) => ({ ...value, trangThai: event.target.checked }))} /><span><b>Đang sử dụng</b><small>Nguyên liệu được hiển thị và cho phép nhập xuất kho</small></span></label>
            </div>
            {editing && <p className="inventory-form-note">Số lượng tồn được thay đổi tại chức năng <b>Cập nhật tồn kho</b> để lưu đúng lịch sử nhập, xuất và kiểm kho.</p>}
            <div className="inventory-modal-actions"><button type="button" className="secondary" onClick={closeIngredientModal}>Hủy</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm nguyên liệu'}</button></div>
          </form>
        </div>
      )}

      {batchModal && (
        <div className="inventory-modal-backdrop" onMouseDown={closeBatchModal}>
          <form className="inventory-modal inventory-batch-modal" onSubmit={saveBatch} onMouseDown={(event) => event.stopPropagation()}>
            <div className="inventory-modal-head">
              <div><span>{editingBatch ? 'CHỈNH SỬA LÔ NGUYÊN LIỆU' : 'NHẬP LÔ NGUYÊN LIỆU'}</span><h3>{editingBatch ? editingBatch.soLo : 'Thông tin lô và hạn sử dụng'}</h3><p>{editingBatch ? 'Số lượng được thay đổi bằng chức năng kiểm kho lô.' : 'Mỗi lần nhập hàng nên tạo một lô để theo dõi đúng hạn sử dụng.'}</p></div>
              <button type="button" onClick={closeBatchModal}><X size={21} /></button>
            </div>
            <div className="inventory-form-grid">
              <label className="full"><span>Nguyên liệu *</span><select value={batchForm.ingredientId} disabled={Boolean(editingBatch)} onChange={(event) => { const ingredient = ingredientOptions.find((item) => String(item.maNguyenLieu) === event.target.value); setBatchForm((value) => ({ ...value, ingredientId: event.target.value, donGiaNhap: ingredient?.giaNhap == null ? value.donGiaNhap : String(ingredient.giaNhap) })); }}><option value="">Chọn nguyên liệu</option>{ingredientOptions.filter((item) => item.trangThai !== false).map((item) => <option key={item.maNguyenLieu} value={item.maNguyenLieu}>{item.tenNguyenLieu} ({item.donViTinh})</option>)}</select></label>
              <label><span>Số lô *</span><input value={batchForm.soLo} maxLength="80" onChange={(event) => setBatchForm((value) => ({ ...value, soLo: event.target.value }))} placeholder="Ví dụ: TB-20260701-01" /></label>
              <label><span>Ngày nhập *</span><input type="date" value={batchForm.ngayNhap} onChange={(event) => setBatchForm((value) => ({ ...value, ngayNhap: event.target.value }))} /></label>
              <label><span>Ngày sản xuất</span><input type="date" value={batchForm.ngaySanXuat} onChange={(event) => setBatchForm((value) => ({ ...value, ngaySanXuat: event.target.value }))} /></label>
              <label><span>Hạn sử dụng</span><input type="date" value={batchForm.hanSuDung} onChange={(event) => setBatchForm((value) => ({ ...value, hanSuDung: event.target.value }))} /></label>
              {!editingBatch && <label><span>Số lượng nhập *</span><input type="number" min="0.001" step="0.001" value={batchForm.soLuongNhap} onChange={(event) => setBatchForm((value) => ({ ...value, soLuongNhap: event.target.value }))} placeholder="0" /></label>}
              <label><span>Đơn giá nhập</span><input type="number" min="0" step="1000" value={batchForm.donGiaNhap} onChange={(event) => setBatchForm((value) => ({ ...value, donGiaNhap: event.target.value }))} placeholder="0" /></label>
              <label className="full"><span>Nhà cung cấp</span><input value={batchForm.nhaCungCap} maxLength="200" onChange={(event) => setBatchForm((value) => ({ ...value, nhaCungCap: event.target.value }))} placeholder="Tên nhà cung cấp" /></label>
              {!editingBatch && <label className="full"><span>Ghi chú nhập lô</span><textarea rows="3" maxLength="500" value={batchForm.ghiChu} onChange={(event) => setBatchForm((value) => ({ ...value, ghiChu: event.target.value }))} placeholder="Ví dụ: Nhập theo phiếu NK-001..." /></label>}
              {editingBatch && <label className="inventory-toggle full"><input type="checkbox" checked={batchForm.trangThai} onChange={(event) => setBatchForm((value) => ({ ...value, trangThai: event.target.checked }))} /><span><b>Đang sử dụng</b><small>Chỉ nên tắt khi lô đã không còn hàng</small></span></label>}
            </div>
            <p className="inventory-form-note inventory-expiry-note"><CircleAlert size={15} /> Lô đã hết hạn sẽ không được xuất sử dụng. Khi xuất không chọn lô, hệ thống ưu tiên lô gần hết hạn trước theo FEFO.</p>
            <div className="inventory-modal-actions"><button type="button" className="secondary" onClick={closeBatchModal}>Hủy</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Đang lưu...' : editingBatch ? 'Lưu thay đổi' : 'Nhập lô'}</button></div>
          </form>
        </div>
      )}

      {wasteModal && wasteIngredient && (
        <div className="inventory-modal-backdrop" onMouseDown={closeWasteModal}>
          <form className="inventory-modal inventory-waste-modal" onSubmit={saveWaste} onMouseDown={(event) => event.stopPropagation()}>
            <div className="inventory-modal-head inventory-waste-modal-head">
              <div>
                <span>TIÊU HỦY / GHI NHẬN HAO HỤT</span>
                <h3>{wasteIngredient.tenNguyenLieu}</h3>
                <p>Giao dịch được lưu riêng, giảm tồn vật lý và giữ đầy đủ lịch sử đối soát.</p>
              </div>
              <button type="button" onClick={closeWasteModal}><X size={21} /></button>
            </div>

            <div className="inventory-waste-stock-summary">
              <div><span>Tồn vật lý</span><strong>{quantity(physicalStock(wasteIngredient))} {wasteIngredient.donViTinh}</strong></div>
              <div><span>Tồn khả dụng</span><strong>{quantity(usableStock(wasteIngredient))} {wasteIngredient.donViTinh}</strong></div>
              <div className="pending"><span>Chờ tiêu hủy</span><strong>{quantity(pendingDisposal(wasteIngredient))} {wasteIngredient.donViTinh}</strong></div>
            </div>

            <div className="inventory-form-grid">
              {wasteFixedBatch ? (
                <div className="inventory-selected-waste-batch full">
                  <span><Layers3 size={18} /></span>
                  <div>
                    <small>Lô được chọn</small>
                    <strong>{wasteFixedBatch.soLo}</strong>
                    <p>HSD: {dateOnly(wasteFixedBatch.hanSuDung)} · Còn {quantity(wasteFixedBatch.soLuongConLai)} {wasteIngredient.donViTinh}</p>
                  </div>
                  <span className={`inventory-expiry-status ${expiryStatus(wasteFixedBatch).className}`}>{expiryStatus(wasteFixedBatch).label}</span>
                </div>
              ) : (
                <label className="full">
                  <span>Nguồn nguyên liệu *</span>
                  <select
                    value={wasteForm.batchId}
                    disabled={wasteOptionsLoading}
                    onChange={(event) => {
                      const nextBatchId = event.target.value;
                      const nextBatch = wasteBatchOptions.find((item) => String(item.maLo) === nextBatchId);
                      setWasteForm((value) => ({
                        ...value,
                        batchId: nextBatchId,
                        soLuong: '',
                        maLyDo: nextBatch?.trangThaiHanSuDung === 'HET_HAN'
                          ? 'QUA_HAN_SU_DUNG'
                          : value.maLyDo === 'QUA_HAN_SU_DUNG' ? '' : value.maLyDo,
                      }));
                    }}
                  >
                    <option value="">{wasteOptionsLoading ? 'Đang tải danh sách lô...' : `Tồn chưa theo dõi theo lô (${quantity(wasteUntrackedQuantity)} ${wasteIngredient.donViTinh})`}</option>
                    {wasteBatchOptions.map((item) => (
                      <option key={item.maLo} value={item.maLo}>
                        {item.soLo} · {expiryStatus(item).label} · còn {quantity(item.soLuongConLai)} {item.donViTinh || wasteIngredient.donViTinh}
                      </option>
                    ))}
                  </select>
                  {wasteUntrackedQuantity <= 0 && !wasteForm.batchId && <small className="inventory-field-warning">Không còn tồn chưa theo lô. Vui lòng chọn một lô nguyên liệu.</small>}
                </label>
              )}

              <label>
                <span>Số lượng tiêu hủy *</span>
                <div className="inventory-number-input"><input type="number" min="0.001" max={wasteMaximumQuantity || undefined} step="0.001" autoFocus value={wasteForm.soLuong} onChange={(event) => setWasteForm((value) => ({ ...value, soLuong: event.target.value }))} /><b>{wasteIngredient.donViTinh}</b></div>
                <small>Tối đa: {quantity(wasteMaximumQuantity)} {wasteIngredient.donViTinh}</small>
              </label>

              <label>
                <span>Lý do *</span>
                <select value={wasteForm.maLyDo} onChange={(event) => setWasteForm((value) => ({ ...value, maLyDo: event.target.value }))}>
                  <option value="">Chọn lý do</option>
                  {availableWasteReasons.map((item) => <option key={item.maLyDo} value={item.maLyDo}>{item.tenLyDo}</option>)}
                </select>
              </label>

              <label className="full">
                <span>Ghi chú {wasteReasons.find((item) => item.maLyDo === wasteForm.maLyDo)?.batBuocGhiChu ? '*' : ''}</span>
                <textarea rows="3" maxLength="500" value={wasteForm.ghiChu} onChange={(event) => setWasteForm((value) => ({ ...value, ghiChu: event.target.value }))} placeholder="Ví dụ: Kiểm kê kho đầu ngày, bao bì bị rách..." />
              </label>
            </div>

            {wasteBatchIsExpired && <p className="inventory-form-note inventory-danger-note"><Ban size={15} /> Lô này đã hết hạn, không còn được tính vào tồn khả dụng và không thể xuất chế biến.</p>}
            <div className="inventory-waste-preview">
              <div><span>Tồn vật lý sau tiêu hủy</span><strong>{quantity(Math.max(0, physicalStock(wasteIngredient) - Number(wasteForm.soLuong || 0)))} {wasteIngredient.donViTinh}</strong></div>
              <div><span>Giá trị hao hụt dự kiến</span><strong>{formatMoney(wastePreviewValue)}</strong></div>
            </div>
            <div className="inventory-modal-actions"><button type="button" className="secondary" onClick={closeWasteModal}>Hủy</button><button type="submit" className="primary waste" disabled={saving || wasteOptionsLoading || wasteMaximumQuantity <= 0}>{saving ? 'Đang ghi nhận...' : 'Xác nhận tiêu hủy'}</button></div>
          </form>
        </div>
      )}

      {stockModal && selectedIngredient && (
        <div className="inventory-modal-backdrop" onMouseDown={closeStockModal}>
          <form className="inventory-modal inventory-stock-modal" onSubmit={saveAdjustment} onMouseDown={(event) => event.stopPropagation()}>
            <div className="inventory-modal-head">
              <div><span>{selectedBatch ? 'CẬP NHẬT TỒN KHO THEO LÔ' : 'CẬP NHẬT TỒN KHO'}</span><h3>{selectedIngredient.tenNguyenLieu}</h3><p>{selectedBatch ? <>Lô <b>{selectedBatch.soLo}</b> · Còn <b>{quantity(selectedBatch.soLuongConLai)} {selectedIngredient.donViTinh}</b></> : <>Đang tồn: <b>{quantity(selectedIngredient.soLuongTon)} {selectedIngredient.donViTinh}</b></>}</p></div>
              <button type="button" onClick={closeStockModal}><X size={21} /></button>
            </div>
            <div className="inventory-operation-tabs">
              <button type="button" className={adjustment.loaiGiaoDich === 'NHAP' ? 'active import' : ''} onClick={() => setAdjustment((value) => ({ ...value, loaiGiaoDich: 'NHAP', soLuong: '', donGiaNhap: selectedBatch?.donGiaNhap == null ? (selectedIngredient.giaNhap == null ? '' : String(selectedIngredient.giaNhap)) : String(selectedBatch.donGiaNhap) }))}><ArrowDown size={18} /> Nhập kho</button>
              <button type="button" className={adjustment.loaiGiaoDich === 'XUAT' ? 'active export' : ''} onClick={() => setAdjustment((value) => ({ ...value, loaiGiaoDich: 'XUAT', soLuong: '', donGiaNhap: '' }))}><ArrowUp size={18} /> Xuất kho</button>
              <button type="button" className={adjustment.loaiGiaoDich === 'DIEU_CHINH' ? 'active adjust' : ''} onClick={() => setAdjustment((value) => ({ ...value, loaiGiaoDich: 'DIEU_CHINH', soLuong: String(selectedStockAmount), donGiaNhap: '' }))}><RefreshCcw size={18} /> Kiểm kho</button>
            </div>
            <div className="inventory-form-grid">
              <label className={adjustment.loaiGiaoDich === 'NHAP' ? '' : 'full'}><span>{adjustment.loaiGiaoDich === 'DIEU_CHINH' ? 'Số tồn thực tế sau kiểm kho *' : `Số lượng ${adjustment.loaiGiaoDich === 'XUAT' ? 'xuất' : 'nhập'} *`}</span><div className="inventory-number-input"><input type="number" min="0" step="0.001" autoFocus value={adjustment.soLuong} onChange={(event) => setAdjustment((value) => ({ ...value, soLuong: event.target.value }))} /><b>{selectedIngredient.donViTinh}</b></div></label>
              {adjustment.loaiGiaoDich === 'NHAP' && <label><span>Đơn giá nhập</span><input type="number" min="0" step="1000" value={adjustment.donGiaNhap} onChange={(event) => setAdjustment((value) => ({ ...value, donGiaNhap: event.target.value }))} placeholder="0" /></label>}
              <label className="full"><span>Lý do / ghi chú</span><textarea rows="3" maxLength="500" value={adjustment.lyDo} onChange={(event) => setAdjustment((value) => ({ ...value, lyDo: event.target.value }))} placeholder={adjustment.loaiGiaoDich === 'NHAP' ? 'Ví dụ: Bổ sung cùng lô...' : adjustment.loaiGiaoDich === 'XUAT' ? 'Ví dụ: Xuất dùng cho bếp...' : 'Ví dụ: Kiểm kê và điều chỉnh theo số lượng thực tế...'} /></label>
            </div>
            {selectedBatch?.trangThaiHanSuDung === 'HET_HAN' && adjustment.loaiGiaoDich === 'XUAT' && <p className="inventory-form-note inventory-danger-note"><Ban size={15} /> Lô này đã hết hạn và không thể xuất sử dụng. Hãy đóng cửa sổ này và dùng nút Tiêu hủy để ghi nhận đúng lịch sử hao hụt.</p>}
            <div className="inventory-preview-balance"><span>{selectedBatch ? 'Số lượng lô sau thao tác' : 'Tồn kho sau thao tác'}</span><strong>{quantity(previewStock)} {selectedIngredient.donViTinh}</strong></div>
            <div className="inventory-modal-actions"><button type="button" className="secondary" onClick={closeStockModal}>Hủy</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Xác nhận cập nhật'}</button></div>
          </form>
        </div>
      )}
      <ConfirmActionModal
        open={Boolean(confirmDialog)}
        onClose={closeConfirmDialog}
        onConfirm={confirmDeactivate}
        loading={confirmLoading}
        title={confirmTitle}
        description={confirmDescription}
        itemName={confirmName}
        warning={confirmWarning}
        confirmText={confirmButtonText}
      />

    </section>
  );
}
