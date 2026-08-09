import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  Eye,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  Table2,
  UserCheck,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { reservationApi } from '../../api/reservationApi';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { StaffReservationPreorderModal, preorderStatus, preorderStatusMeta } from './ReservationPreorder';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { normalizePage, pageDisplayRange, paginationItems } from '../../utils/pagination';
import {
  canCheckIn,
  canMarkNoShow,
  reservationData,
  reservationDate,
  reservationDateTime,
  reservationId,
  reservationStatus,
  reservationStatusMeta,
  reservationTime,
} from '../../utils/reservations';

const STATUS_OPTIONS = [
  ['', 'Tất cả trạng thái'],
  ['CHO_XAC_NHAN', 'Chờ xác nhận'],
  ['DA_XAC_NHAN', 'Đã xác nhận'],
  ['KHACH_DA_DEN', 'Khách đã đến'],
  ['DA_XEP_BAN', 'Đã xếp bàn'],
  ['HOAN_THANH', 'Hoàn thành'],
  ['DA_HUY', 'Đã hủy'],
  ['TU_CHOI', 'Từ chối'],
  ['KHONG_DEN', 'Không đến'],
  ['HET_HAN', 'Hết hạn'],
];

const today = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function ActionButton({ children, tone = '', ...props }) {
  return <button type="button" className={`reservation-action-button ${tone}`} {...props}>{children}</button>;
}

function DetailModal({ item, onClose, defaultDurationMinutes = 120 }) {
  const meta = reservationStatusMeta(item);
  const lines = [
    ['Mã tra cứu', item?.maTraCuu],
    ['Khách hàng', item?.hoTenKhach],
    ['Số điện thoại', item?.soDienThoai],
    ['Ngày giờ đến', reservationDateTime(item?.ngayGioDen)],
    ['Số lượng khách', `${item?.soLuongKhach || 0} người`],
    ['Thời lượng', `${item?.thoiLuongPhut || defaultDurationMinutes} phút`],
    ['Khu vực mong muốn', item?.khuVucMongMuon || 'Không yêu cầu'],
    ['Bàn dự kiến', item?.tenBanDuKien || 'Chưa chọn'],
    ['Bàn thực tế', item?.tenBanThucTe || 'Chưa xếp'],
    ['Người xác nhận', item?.tenNguoiXacNhan || '—'],
    ['Người check-in', item?.tenNguoiCheckIn || '—'],
    ['Người xếp bàn', item?.tenNguoiXepBan || '—'],
    ['Món đặt trước', Number(item?.soMonDatTruoc || 0) ? `${item.soMonDatTruoc} loại món` : 'Chưa đặt'],
    ['Trạng thái món trước', preorderStatusMeta(item?.trangThaiDatMonTruoc).label],
  ];
  return (
    <section className="reservation-manage-modal reservation-detail-modal" role="dialog" aria-modal="true">
      <header><div><span>CHI TIẾT ĐẶT BÀN</span><h2>{item?.maTraCuu} · {item?.hoTenKhach}</h2><p>Tạo lúc {reservationDateTime(item?.thoiGianTao)}</p></div><button type="button" onClick={onClose}><X size={20} /></button></header>
      <div className="reservation-detail-status"><span className={`reservation-status-badge ${meta.tone}`}>{meta.label}</span>{item?.maDonHang ? <b>Đã liên kết đơn #{item.maDonHang}</b> : null}</div>
      <div className="reservation-detail-grid">{lines.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value || '—'}</strong></p>)}</div>
      {item?.ghiChu ? <div className="reservation-detail-note"><b>Ghi chú:</b> {item.ghiChu}</div> : null}
      {item?.lyDoHuyTuChoi ? <div className="reservation-detail-reason"><b>Lý do kết thúc:</b> {item.lyDoHuyTuChoi}</div> : null}
      <footer><button type="button" onClick={onClose}>Đóng</button></footer>
    </section>
  );
}

function TableSelectModal({ action, item, tables, loadingTables, selectedTable, setSelectedTable, note, setNote, busy, onSubmit, onClose }) {
  const isConfirm = action === 'confirm';
  return (
    <section className="reservation-manage-modal reservation-table-modal" role="dialog" aria-modal="true">
      <header><div><span>{isConfirm ? 'XÁC NHẬN ĐẶT BÀN' : 'XẾP BÀN THỰC TẾ'}</span><h2>{item?.maTraCuu} · {item?.hoTenKhach}</h2><p>{item?.soLuongKhach} khách · {reservationDateTime(item?.ngayGioDen)}</p></div><button type="button" onClick={onClose} disabled={busy}><X size={20} /></button></header>
      <div className="reservation-table-intro"><Table2 size={20} /><p>{isConfirm ? 'Chọn bàn hoặc nhóm bàn ghép dự kiến phù hợp. Bàn chưa chuyển sang đang sử dụng cho đến khi khách check-in và được xếp bàn.' : 'Chọn bàn hoặc nhóm bàn ghép đang trống để bắt đầu phiên phục vụ cho khách.'}</p></div>
      <div className="reservation-table-list">
        {loadingTables ? <div className="reservation-modal-loading"><LoaderCircle className="spin" size={22} /> Đang kiểm tra bàn khả dụng...</div>
          : tables.length ? tables.map((table) => {
            const actualTableReady = isConfirm || String(table?.trangThai || '').toUpperCase() === 'TRONG';
            const available = Boolean(table?.khaDung) && actualTableReady;
            const availabilityLabel = !table?.khaDung ? 'Đã có lịch trùng' : !actualTableReady ? 'Bàn đang sử dụng' : 'Khả dụng';
            return (
              <button type="button" key={table?.maBan} className={`${Number(selectedTable) === Number(table?.maBan) ? 'active' : ''} ${!available ? 'unavailable' : ''}`} disabled={!available} onClick={() => setSelectedTable(table.maBan)}>
                <span><Table2 size={19} /></span><div><strong>{table?.tenBan || `Bàn ${table?.maBan}`}</strong><small>{table?.khuVuc || 'Chưa có khu vực'} · {table?.sucChua || 0} chỗ</small></div><em>{availabilityLabel}</em>
              </button>
            );
          }) : <div className="reservation-modal-empty">Không có bàn hoặc nhóm bàn phù hợp trong khung giờ này. Với đoàn đông, hãy ghép các bàn phù hợp trước khi xác nhận.</div>}
      </div>
      {isConfirm ? <label className="reservation-modal-field">Ghi chú xác nhận<textarea rows="3" maxLength="500" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Không bắt buộc" /></label> : null}
      <footer><button type="button" onClick={onClose} disabled={busy}>Quay lại</button><button type="button" className="primary" onClick={onSubmit} disabled={busy || !selectedTable}>{busy ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}{isConfirm ? 'Xác nhận đặt bàn' : 'Xếp bàn'}</button></footer>
    </section>
  );
}

function ReasonModal({ action, item, reason, setReason, busy, onSubmit, onClose }) {
  const rejecting = action === 'reject';
  return (
    <section className="reservation-manage-modal reservation-reason-modal" role="dialog" aria-modal="true">
      <header><div><span>{rejecting ? 'TỪ CHỐI ĐẶT BÀN' : 'HỦY ĐẶT BÀN'}</span><h2>{item?.maTraCuu} · {item?.hoTenKhach}</h2><p>{reservationDateTime(item?.ngayGioDen)} · {item?.soLuongKhach} khách</p></div><button type="button" onClick={onClose} disabled={busy}><X size={20} /></button></header>
      <div className={`reservation-reason-alert ${rejecting ? 'reject' : 'cancel'}`}><XCircle size={22} /><p>{rejecting ? 'Khách sẽ nhận trạng thái từ chối cùng lý do bên dưới.' : 'Lịch đặt bàn sẽ kết thúc. Hãy kiểm tra kỹ trước khi xác nhận.'}</p></div>
      <label className="reservation-modal-field">{rejecting ? 'Lý do từ chối' : 'Lý do hủy'}<textarea autoFocus rows="4" maxLength="500" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={rejecting ? 'Ví dụ: Không còn bàn phù hợp trong khung giờ' : 'Nhập lý do hủy đặt bàn'} /></label>
      <footer><button type="button" onClick={onClose} disabled={busy}>Quay lại</button><button type="button" className="danger" onClick={onSubmit} disabled={busy || !reason.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />}{rejecting ? 'Xác nhận từ chối' : 'Xác nhận hủy'}</button></footer>
    </section>
  );
}

function SimpleConfirmModal({ action, item, busy, onSubmit, onClose }) {
  const config = {
    'check-in': { title: 'Xác nhận khách đã đến?', text: 'Sau khi check-in, nhân viên có thể chọn bàn thực tế để phục vụ khách.', button: 'Xác nhận check-in', icon: UserCheck },
    'no-show': { title: 'Đánh dấu khách không đến?', text: 'Lịch sẽ kết thúc với trạng thái không đến và bàn dự kiến được giải phóng.', button: 'Xác nhận không đến', icon: CalendarClock },
  }[action];
  const Icon = config.icon;
  return (
    <section className="reservation-manage-modal reservation-simple-modal" role="dialog" aria-modal="true">
      <button type="button" className="close" onClick={onClose} disabled={busy}><X size={20} /></button>
      <span><Icon size={27} /></span><h2>{config.title}</h2><p><b>{item?.maTraCuu}</b> · {item?.hoTenKhach}<br />{config.text}</p>
      <div><button type="button" onClick={onClose} disabled={busy}>Quay lại</button><button type="button" className={action === 'no-show' ? 'danger' : 'primary'} onClick={onSubmit} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}{config.button}</button></div>
    </section>
  );
}

export default function ReservationManagement({ role = 'admin' }) {
  const toast = useToast();
  const topics = role === 'admin' ? ['/topic/admin/reservations', '/topic/reservations'] : ['/topic/reservations'];
  const socketEvent = useWebSocket(topics);
  const [rows, setRows] = useState([]);
  const [areas, setAreas] = useState([]);
  const [reservationPolicy, setReservationPolicy] = useState({
    defaultDurationMinutes: 120,
    noShowGraceMinutes: 15,
    checkInEarlyMinutes: 30,
  });
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [area, setArea] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [numberOfElements, setNumberOfElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    reservationApi.publicAreas().then((response) => {
      const data = reservationData(response);
      setAreas(Array.isArray(data) ? data : []);
    }).catch(() => setAreas([]));

    systemSettingApi.getPublic().then((response) => {
      const settings = systemSettingData(response);
      setReservationPolicy({
        defaultDurationMinutes: Number(settings?.reservationDefaultDurationMinutes) || 120,
        noShowGraceMinutes: Math.max(Number(settings?.reservationNoShowGraceMinutes) || 0, 0),
        checkInEarlyMinutes: Math.max(Number(settings?.reservationCheckInEarlyMinutes) || 0, 0),
      });
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (from && to && from > to) {
      toast.error('Ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }
    try {
      setLoading(true);
      const response = await reservationApi.list({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        keyword: keyword || undefined,
        area: role === 'admin' ? area || undefined : undefined,
        page,
        size,
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
      toast.error(errorMessageOf(error, 'Không thể tải danh sách đặt bàn.'));
    } finally {
      setLoading(false);
    }
  }, [area, from, keyword, page, role, size, status, to, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (socketEvent?.topic?.includes('reservations')) load(); }, [load, socketEvent]);

  useEffect(() => {
    if (!modal && !detail) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event) => { if (event.key === 'Escape' && !busy) { setModal(null); setDetail(null); } };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); };
  }, [busy, detail, modal]);

  const stats = useMemo(() => ({
    total: totalElements,
    pending: rows.filter((item) => reservationStatus(item) === 'CHO_XAC_NHAN').length,
    upcoming: rows.filter((item) => reservationStatus(item) === 'DA_XAC_NHAN').length,
    arrived: rows.filter((item) => ['KHACH_DA_DEN', 'DA_XEP_BAN'].includes(reservationStatus(item))).length,
  }), [rows, totalElements]);

  const range = pageDisplayRange(page, size, numberOfElements, totalElements);
  const pageItems = paginationItems(page, totalPages);

  async function openDetail(item) {
    try {
      setBusy(true);
      const response = await reservationApi.detail(reservationId(item));
      setDetail(reservationData(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải chi tiết đặt bàn.'));
    } finally {
      setBusy(false);
    }
  }

  async function loadAvailableTables(item) {
    try {
      setLoadingTables(true);
      const response = await reservationApi.availableTables({
        arrival: item?.ngayGioDen,
        partySize: item?.soLuongKhach,
        durationMinutes: item?.thoiLuongPhut || reservationPolicy.defaultDurationMinutes,
        area: item?.khuVucMongMuon || undefined,
        excludeReservationId: reservationId(item),
      });
      const data = reservationData(response);
      setTables(Array.isArray(data) ? data : []);
    } catch (error) {
      setTables([]);
      toast.error(errorMessageOf(error, 'Không thể tải danh sách bàn khả dụng.'));
    } finally {
      setLoadingTables(false);
    }
  }

  function openAction(action, item) {
    setSelectedTable(action === 'confirm' ? item?.maBanDuKien || '' : item?.maBanThucTe || item?.maBanDuKien || '');
    setNote('');
    setReason('');
    setModal({ action, item });
    if (['confirm', 'assign'].includes(action)) loadAvailableTables(item);
  }

  async function submitAction() {
    if (!modal) return;
    const { action, item } = modal;
    const id = reservationId(item);
    try {
      setBusy(true);
      let response;
      if (action === 'confirm') response = await reservationApi.confirm(id, { maBanDuKien: Number(selectedTable), ghiChu: note.trim() || null });
      if (action === 'assign') response = await reservationApi.assignTable(id, Number(selectedTable));
      if (action === 'reject') response = await reservationApi.reject(id, reason.trim());
      if (action === 'cancel') response = await reservationApi.staffCancel(id, reason.trim());
      if (action === 'check-in') response = await reservationApi.checkIn(id);
      if (action === 'no-show') response = await reservationApi.noShow(id);
      toast.success(messageOf(response, 'Đã cập nhật đặt bàn.'));
      setModal(null);
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật đặt bàn.'));
    } finally {
      setBusy(false);
    }
  }

  function resetFilters() {
    setStatus(''); setArea(''); setFrom(today()); setTo(today()); setKeywordInput(''); setKeyword(''); setPage(0);
  }

  return (
    <section className="reservation-manage-page">
      <div className="reservation-manage-stats">
        <article><span className="orange"><CalendarCheck2 size={22} /></span><p>Tổng lịch theo bộ lọc<strong>{stats.total}</strong></p></article>
        <article><span className="warning"><Clock3 size={22} /></span><p>Chờ xác nhận trên trang<strong>{stats.pending}</strong></p></article>
        <article><span className="blue"><CalendarClock size={22} /></span><p>Sắp đến trên trang<strong>{stats.upcoming}</strong></p></article>
        <article><span className="green"><UserCheck size={22} /></span><p>Đã đến/xếp bàn<strong>{stats.arrived}</strong></p></article>
      </div>

      <div className="reservation-manage-card">
        <div className="reservation-manage-toolbar">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUS_OPTIONS.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}</select>
          <label><CalendarDays size={16} /><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></label>
          <label><CalendarDays size={16} /><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></label>
          {role === 'admin' ? <label><MapPin size={16} /><select value={area} onChange={(e) => { setArea(e.target.value); setPage(0); }}><option value="">Tất cả khu vực</option>{areas.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
          <form onSubmit={(event) => { event.preventDefault(); setKeyword(keywordInput.trim()); setPage(0); }}><Search size={17} /><input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} placeholder="Mã, tên khách, số điện thoại..." /><button type="submit">Tìm</button></form>
          <button type="button" className="reservation-refresh" onClick={load} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={17} /> Tải lại</button>
          <button type="button" className="reservation-reset" onClick={resetFilters}>Đặt lại</button>
        </div>

        <div className="reservation-manage-table-wrap">
          <table className="reservation-manage-table">
            <thead><tr><th>Thời gian</th><th>Khách hàng</th><th>Số khách</th><th>Khu vực/Bàn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading && !rows.length ? <tr><td colSpan="6" className="reservation-manage-empty"><LoaderCircle className="spin" size={22} /> Đang tải lịch đặt bàn...</td></tr>
                : rows.length ? rows.map((item) => {
                  const statusValue = reservationStatus(item);
                  const meta = reservationStatusMeta(statusValue);
                  return (
                    <tr key={reservationId(item)}>
                      <td><strong>{reservationTime(item?.ngayGioDen)}</strong><small>{reservationDate(item?.ngayGioDen)}</small><em>{item?.thoiLuongPhut || reservationPolicy.defaultDurationMinutes} phút</em></td>
                      <td><b>{item?.hoTenKhach}</b><small>{item?.soDienThoai}</small><em>{item?.maTraCuu}</em></td>
                      <td><span className="reservation-party"><UsersRound size={15} /> {item?.soLuongKhach}</span></td>
                      <td><strong>{item?.khuVucMongMuon || 'Không yêu cầu'}</strong><small>Dự kiến: {item?.tenBanDuKien || 'Chưa chọn'}</small><small>Thực tế: {item?.tenBanThucTe || 'Chưa xếp'}</small></td>
                      <td><span className={`reservation-status-badge ${meta.tone}`}>{meta.label}</span>{preorderStatus(item?.trangThaiDatMonTruoc) !== 'CHUA_DAT' ? <small className={`reservation-preorder-mini ${preorderStatusMeta(item?.trangThaiDatMonTruoc).tone}`}><ChefHat size={12} /> {preorderStatusMeta(item?.trangThaiDatMonTruoc).label}</small> : null}{item?.lyDoHuyTuChoi ? <small className="reservation-end-reason">{item.lyDoHuyTuChoi}</small> : null}</td>
                      <td><div className="reservation-row-actions">
                        <ActionButton onClick={() => openDetail(item)}><Eye size={15} /> Xem</ActionButton>
                        {Number(item?.soMonDatTruoc || 0) > 0 || preorderStatus(item?.trangThaiDatMonTruoc) !== 'CHUA_DAT' ? <ActionButton tone="preorder" onClick={() => openAction('preorder', item)}><ChefHat size={15} /> Món đặt trước</ActionButton> : null}
                        {statusValue === 'CHO_XAC_NHAN' ? <><ActionButton tone="primary" onClick={() => openAction('confirm', item)}><CheckCircle2 size={15} /> Xác nhận</ActionButton><ActionButton tone="danger" onClick={() => openAction('reject', item)}><XCircle size={15} /> Từ chối</ActionButton></> : null}
                        {statusValue === 'DA_XAC_NHAN' ? <>
                          {canCheckIn(item, reservationPolicy.checkInEarlyMinutes, reservationPolicy.noShowGraceMinutes, clockTick)
                            ? <ActionButton tone="primary" onClick={() => openAction('check-in', item)}><UserCheck size={15} /> Check-in</ActionButton>
                            : null}
                          {canMarkNoShow(item, reservationPolicy.noShowGraceMinutes, clockTick)
                            ? <ActionButton tone="warning" onClick={() => openAction('no-show', item)}><CalendarClock size={15} /> Không đến</ActionButton>
                            : null}
                        </> : null}
                        {statusValue === 'KHACH_DA_DEN' ? <ActionButton tone="primary" onClick={() => openAction('assign', item)}><Table2 size={15} /> Xếp bàn</ActionButton> : null}
                        {['CHO_XAC_NHAN', 'DA_XAC_NHAN', 'KHACH_DA_DEN'].includes(statusValue) ? <ActionButton tone="muted-danger" onClick={() => openAction('cancel', item)}>Hủy</ActionButton> : null}
                      </div></td>
                    </tr>
                  );
                }) : <tr><td colSpan="6" className="reservation-manage-empty">Không có lịch đặt bàn phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="reservation-manage-footer">
          <div>Hiển thị {range.from}–{range.to} trong {totalElements} lịch</div>
          <label>Hiển thị <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
          <div className="reservation-manage-pagination"><button type="button" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>‹</button>{pageItems.map((value) => <button type="button" key={value} className={value === page ? 'active' : ''} onClick={() => setPage(value)}>{value + 1}</button>)}<button type="button" disabled={totalPages === 0 || page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>›</button></div>
        </div>
      </div>

      {(modal || detail) ? createPortal(
        <div className="reservation-manage-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && (setModal(null), setDetail(null))}>
          {detail ? <DetailModal item={detail} defaultDurationMinutes={reservationPolicy.defaultDurationMinutes} onClose={() => setDetail(null)} /> : null}
          {modal && ['confirm', 'assign'].includes(modal.action) ? <TableSelectModal action={modal.action} item={modal.item} tables={tables} loadingTables={loadingTables} selectedTable={selectedTable} setSelectedTable={setSelectedTable} note={note} setNote={setNote} busy={busy} onSubmit={submitAction} onClose={() => setModal(null)} /> : null}
          {modal && ['reject', 'cancel'].includes(modal.action) ? <ReasonModal action={modal.action} item={modal.item} reason={reason} setReason={setReason} busy={busy} onSubmit={submitAction} onClose={() => setModal(null)} /> : null}
          {modal && ['check-in', 'no-show'].includes(modal.action) ? <SimpleConfirmModal action={modal.action} item={modal.item} busy={busy} onSubmit={submitAction} onClose={() => setModal(null)} /> : null}
          {modal?.action === 'preorder' ? <StaffReservationPreorderModal item={modal.item} onClose={() => setModal(null)} onUpdated={load} /> : null}
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
