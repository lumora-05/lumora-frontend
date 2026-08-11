import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBasket,
  Trash2,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { menuApi } from '../../api/menuApi';
import { reservationApi } from '../../api/reservationApi';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import { reservationData, reservationDateTime, reservationStatus } from '../../utils/reservations';

export const PREORDER_STATUS_META = {
  CHUA_DAT: { label: 'Chưa đặt món', tone: 'neutral' },
  CHO_XAC_NHAN: { label: 'Chờ duyệt thực đơn', tone: 'pending' },
  DA_XAC_NHAN: { label: 'Đã duyệt thực đơn', tone: 'confirmed' },
  TU_CHOI: { label: 'Cần điều chỉnh', tone: 'rejected' },
  DA_CHUYEN_BEP: { label: 'Đã chuyển xuống bếp', tone: 'sent' },
  DA_HUY: { label: 'Đã hủy món đặt trước', tone: 'cancelled' },
};

export function preorderStatus(value) {
  return String(value || 'CHUA_DAT').trim().toUpperCase() || 'CHUA_DAT';
}

export function preorderStatusMeta(value) {
  const status = preorderStatus(typeof value === 'object' ? value?.trangThaiDatMonTruoc : value);
  return PREORDER_STATUS_META[status] || { label: status, tone: 'neutral' };
}

function unwrapList(response) {
  const value = reservationData(response);
  return Array.isArray(value) ? value : [];
}

function foodId(food) {
  return Number(food?.maMonAn ?? food?.id);
}

function foodName(food) {
  return food?.tenMonAn || food?.name || 'Món ăn';
}

function foodPrice(food) {
  return Number(food?.gia ?? food?.donGia ?? 0);
}

function buildSelection(preorder) {
  const result = {};
  (preorder?.items || []).forEach((item) => {
    const id = Number(item?.maMonAn);
    if (!Number.isFinite(id)) return;
    result[id] = {
      quantity: Number(item?.soLuong || 1),
      note: item?.ghiChu || '',
    };
  });
  return result;
}

function PreorderItems({ preorder }) {
  const items = Array.isArray(preorder?.items) ? preorder.items : [];
  if (!items.length) return <div className="reservation-preorder-empty">Chưa có món nào trong thực đơn đặt trước.</div>;
  return (
    <div className="reservation-preorder-items">
      {items.map((item) => (
        <article key={item?.maChiTietDatMonTruoc || item?.maMonAn}>
          <div className="reservation-preorder-item-image">
            {item?.hinhAnh ? <img src={imageUrl(item.hinhAnh)} alt={item?.tenMonAn || 'Món ăn'} /> : <UtensilsCrossed size={21} />}
          </div>
          <div>
            <strong>{item?.tenMonAn || 'Món ăn'}</strong>
            <small>{formatMoney(item?.donGia)} × {item?.soLuong || 0}</small>
            {item?.ghiChu ? <em>Ghi chú: {item.ghiChu}</em> : null}
          </div>
          <b>{formatMoney(item?.thanhTien)}</b>
        </article>
      ))}
    </div>
  );
}

function MenuEditorModal({ reservation, code, phone, current, onSaved, onClose, draftMode = false }) {
  const toast = useToast();
  const [foods, setFoods] = useState([]);
  const [selection, setSelection] = useState(() => buildSelection(current));
  const [generalNote, setGeneralNote] = useState(current?.ghiChuDatMonTruoc || '');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      menuApi.getActive({ skipAuth: true }),
      draftMode ? Promise.resolve(null) : reservationApi.customerPreorderDetail(code, phone).catch(() => null),
    ]).then(([menuResponse, preorderResponse]) => {
      if (cancelled) return;
      setFoods(unwrapList(menuResponse));
      const latest = preorderResponse ? reservationData(preorderResponse) : current;
      setSelection(buildSelection(latest));
      setGeneralNote(latest?.ghiChuDatMonTruoc || '');
    }).catch((error) => {
      if (!cancelled) toast.error(errorMessageOf(error, 'Không thể tải thực đơn.'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [code, current, draftMode, phone, toast]);

  const filteredFoods = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return foods;
    return foods.filter((food) => foodName(food).toLowerCase().includes(keyword));
  }, [foods, query]);

  const selectedEntries = useMemo(() => Object.entries(selection)
    .filter(([, value]) => Number(value?.quantity) > 0), [selection]);

  const total = useMemo(() => selectedEntries.reduce((sum, [id, value]) => {
    const food = foods.find((item) => foodId(item) === Number(id));
    return sum + foodPrice(food) * Number(value.quantity || 0);
  }, 0), [foods, selectedEntries]);

  function changeQuantity(food, delta) {
    const id = foodId(food);
    setSelection((currentSelection) => {
      const old = currentSelection[id] || { quantity: 0, note: '' };
      const quantity = Math.max(0, Number(old.quantity || 0) + delta);
      if (!quantity) {
        const next = { ...currentSelection };
        delete next[id];
        return next;
      }
      return { ...currentSelection, [id]: { ...old, quantity } };
    });
  }

  function updateItemNote(id, note) {
    setSelection((currentSelection) => ({
      ...currentSelection,
      [id]: { ...(currentSelection[id] || { quantity: 1 }), note },
    }));
  }

  async function save() {
    if (!selectedEntries.length) {
      toast.error('Vui lòng chọn ít nhất một món.');
      return;
    }
    const items = selectedEntries.map(([id, value]) => ({
      maMonAn: Number(id),
      soLuong: Number(value.quantity),
      ghiChu: value.note?.trim() || null,
    }));
    try {
      setBusy(true);
      if (draftMode) {
        const draftItems = items.map((item) => {
          const food = foods.find((candidate) => foodId(candidate) === item.maMonAn);
          const donGia = foodPrice(food);
          return {
            ...item,
            tenMonAn: foodName(food),
            hinhAnh: food?.hinhAnh || null,
            donGia,
            thanhTien: donGia * item.soLuong,
          };
        });
        onSaved({
          trangThaiDatMonTruoc: 'CHUA_DAT',
          ghiChuDatMonTruoc: generalNote.trim() || null,
          tongTienDuKien: total,
          items: draftItems,
        });
        onClose();
        return;
      }
      const response = await reservationApi.customerSavePreorder(code, phone, {
        ghiChu: generalNote.trim() || null,
        items,
      });
      toast.success(messageOf(response, 'Đã gửi thực đơn đặt trước cho nhà hàng.'));
      onSaved(reservationData(response));
      onClose();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể lưu thực đơn đặt trước.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="reservation-preorder-modal customer" role="dialog" aria-modal="true">
      <header>
        <div><span>ĐẶT MÓN TRƯỚC</span><h2>{draftMode ? 'Chọn món cho yêu cầu đặt bàn' : `Chọn món cho lịch ${reservation?.maTraCuu}`}</h2><p>Món chỉ được chuyển xuống bếp sau khi bạn check-in và được xếp bàn.</p></div>
        <button type="button" onClick={onClose} disabled={busy}><X size={20} /></button>
      </header>
      <div className="reservation-preorder-editor-toolbar">
        <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm món ăn..." /></label>
        <div><ShoppingBasket size={17} /><span>{selectedEntries.reduce((sum, [, item]) => sum + Number(item.quantity || 0), 0)} món</span><b>{formatMoney(total)}</b></div>
      </div>
      <div className="reservation-preorder-menu-list">
        {loading ? <div className="reservation-preorder-loading"><LoaderCircle className="spin" size={25} /> Đang tải thực đơn...</div>
          : filteredFoods.length ? filteredFoods.map((food) => {
            const id = foodId(food);
            const selected = selection[id];
            const quantity = Number(selected?.quantity || 0);
            return (
              <article key={id} className={quantity ? 'selected' : ''}>
                <div className="reservation-preorder-food-image">
                  {food?.hinhAnh ? <img src={imageUrl(food.hinhAnh)} alt={foodName(food)} /> : <UtensilsCrossed size={24} />}
                </div>
                <div className="reservation-preorder-food-main">
                  <strong>{foodName(food)}</strong>
                  <small>{food?.danhMuc?.tenDanhMuc || 'Món ăn'}</small>
                  <b>{formatMoney(foodPrice(food))}</b>
                  {quantity ? <input maxLength="250" value={selected?.note || ''} onChange={(event) => updateItemNote(id, event.target.value)} placeholder="Ghi chú cho món (không bắt buộc)" /> : null}
                </div>
                <div className="reservation-preorder-quantity">
                  <button type="button" onClick={() => changeQuantity(food, -1)} disabled={!quantity || busy}><Minus size={15} /></button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => changeQuantity(food, 1)} disabled={busy}><Plus size={15} /></button>
                </div>
              </article>
            );
          }) : <div className="reservation-preorder-empty">Không tìm thấy món phù hợp.</div>}
      </div>
      <label className="reservation-preorder-general-note">Ghi chú chung<textarea rows="3" maxLength="500" value={generalNote} onChange={(event) => setGeneralNote(event.target.value)} placeholder="Ví dụ: chuẩn bị ít cay, phục vụ món khai vị trước..." /></label>
      <footer>
        <button type="button" onClick={onClose} disabled={busy}>Quay lại</button>
        <button type="button" className="primary" onClick={save} disabled={busy || loading || !selectedEntries.length}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {draftMode ? 'Lưu lựa chọn' : 'Gửi nhà hàng duyệt'}</button>
      </footer>
    </section>
  );
}

function CancelPreorderModal({ code, phone, onCancelled, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!reason.trim()) return;
    try {
      setBusy(true);
      const response = await reservationApi.customerCancelPreorder(code, phone, reason.trim());
      toast.success(messageOf(response, 'Đã hủy thực đơn đặt trước.'));
      onCancelled(reservationData(response));
      onClose();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể hủy thực đơn đặt trước.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reservation-manage-modal reservation-reason-modal" role="dialog" aria-modal="true">
      <header><div><span>HỦY MÓN ĐẶT TRƯỚC</span><h2>Xác nhận hủy thực đơn?</h2><p>Lịch đặt bàn vẫn được giữ nguyên.</p></div><button type="button" onClick={onClose} disabled={busy}><X size={20} /></button></header>
      <div className="reservation-reason-alert cancel"><XCircle size={22} /><p>Thao tác này chỉ hủy danh sách món đã chọn trước, không hủy lịch đặt bàn.</p></div>
      <label className="reservation-modal-field">Lý do hủy<textarea autoFocus rows="4" maxLength="500" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do hủy món đặt trước..." /></label>
      <footer><button type="button" onClick={onClose} disabled={busy}>Quay lại</button><button type="button" className="danger" onClick={submit} disabled={busy || !reason.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />} Xác nhận hủy</button></footer>
    </section>
  );
}

export function ReservationPreorderDraftModal({ current, onSaved, onClose }) {
  return (
    <MenuEditorModal
      reservation={null}
      code=""
      phone=""
      current={current}
      onSaved={onSaved}
      onClose={onClose}
      draftMode
    />
  );
}

export function CustomerReservationPreorder({ reservation, code, phone, onChanged }) {
  const toast = useToast();
  const [preorder, setPreorder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!code || !phone || !reservation) return;
    try {
      if (!silent) setLoading(true);
      const response = await reservationApi.customerPreorderDetail(code, phone);
      setPreorder(reservationData(response));
    } catch (error) {
      if (!silent) toast.error(errorMessageOf(error, 'Không thể tải thông tin món đặt trước.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [code, phone, reservation, toast]);

  useEffect(() => { load(true); }, [load, reservation?.trangThaiDatMonTruoc, reservation?.thoiGianCapNhat]);

  useEffect(() => {
    if (!editorOpen && !cancelOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event) => {
      if (event.key === 'Escape') {
        setEditorOpen(false);
        setCancelOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); };
  }, [cancelOpen, editorOpen]);

  const status = preorderStatus(preorder?.trangThaiDatMonTruoc || reservation?.trangThaiDatMonTruoc);
  const meta = preorderStatusMeta(status);
  const bookingStatus = reservationStatus(reservation);
  const itemCount = Number(preorder?.items?.length || reservation?.soMonDatTruoc || 0);
  const total = preorder?.tongTienDuKien ?? reservation?.tongTienDatTruocDuKien ?? 0;
  const editable = ['CHO_XAC_NHAN', 'DA_XAC_NHAN'].includes(bookingStatus)
    && !['DA_CHUYEN_BEP', 'DA_HUY'].includes(status);
  const cancellable = itemCount > 0 && !['DA_CHUYEN_BEP', 'DA_HUY', 'CHUA_DAT'].includes(status);
  const shouldShow = ['CHO_XAC_NHAN', 'DA_XAC_NHAN'].includes(bookingStatus)
    || itemCount > 0 || status !== 'CHUA_DAT';

  if (!shouldShow) return null;

  function handleChanged(value) {
    setPreorder(value);
    onChanged?.();
  }

  return (
    <>
      <section className="reservation-public-preorder-card">
        <header>
          <div><span><ChefHat size={19} /></span><div><h3>Đặt món trước</h3><p>Chọn món ngay khi gửi yêu cầu đặt bàn. Món chưa chuyển xuống bếp cho đến khi bạn đến và được xếp bàn.</p></div></div>
          <span className={`reservation-preorder-status ${meta.tone}`}>{meta.label}</span>
        </header>
        {loading ? <div className="reservation-preorder-inline-loading"><LoaderCircle className="spin" size={20} /> Đang tải thực đơn đặt trước...</div> : (
          <>
            {bookingStatus === 'CHO_XAC_NHAN' && itemCount > 0 ? <div className="reservation-preorder-approved"><Clock3 size={19} /><p>Món đã được lưu cùng yêu cầu đặt bàn và đang chờ nhà hàng xử lý. Món chưa được gửi xuống bếp.</p></div> : null}
            {status === 'TU_CHOI' && preorder?.lyDoTuChoiDatMonTruoc ? <div className="reservation-preorder-alert"><AlertTriangle size={19} /><p><b>Nhà hàng yêu cầu điều chỉnh:</b> {preorder.lyDoTuChoiDatMonTruoc}</p></div> : null}
            {status === 'DA_XAC_NHAN' ? <div className="reservation-preorder-approved"><CheckCircle2 size={19} /><p>Nhà hàng đã duyệt thực đơn. Món chỉ được chuyển xuống bếp sau khi bạn đến và được xếp bàn.</p></div> : null}
            {status === 'DA_CHUYEN_BEP' ? <div className="reservation-preorder-approved"><ChefHat size={19} /><p>Món đặt trước đã chuyển xuống bếp{preorder?.maDonHang ? ` thành đơn #${preorder.maDonHang}` : ''}.</p></div> : null}
            {itemCount > 0 && preorder ? <PreorderItems preorder={preorder} /> : <div className="reservation-preorder-empty compact">Bạn chưa chọn món cho lịch đặt bàn này.</div>}
            {itemCount > 0 ? <div className="reservation-preorder-summary"><span>{itemCount} loại món</span><strong>Tạm tính: {formatMoney(total)}</strong></div> : null}
            {preorder?.ghiChuDatMonTruoc ? <div className="reservation-preorder-note"><b>Ghi chú chung:</b> {preorder.ghiChuDatMonTruoc}</div> : null}
            {preorder?.thoiGianDuKienChuyenBep ? <div className="reservation-preorder-kitchen-time"><Clock3 size={16} /> Mốc chuẩn bị tham khảo: {reservationDateTime(preorder.thoiGianDuKienChuyenBep)}</div> : null}
          </>
        )}
        {(editable || cancellable) ? <footer>
          {editable ? <button type="button" className="primary" onClick={() => setEditorOpen(true)}><ShoppingBasket size={17} /> {itemCount ? 'Chỉnh sửa món' : 'Chọn món trước'}</button> : null}
          {cancellable ? <button type="button" className="danger" onClick={() => setCancelOpen(true)}><Trash2 size={16} /> Hủy món đặt trước</button> : null}
        </footer> : null}
      </section>

      {editorOpen ? createPortal(
        <div className="reservation-manage-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}>
          <MenuEditorModal reservation={reservation} code={code} phone={phone} current={preorder} onSaved={handleChanged} onClose={() => setEditorOpen(false)} />
        </div>, document.body,
      ) : null}
      {cancelOpen ? createPortal(
        <div className="reservation-manage-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCancelOpen(false)}>
          <CancelPreorderModal code={code} phone={phone} onCancelled={handleChanged} onClose={() => setCancelOpen(false)} />
        </div>, document.body,
      ) : null}
    </>
  );
}

export function StaffReservationPreorderModal({ item, onClose, onUpdated }) {
  const toast = useToast();
  const [preorder, setPreorder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preparationMinutes, setPreparationMinutes] = useState(30);
  const [confirmNote, setConfirmNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await reservationApi.preorderDetail(item?.maDatBan ?? item?.id);
      setPreorder(reservationData(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tải thực đơn đặt trước.'));
    } finally {
      setLoading(false);
    }
  }, [item, toast]);

  useEffect(() => { load(); }, [load]);

  async function runAction(type) {
    const id = item?.maDatBan ?? item?.id;
    try {
      setBusy(true);
      let response;
      if (type === 'confirm') response = await reservationApi.preorderConfirm(id, {
        soPhutChuanBiTruoc: Number(preparationMinutes),
        ghiChu: confirmNote.trim() || null,
      });
      if (type === 'reject') response = await reservationApi.preorderReject(id, rejectReason.trim());
      if (type === 'send') response = await reservationApi.preorderSendToKitchen(id);
      const data = reservationData(response);
      setPreorder(data);
      toast.success(messageOf(response, 'Đã cập nhật thực đơn đặt trước.'));
      onUpdated?.();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể xử lý thực đơn đặt trước.'));
    } finally {
      setBusy(false);
    }
  }

  const status = preorderStatus(preorder?.trangThaiDatMonTruoc || item?.trangThaiDatMonTruoc);
  const meta = preorderStatusMeta(status);
  const bookingStatus = reservationStatus(item);
  const canApprove = status === 'CHO_XAC_NHAN'
    && ['DA_XAC_NHAN', 'KHACH_DA_DEN', 'DA_XEP_BAN'].includes(bookingStatus);
  const canSend = status === 'DA_XAC_NHAN' && bookingStatus === 'DA_XEP_BAN';

  return (
    <section className="reservation-preorder-modal staff" role="dialog" aria-modal="true">
      <header>
        <div><span>THỰC ĐƠN ĐẶT TRƯỚC</span><h2>{item?.maTraCuu} · {item?.hoTenKhach}</h2><p>{item?.soLuongKhach} khách · {reservationDateTime(item?.ngayGioDen)}</p></div>
        <button type="button" onClick={onClose} disabled={busy}><X size={20} /></button>
      </header>
      {loading ? <div className="reservation-preorder-loading"><LoaderCircle className="spin" size={26} /> Đang tải thực đơn...</div> : (
        <div className="reservation-preorder-staff-body">
          <div className="reservation-preorder-staff-head">
            <span className={`reservation-preorder-status ${meta.tone}`}>{meta.label}</span>
            <strong>{formatMoney(preorder?.tongTienDuKien || 0)}</strong>
          </div>
          {preorder?.lyDoTuChoiDatMonTruoc ? <div className="reservation-preorder-alert"><AlertTriangle size={19} /><p><b>Lý do:</b> {preorder.lyDoTuChoiDatMonTruoc}</p></div> : null}
          <PreorderItems preorder={preorder} />
          {preorder?.ghiChuDatMonTruoc ? <div className="reservation-preorder-note"><b>Ghi chú chung:</b> {preorder.ghiChuDatMonTruoc}</div> : null}
          {status === 'CHO_XAC_NHAN' && bookingStatus === 'CHO_XAC_NHAN' ? <div className="reservation-preorder-send-info"><Clock3 size={21} /><p>Khách đã chọn món cùng yêu cầu đặt bàn. Hãy xác nhận lịch đặt bàn trước khi duyệt thực đơn; món hiện chưa chuyển xuống bếp.</p></div> : null}
          {status === 'CHO_XAC_NHAN' ? (
            <div className="reservation-preorder-review-grid">
              <label>Thời gian chế biến dự kiến<select value={preparationMinutes} onChange={(event) => setPreparationMinutes(event.target.value)}><option value="15">15 phút</option><option value="30">30 phút</option><option value="45">45 phút</option><option value="60">60 phút</option><option value="90">90 phút</option><option value="120">120 phút</option><option value="180">180 phút</option></select></label>
              <label>Ghi chú khi duyệt<textarea rows="3" maxLength="500" value={confirmNote} onChange={(event) => setConfirmNote(event.target.value)} placeholder="Không bắt buộc" /></label>
              <label className="wide">Lý do nếu yêu cầu khách chỉnh sửa<textarea rows="3" maxLength="500" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Ví dụ: Một món đang hết nguyên liệu" /></label>
            </div>
          ) : null}
          {status === 'DA_XAC_NHAN' ? <div className={`reservation-preorder-send-info ${canSend ? 'ready' : ''}`}><ChefHat size={21} /><p>{canSend ? 'Khách đã được xếp bàn. Có thể chuyển toàn bộ món đặt trước xuống bếp.' : 'Thực đơn đã duyệt. Chỉ được chuyển xuống bếp sau khi khách check-in và được xếp bàn thực tế.'}</p></div> : null}
          {preorder?.thoiGianDuKienChuyenBep ? <div className="reservation-preorder-kitchen-time"><Clock3 size={16} /> Mốc chuẩn bị tham khảo: {reservationDateTime(preorder.thoiGianDuKienChuyenBep)}</div> : null}
          {status === 'DA_CHUYEN_BEP' ? <div className="reservation-preorder-approved"><CheckCircle2 size={19} /><p>Đã chuyển xuống bếp{preorder?.maDonHang ? ` và tạo đơn #${preorder.maDonHang}` : ''} lúc {reservationDateTime(preorder?.thoiGianChuyenBep)}.</p></div> : null}
        </div>
      )}
      <footer>
        <button type="button" onClick={onClose} disabled={busy}>Đóng</button>
        {status === 'CHO_XAC_NHAN' ? <>
          <button type="button" className="danger" onClick={() => runAction('reject')} disabled={busy || !rejectReason.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <XCircle size={17} />} Yêu cầu điều chỉnh</button>
          <button type="button" className="primary" onClick={() => runAction('confirm')} disabled={busy || !canApprove}>{busy ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />} Duyệt thực đơn</button>
        </> : null}
        {status === 'DA_XAC_NHAN' ? <button type="button" className="primary" onClick={() => runAction('send')} disabled={busy || !canSend}>{busy ? <LoaderCircle className="spin" size={17} /> : <ChefHat size={17} />} Chuyển xuống bếp</button> : null}
      </footer>
    </section>
  );
}
