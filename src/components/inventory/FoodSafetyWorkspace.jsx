import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  RefreshCcw,
  Search,
  ShieldAlert,
  Siren,
  Users,
  X,
} from 'lucide-react';
import { foodSafetyApi } from '../../api/foodSafetyApi';
import { inventoryApi } from '../../api/inventoryApi';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatDate';
import { normalizePage } from '../../utils/pagination';

function unwrapData(response, fallback = null) {
  return response?.data ?? response ?? fallback;
}

function unwrapList(response) {
  const value = unwrapData(response, []);
  return Array.isArray(value) ? value : [];
}

function quantity(value) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

function dateOnly(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function safetyMeta(value) {
  switch (String(value || 'AN_TOAN').toUpperCase()) {
    case 'KHOA_TAM_THOI': return { label: 'Khóa tạm thời', tone: 'locked' };
    case 'CO_SU_CO': return { label: 'Có sự cố', tone: 'incident' };
    case 'THU_HOI': return { label: 'Đang thu hồi', tone: 'recalled' };
    case 'DA_TIEU_HUY': return { label: 'Đã tiêu hủy', tone: 'disposed' };
    default: return { label: 'An toàn', tone: 'safe' };
  }
}

function severityMeta(value) {
  switch (String(value || '').toUpperCase()) {
    case 'KHAN_CAP': return { label: 'Khẩn cấp', tone: 'emergency' };
    case 'CAO': return { label: 'Cao', tone: 'high' };
    case 'TRUNG_BINH': return { label: 'Trung bình', tone: 'medium' };
    default: return { label: 'Thấp', tone: 'low' };
  }
}

function incidentStatusMeta(value) {
  switch (String(value || '').toUpperCase()) {
    case 'DANG_XU_LY': return { label: 'Đang xử lý', tone: 'processing' };
    case 'DA_DONG': return { label: 'Đã đóng', tone: 'closed' };
    case 'DA_THU_HOI': return { label: 'Đã thu hồi', tone: 'recalled' };
    case 'DA_TIEU_HUY': return { label: 'Đã tiêu hủy', tone: 'disposed' };
    default: return { label: 'Mới', tone: 'new' };
  }
}

function orderItemStatus(value) {
  const code = String(value || '').toUpperCase();
  if (code === 'DANG_NAU' || code === 'DANG_CHE_BIEN') return 'Đang chế biến';
  if (code === 'HOAN_THANH' || code === 'SAN_SANG') return 'Sẵn sàng';
  if (code === 'DA_PHUC_VU') return 'Đã phục vụ';
  if (code === 'DA_HUY') return 'Đã hủy';
  if (code === 'CHO_BEP') return 'Chờ bếp';
  return value || '—';
}

const emptyIncident = {
  loaiSuCo: 'NGHI_NGO_CHAT_LUONG',
  mucDo: 'CAO',
  lyDo: '',
  ghiChu: '',
};

const emptyResolution = {
  trangThaiSuCo: 'DA_DONG',
  trangThaiAnToanLo: 'AN_TOAN',
  ketQuaXuLy: '',
};

export default function FoodSafetyWorkspace({ ingredientOptions = [], initialBatchId = null, onDataChanged }) {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [ingredientId, setIngredientId] = useState('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId ? String(initialBatchId) : '');
  const [impact, setImpact] = useState(null);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState(emptyIncident);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveForm, setResolveForm] = useState(emptyResolution);
  const [saving, setSaving] = useState(false);

  async function loadBatches() {
    setLoadingBatches(true);
    try {
      const response = await inventoryApi.getBatchPage({ page: 0, size: 200 });
      setBatches(normalizePage(response, 200).content);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách lô để truy xuất'));
    } finally {
      setLoadingBatches(false);
    }
  }

  async function loadIncidents() {
    setLoadingIncidents(true);
    try {
      const response = await foodSafetyApi.getIncidents();
      setIncidents(unwrapList(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải danh sách sự cố lô nguyên liệu'));
    } finally {
      setLoadingIncidents(false);
    }
  }

  async function traceBatch(batchId = selectedBatchId, showError = true) {
    if (!batchId) {
      if (showError) toast.error('Vui lòng chọn lô nguyên liệu cần truy xuất');
      return;
    }
    setLoadingImpact(true);
    try {
      const response = await foodSafetyApi.getBatchImpact(batchId);
      setImpact(unwrapData(response, null));
      setSelectedBatchId(String(batchId));
    } catch (error) {
      setImpact(null);
      if (showError) toast.error(errorMessageOf(error, 'Không thể truy xuất ảnh hưởng của lô nguyên liệu'));
    } finally {
      setLoadingImpact(false);
    }
  }

  useEffect(() => {
    loadBatches();
    loadIncidents();
  }, []);

  useEffect(() => {
    if (!initialBatchId) return;
    setSelectedBatchId(String(initialBatchId));
    traceBatch(String(initialBatchId), false);
  }, [initialBatchId]);

  const filteredBatches = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return batches.filter((item) => {
      if (ingredientId !== 'ALL' && String(item.maNguyenLieu) !== String(ingredientId)) return false;
      if (!q) return true;
      return [item.soLo, item.tenNguyenLieu, item.nhaCungCap]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [batches, keyword, ingredientId]);

  const selectedBatch = batches.find((item) => String(item.maLo) === String(selectedBatchId)) || null;

  async function refreshAll(batchId = selectedBatchId) {
    await Promise.all([loadBatches(), loadIncidents()]);
    if (batchId) await traceBatch(batchId, false);
    if (onDataChanged) await onDataChanged();
  }

  async function submitIncident(event) {
    event.preventDefault();
    if (!selectedBatchId) return;
    if (!reportForm.lyDo.trim()) {
      toast.error('Vui lòng nhập lý do báo cáo sự cố');
      return;
    }
    setSaving(true);
    try {
      const response = await foodSafetyApi.reportIncident(selectedBatchId, {
        ...reportForm,
        lyDo: reportForm.lyDo.trim(),
        ghiChu: reportForm.ghiChu.trim() || null,
      });
      toast.success(messageOf(response, 'Báo cáo sự cố và khóa lô thành công'));
      setReportOpen(false);
      setReportForm(emptyIncident);
      await refreshAll(selectedBatchId);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Báo cáo sự cố lô nguyên liệu thất bại'));
    } finally {
      setSaving(false);
    }
  }

  function openResolve(incident) {
    setResolveTarget(incident);
    setResolveForm({
      trangThaiSuCo: incident.trangThai === 'MOI' ? 'DANG_XU_LY' : 'DA_DONG',
      trangThaiAnToanLo: incident.trangThaiAnToanLo || 'KHOA_TAM_THOI',
      ketQuaXuLy: incident.ketQuaXuLy || '',
    });
  }

  async function submitResolution(event) {
    event.preventDefault();
    if (!resolveTarget) return;
    if (!resolveForm.ketQuaXuLy.trim()) {
      toast.error('Vui lòng nhập kết quả xử lý sự cố');
      return;
    }
    setSaving(true);
    try {
      const response = await foodSafetyApi.resolveIncident(resolveTarget.maSuCo, {
        ...resolveForm,
        ketQuaXuLy: resolveForm.ketQuaXuLy.trim(),
      });
      toast.success(messageOf(response, 'Cập nhật xử lý sự cố thành công'));
      const batchId = resolveTarget.maLo;
      setResolveTarget(null);
      setResolveForm(emptyResolution);
      await refreshAll(batchId);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Cập nhật xử lý sự cố thất bại'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="food-safety-workspace">
      <div className="food-safety-guide">
        <span><ShieldAlert size={22} /></span>
        <div>
          <strong>Truy xuất an toàn thực phẩm hai chiều</strong>
          <p>Chọn một lô để xác định các món, đơn hàng và bàn đã sử dụng. Khi báo cáo sự cố, lô sẽ bị khóa và không còn được cấp phát cho bếp.</p>
        </div>
      </div>

      <div className="food-safety-toolbar">
        <label className="inventory-search food-safety-search">
          <Search size={19} />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã lô, nguyên liệu, nhà cung cấp..." />
        </label>
        <select value={ingredientId} onChange={(event) => { setIngredientId(event.target.value); setSelectedBatchId(''); setImpact(null); }}>
          <option value="ALL">Tất cả nguyên liệu</option>
          {ingredientOptions.map((item) => <option key={item.maNguyenLieu} value={item.maNguyenLieu}>{item.tenNguyenLieu}</option>)}
        </select>
        <select value={selectedBatchId} onChange={(event) => { setSelectedBatchId(event.target.value); setImpact(null); }} disabled={loadingBatches}>
          <option value="">{loadingBatches ? 'Đang tải lô...' : 'Chọn lô cần truy xuất'}</option>
          {filteredBatches.map((item) => <option key={item.maLo} value={item.maLo}>{item.soLo} · {item.tenNguyenLieu}</option>)}
        </select>
        <button type="button" className="food-safety-trace-btn" onClick={() => traceBatch()} disabled={loadingImpact || !selectedBatchId}>
          <PackageSearch size={18} /> {loadingImpact ? 'Đang truy xuất...' : 'Truy xuất ảnh hưởng'}
        </button>
        <button type="button" className="food-safety-report-btn" onClick={() => setReportOpen(true)} disabled={!selectedBatch}>
          <Siren size={18} /> Báo cáo sự cố
        </button>
      </div>

      {impact ? (
        <>
          <div className="food-safety-batch-card">
            <div>
              <span>LÔ ĐANG TRUY XUẤT</span>
              <h3>{impact.soLo} · {impact.tenNguyenLieu}</h3>
              <p>Nhà cung cấp: {impact.nhaCungCap || 'Chưa cập nhật'} · Ngày nhập: {dateOnly(impact.ngayNhap)} · HSD: {dateOnly(impact.hanSuDung)}</p>
            </div>
            <span className={`food-safety-state ${safetyMeta(impact.trangThaiAnToan).tone}`}>{safetyMeta(impact.trangThaiAnToan).label}</span>
          </div>

          <div className="food-safety-summary">
            <article><span><ClipboardCheck size={19} /></span><div><small>Món bị ảnh hưởng</small><strong>{impact.soMonBiAnhHuong || 0}</strong></div></article>
            <article><span><PackageSearch size={19} /></span><div><small>Đơn hàng</small><strong>{impact.soDonBiAnhHuong || 0}</strong></div></article>
            <article><span><Users size={19} /></span><div><small>Bàn liên quan</small><strong>{impact.soBanBiAnhHuong || 0}</strong></div></article>
            <article><span><RefreshCcw size={19} /></span><div><small>Đang chế biến</small><strong>{impact.soMonDangCheBien || 0}</strong></div></article>
            <article><span><CheckCircle2 size={19} /></span><div><small>Đã phục vụ</small><strong>{impact.soMonDaPhucVu || 0}</strong></div></article>
            <article><span><CalendarDays size={19} /></span><div><small>Đã sử dụng</small><strong>{quantity(impact.tongSoLuongDaTruyXuat)} {impact.donViTinh}</strong></div></article>
          </div>

          <div className="inventory-table-card food-safety-impact-card">
            <div className="food-safety-section-head"><div><strong>Chi tiết món và đơn hàng bị ảnh hưởng</strong><p>Tồn còn lại của lô: {quantity(impact.soLuongConLai)} {impact.donViTinh}</p></div></div>
            <div className="inventory-table-scroll">
              <table className="inventory-table food-safety-impact-table">
                <thead><tr><th>Mã đơn</th><th>Bàn</th><th>Món ăn</th><th>Lượng lô đã dùng</th><th>Trạng thái món</th><th>Thời gian đặt</th><th>Thời gian cấp phát</th></tr></thead>
                <tbody>
                  {impact.chiTietAnhHuong?.length ? impact.chiTietAnhHuong.map((item) => (
                    <tr key={item.maSuDung}>
                      <td><strong>#{item.maDonHang}</strong></td>
                      <td>{item.tenBan || `Bàn ${item.maBan}`}</td>
                      <td><strong>{item.tenMonAn}</strong><small className="inventory-mobile-note">Số lượng món: {item.soLuongMon}</small></td>
                      <td><strong>{quantity(item.soLuongLoDaDung)} {item.donViTinh}</strong></td>
                      <td><span className="food-safety-item-status">{orderItemStatus(item.trangThaiMon)}</span></td>
                      <td className="inventory-time">{formatDate(item.thoiGianDat)}</td>
                      <td className="inventory-time">{formatDate(item.thoiGianCapPhat)}</td>
                    </tr>
                  )) : <tr><td colSpan="7" className="inventory-empty">Lô này chưa được sử dụng cho món ăn nào</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="food-safety-empty-state">
          <PackageSearch size={35} />
          <strong>Chọn một lô nguyên liệu để bắt đầu truy xuất</strong>
          <span>Hệ thống sẽ tổng hợp toàn bộ món, đơn hàng, bàn và lượng nguyên liệu đã sử dụng.</span>
        </div>
      )}

      <div className="inventory-table-card food-safety-incidents-card">
        <div className="food-safety-section-head">
          <div><strong>Danh sách sự cố lô nguyên liệu</strong><p>Theo dõi người phát hiện, mức độ, trạng thái khóa lô và kết quả xử lý.</p></div>
          <button type="button" onClick={loadIncidents} disabled={loadingIncidents}><RefreshCcw size={17} /> Làm mới</button>
        </div>
        <div className="inventory-table-scroll">
          <table className="inventory-table food-safety-incidents-table">
            <thead><tr><th>Thời gian</th><th>Lô / Nguyên liệu</th><th>Mức độ</th><th>Lý do</th><th>Trạng thái</th><th>An toàn lô</th><th>Người xử lý</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loadingIncidents ? <tr><td colSpan="8" className="inventory-empty">Đang tải sự cố...</td></tr> : incidents.length ? incidents.map((item) => {
                const severity = severityMeta(item.mucDo);
                const status = incidentStatusMeta(item.trangThai);
                const safety = safetyMeta(item.trangThaiAnToanLo);
                const resolved = ['DA_DONG', 'DA_THU_HOI', 'DA_TIEU_HUY'].includes(String(item.trangThai).toUpperCase());
                return (
                  <tr key={item.maSuCo}>
                    <td className="inventory-time">{formatDate(item.thoiGianPhatHien)}</td>
                    <td><strong>{item.soLo}</strong><small className="inventory-mobile-note">{item.tenNguyenLieu}</small></td>
                    <td><span className={`food-safety-severity ${severity.tone}`}>{severity.label}</span></td>
                    <td className="food-safety-reason"><strong>{item.loaiSuCo?.replaceAll('_', ' ')}</strong><small>{item.lyDo}</small></td>
                    <td><span className={`food-safety-incident-status ${status.tone}`}>{status.label}</span></td>
                    <td><span className={`food-safety-state ${safety.tone}`}>{safety.label}</span></td>
                    <td>{item.nguoiXuLy || item.nguoiPhatHien || '—'}</td>
                    <td><button type="button" className="food-safety-resolve-btn" onClick={() => openResolve(item)} disabled={resolved}>{resolved ? 'Đã xử lý' : 'Xử lý'}</button></td>
                  </tr>
                );
              }) : <tr><td colSpan="8" className="inventory-empty">Chưa có sự cố lô nguyên liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {reportOpen && selectedBatch && (
        <div className="inventory-modal-backdrop" onMouseDown={() => !saving && setReportOpen(false)}>
          <form className="inventory-modal food-safety-modal" onSubmit={submitIncident} onMouseDown={(event) => event.stopPropagation()}>
            <div className="inventory-modal-head"><div><span>BÁO CÁO SỰ CỐ AN TOÀN</span><h3>{selectedBatch.soLo} · {selectedBatch.tenNguyenLieu}</h3><p>Lô sẽ chuyển sang trạng thái Có sự cố và bị chặn xuất chế biến ngay sau khi xác nhận.</p></div><button type="button" onClick={() => setReportOpen(false)} disabled={saving}><X size={21} /></button></div>
            <div className="inventory-form-grid">
              <label><span>Loại sự cố *</span><select value={reportForm.loaiSuCo} onChange={(event) => setReportForm((value) => ({ ...value, loaiSuCo: event.target.value }))}><option value="NGHI_NGO_CHAT_LUONG">Nghi ngờ chất lượng</option><option value="SAI_NHIET_DO_BAO_QUAN">Sai nhiệt độ bảo quản</option><option value="NHIEM_BAN">Nhiễm bẩn</option><option value="SAI_THONG_TIN_LO">Sai thông tin lô</option><option value="KHAC">Khác</option></select></label>
              <label><span>Mức độ *</span><select value={reportForm.mucDo} onChange={(event) => setReportForm((value) => ({ ...value, mucDo: event.target.value }))}><option value="THAP">Thấp</option><option value="TRUNG_BINH">Trung bình</option><option value="CAO">Cao</option><option value="KHAN_CAP">Khẩn cấp</option></select></label>
              <label className="full"><span>Lý do *</span><textarea rows="4" maxLength="1000" value={reportForm.lyDo} onChange={(event) => setReportForm((value) => ({ ...value, lyDo: event.target.value }))} placeholder="Mô tả dấu hiệu hoặc nguyên nhân phát hiện sự cố..." /></label>
              <label className="full"><span>Ghi chú</span><textarea rows="3" maxLength="1000" value={reportForm.ghiChu} onChange={(event) => setReportForm((value) => ({ ...value, ghiChu: event.target.value }))} placeholder="Hành động ban đầu, thông tin nhà cung cấp..." /></label>
            </div>
            <p className="inventory-form-note inventory-danger-note"><AlertTriangle size={15} /> Sau khi báo cáo, lô sẽ không còn được FEFO chọn để xuất kho hoặc bắt đầu chế biến món.</p>
            <div className="inventory-modal-actions"><button type="button" className="secondary" onClick={() => setReportOpen(false)} disabled={saving}>Hủy</button><button type="submit" className="primary food-safety-danger-action" disabled={saving}>{saving ? 'Đang báo cáo...' : 'Báo cáo và khóa lô'}</button></div>
          </form>
        </div>
      )}

      {resolveTarget && (
        <div className="inventory-modal-backdrop" onMouseDown={() => !saving && setResolveTarget(null)}>
          <form className="inventory-modal food-safety-modal" onSubmit={submitResolution} onMouseDown={(event) => event.stopPropagation()}>
            <div className="inventory-modal-head"><div><span>XỬ LÝ SỰ CỐ</span><h3>{resolveTarget.soLo} · {resolveTarget.tenNguyenLieu}</h3><p>{resolveTarget.lyDo}</p></div><button type="button" onClick={() => setResolveTarget(null)} disabled={saving}><X size={21} /></button></div>
            <div className="inventory-form-grid">
              <label><span>Trạng thái sự cố *</span><select value={resolveForm.trangThaiSuCo} onChange={(event) => setResolveForm((value) => ({ ...value, trangThaiSuCo: event.target.value }))}><option value="DANG_XU_LY">Đang xử lý</option><option value="DA_DONG">Đã đóng</option><option value="DA_THU_HOI">Đã thu hồi</option><option value="DA_TIEU_HUY">Đã tiêu hủy</option></select></label>
              <label><span>Trạng thái an toàn của lô *</span><select value={resolveForm.trangThaiAnToanLo} onChange={(event) => setResolveForm((value) => ({ ...value, trangThaiAnToanLo: event.target.value }))}><option value="AN_TOAN">An toàn</option><option value="KHOA_TAM_THOI">Khóa tạm thời</option><option value="CO_SU_CO">Có sự cố</option><option value="THU_HOI">Thu hồi</option><option value="DA_TIEU_HUY">Đã tiêu hủy</option></select></label>
              <label className="full"><span>Kết quả xử lý *</span><textarea rows="5" maxLength="1000" value={resolveForm.ketQuaXuLy} onChange={(event) => setResolveForm((value) => ({ ...value, ketQuaXuLy: event.target.value }))} placeholder="Ví dụ: Đã kiểm nghiệm, xác nhận đạt yêu cầu và cho phép sử dụng lại..." /></label>
            </div>
            <div className="inventory-modal-actions"><button type="button" className="secondary" onClick={() => setResolveTarget(null)} disabled={saving}>Hủy</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Đang cập nhật...' : 'Lưu kết quả xử lý'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
