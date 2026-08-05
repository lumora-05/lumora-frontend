import {
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Edit3,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reservationApi } from '../../api/reservationApi';
import LumoraChatbot from '../../components/customer/LumoraChatbot';
import { CustomerReservationPreorder } from '../../components/reservation/ReservationPreorder';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  canCustomerCancel,
  canCustomerEdit,
  minReservationDateTime,
  reservationData,
  reservationDate,
  reservationDateTime,
  reservationStatus,
  reservationStatusMeta,
  reservationTime,
  toDateTimeLocal,
} from '../../utils/reservations';

const EMPTY_FORM = {
  hoTenKhach: '',
  soDienThoai: '',
  ngayGioDen: '',
  soLuongKhach: 2,
  khuVucMongMuon: '',
  thoiLuongPhut: 120,
  ghiChu: '',
};

function ReservationStatusTimeline({ item }) {
  const current = reservationStatus(item);
  const terminal = ['DA_HUY', 'TU_CHOI', 'KHONG_DEN'].includes(current);
  const steps = [
    ['CHO_XAC_NHAN', 'Đã gửi yêu cầu'],
    ['DA_XAC_NHAN', 'Nhà hàng xác nhận'],
    ['KHACH_DA_DEN', 'Khách đã đến'],
    ['DA_XEP_BAN', 'Đã xếp bàn'],
    ['HOAN_THANH', 'Hoàn thành'],
  ];
  const order = steps.map(([value]) => value);
  const index = order.indexOf(current);

  if (terminal) {
    const meta = reservationStatusMeta(current);
    return (
      <div className={`reservation-public-terminal ${meta.tone}`}>
        <XCircle size={21} />
        <div><strong>{meta.label}</strong><p>{item?.lyDoHuyTuChoi || 'Lịch đặt bàn đã kết thúc.'}</p></div>
      </div>
    );
  }

  return (
    <div className="reservation-public-timeline">
      {steps.map(([value, label], stepIndex) => {
        const done = index >= stepIndex;
        const active = current === value;
        return (
          <div key={value} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}>
            <span>{done ? <Check size={14} /> : stepIndex + 1}</span>
            <p>{label}</p>
          </div>
        );
      })}
    </div>
  );
}

function ReservationDetail({ item, onEdit, onCancel }) {
  const meta = reservationStatusMeta(item);
  const status = reservationStatus(item);
  return (
    <section className="reservation-public-result">
      <header>
        <div>
          <span className="reservation-public-code">Mã đặt bàn: <b>{item?.maTraCuu}</b></span>
          <h2>{item?.hoTenKhach}</h2>
          <p>Vui lòng lưu mã tra cứu và số điện thoại để theo dõi lịch đặt.</p>
        </div>
        <span className={`reservation-status-badge ${meta.tone}`}>{meta.label}</span>
      </header>

      <ReservationStatusTimeline item={item} />

      <div className="reservation-public-info-grid">
        <article><CalendarDays size={18} /><span>Ngày đến</span><strong>{reservationDate(item?.ngayGioDen)}</strong></article>
        <article><Clock3 size={18} /><span>Giờ đến</span><strong>{reservationTime(item?.ngayGioDen)}</strong></article>
        <article><UsersRound size={18} /><span>Số khách</span><strong>{item?.soLuongKhach || 0} người</strong></article>
        <article><MapPin size={18} /><span>Khu vực</span><strong>{item?.khuVucMongMuon || 'Không yêu cầu'}</strong></article>
      </div>

      <div className="reservation-public-detail-lines">
        <p><span>Bàn dự kiến</span><strong>{item?.tenBanDuKien || 'Nhà hàng sẽ sắp xếp'}</strong></p>
        <p><span>Bàn thực tế</span><strong>{item?.tenBanThucTe || 'Chưa xếp bàn'}</strong></p>
        <p><span>Thời lượng dự kiến</span><strong>{item?.thoiLuongPhut || 120} phút</strong></p>
        <p><span>Ngày tạo</span><strong>{reservationDateTime(item?.thoiGianTao)}</strong></p>
      </div>

      {item?.ghiChu ? <div className="reservation-public-note"><b>Ghi chú:</b> {item.ghiChu}</div> : null}
      {item?.lyDoHuyTuChoi ? <div className="reservation-public-reason"><b>Lý do:</b> {item.lyDoHuyTuChoi}</div> : null}

      {(canCustomerEdit(status) || canCustomerCancel(status)) ? (
        <footer>
          {canCustomerEdit(status) ? <button type="button" className="reservation-public-edit" onClick={onEdit}><Edit3 size={17} /> Chỉnh sửa</button> : null}
          {canCustomerCancel(status) ? <button type="button" className="reservation-public-cancel" onClick={onCancel}><XCircle size={17} /> Hủy đặt bàn</button> : null}
        </footer>
      ) : null}
    </section>
  );
}

export default function PublicReservation() {
  const toast = useToast();
  const [mode, setMode] = useState('create');
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lookup, setLookup] = useState({ code: '', phone: '' });
  const [reservation, setReservation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const socketEvent = useWebSocket(reservation?.maTraCuu ? [`/topic/customer/reservations/${reservation.maTraCuu}`] : []);

  useEffect(() => {
    reservationApi.publicAreas()
      .then((response) => setAreas(Array.isArray(reservationData(response)) ? reservationData(response) : []))
      .catch(() => setAreas([]));
  }, []);

  const loadReservation = useCallback(async (silent = false) => {
    const code = lookup.code.trim();
    const phone = lookup.phone.trim();
    if (!code || !phone) {
      if (!silent) toast.error('Vui lòng nhập mã đặt bàn và số điện thoại.');
      return;
    }
    try {
      if (!silent) setSearching(true);
      const response = await reservationApi.customerDetail(code, phone);
      setReservation(reservationData(response));
      setMode('lookup');
    } catch (error) {
      if (!silent) toast.error(errorMessageOf(error, 'Không tìm thấy thông tin đặt bàn.'));
    } finally {
      if (!silent) setSearching(false);
    }
  }, [lookup.code, lookup.phone, toast]);

  useEffect(() => {
    if (socketEvent && reservation?.maTraCuu) loadReservation(true);
  }, [loadReservation, reservation?.maTraCuu, socketEvent]);

  const minDateTime = useMemo(() => minReservationDateTime(15), []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    if (!form.hoTenKhach.trim()) return 'Vui lòng nhập họ tên.';
    if (!form.soDienThoai.trim()) return 'Vui lòng nhập số điện thoại.';
    if (!form.ngayGioDen) return 'Vui lòng chọn ngày giờ đến.';
    if (new Date(form.ngayGioDen).getTime() <= Date.now()) return 'Ngày giờ đến phải ở tương lai.';
    if (Number(form.soLuongKhach) < 1 || Number(form.soLuongKhach) > 50) return 'Số lượng khách phải từ 1 đến 50.';
    return '';
  }

  function payload() {
    return {
      hoTenKhach: form.hoTenKhach.trim(),
      soDienThoai: form.soDienThoai.trim(),
      ngayGioDen: form.ngayGioDen,
      soLuongKhach: Number(form.soLuongKhach),
      khuVucMongMuon: form.khuVucMongMuon || null,
      thoiLuongPhut: Number(form.thoiLuongPhut) || 120,
      ghiChu: form.ghiChu.trim() || null,
    };
  }

  async function submitReservation(event) {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }
    try {
      setSubmitting(true);
      const response = editing
        ? await reservationApi.customerUpdate(lookup.code, lookup.phone, payload())
        : await reservationApi.customerCreate(payload());
      const data = reservationData(response);
      setReservation(data);
      setLookup({ code: data?.maTraCuu || lookup.code, phone: data?.soDienThoai || form.soDienThoai });
      setEditing(false);
      setMode('lookup');
      toast.success(messageOf(response, editing ? 'Đã cập nhật yêu cầu đặt bàn.' : 'Đã gửi yêu cầu đặt bàn.'));
    } catch (errorValue) {
      toast.error(errorMessageOf(errorValue, editing ? 'Không thể cập nhật đặt bàn.' : 'Không thể gửi yêu cầu đặt bàn.'));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit() {
    setForm({
      hoTenKhach: reservation?.hoTenKhach || '',
      soDienThoai: reservation?.soDienThoai || '',
      ngayGioDen: toDateTimeLocal(reservation?.ngayGioDen),
      soLuongKhach: reservation?.soLuongKhach || 2,
      khuVucMongMuon: reservation?.khuVucMongMuon || '',
      thoiLuongPhut: reservation?.thoiLuongPhut || 120,
      ghiChu: reservation?.ghiChu || '',
    });
    setEditing(true);
    setMode('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function cancelReservation() {
    if (!cancelReason.trim()) {
      toast.error('Vui lòng nhập lý do hủy đặt bàn.');
      return;
    }
    try {
      setSubmitting(true);
      const response = await reservationApi.customerCancel(lookup.code, lookup.phone, cancelReason.trim());
      setReservation(reservationData(response));
      setCancelOpen(false);
      setCancelReason('');
      toast.success(messageOf(response, 'Đã hủy yêu cầu đặt bàn.'));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể hủy yêu cầu đặt bàn.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!reservation?.maTraCuu) return;
    try {
      await navigator.clipboard.writeText(reservation.maTraCuu);
      toast.success('Đã sao chép mã đặt bàn.');
    } catch {
      toast.info(`Mã đặt bàn: ${reservation.maTraCuu}`);
    }
  }

  return (
    <main className="reservation-public-page">
      <header className="reservation-public-header">
        <Link to="/" className="reservation-public-brand"><span><UtensilsCrossed size={22} /></span><div><strong>LUMORA</strong><small>Restaurant</small></div></Link>
        <Link to="/" className="reservation-public-back"><ArrowLeft size={17} /> Trang chủ</Link>
      </header>

      <section className="reservation-public-hero">
        <div className="reservation-public-hero-copy">
          <span><Sparkles size={15} /> Đặt bàn trực tuyến</span>
          <h1>Giữ chỗ cho một bữa ăn <em>trọn vẹn.</em></h1>
          <p>Gửi yêu cầu đặt bàn trong vài phút. Nhà hàng sẽ xác nhận và chuẩn bị vị trí phù hợp trước khi bạn đến.</p>
          <div><b><ShieldCheck size={18} /> Thông tin được bảo mật</b><b><CalendarCheck2 size={18} /> Tra cứu dễ dàng</b></div>
        </div>
        <div className="reservation-public-hero-card">
          <CalendarCheck2 size={30} />
          <strong>Quy trình nhanh gọn</strong>
          <p>Gửi yêu cầu → Nhà hàng xác nhận → Chọn món trước → Check-in</p>
        </div>
      </section>

      <section className="reservation-public-shell">
        <div className="reservation-public-tabs">
          <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); if (!editing) setReservation(null); }}><CalendarDays size={18} /> {editing ? 'Chỉnh sửa đặt bàn' : 'Đặt bàn mới'}</button>
          <button type="button" className={mode === 'lookup' ? 'active' : ''} onClick={() => { setMode('lookup'); setEditing(false); }}><Search size={18} /> Tra cứu đặt bàn</button>
        </div>

        {mode === 'create' ? (
          <form className="reservation-public-form" onSubmit={submitReservation}>
            <div className="reservation-public-form-head">
              <div><span><CalendarCheck2 size={22} /></span><div><h2>{editing ? 'Chỉnh sửa yêu cầu' : 'Thông tin đặt bàn'}</h2><p>Điền đầy đủ thông tin để nhà hàng sắp xếp bàn phù hợp.</p></div></div>
              {editing ? <button type="button" onClick={() => { setEditing(false); setMode('lookup'); }}>Hủy chỉnh sửa</button> : null}
            </div>

            <div className="reservation-public-form-grid">
              <label><span><UserRound size={16} /> Họ tên khách</span><input maxLength="100" value={form.hoTenKhach} onChange={(e) => updateField('hoTenKhach', e.target.value)} placeholder="Nguyễn Văn A" /></label>
              <label><span><Phone size={16} /> Số điện thoại</span><input maxLength="20" value={form.soDienThoai} onChange={(e) => updateField('soDienThoai', e.target.value)} placeholder="0901 234 567" disabled={editing} /></label>
              <label><span><CalendarDays size={16} /> Ngày giờ đến</span><input type="datetime-local" min={minDateTime} value={form.ngayGioDen} onChange={(e) => updateField('ngayGioDen', e.target.value)} /></label>
              <label><span><UsersRound size={16} /> Số lượng khách</span><input type="number" min="1" max="50" value={form.soLuongKhach} onChange={(e) => updateField('soLuongKhach', e.target.value)} /></label>
              <label><span><MapPin size={16} /> Khu vực mong muốn</span><select value={form.khuVucMongMuon} onChange={(e) => updateField('khuVucMongMuon', e.target.value)}><option value="">Nhà hàng tự sắp xếp</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
              <label><span><Clock3 size={16} /> Thời lượng dự kiến</span><select value={form.thoiLuongPhut} onChange={(e) => updateField('thoiLuongPhut', e.target.value)}><option value="60">60 phút</option><option value="90">90 phút</option><option value="120">120 phút</option><option value="150">150 phút</option><option value="180">180 phút</option><option value="240">240 phút</option></select></label>
              <label className="wide"><span>Ghi chú</span><textarea maxLength="500" rows="4" value={form.ghiChu} onChange={(e) => updateField('ghiChu', e.target.value)} placeholder="Ví dụ: cần ghế trẻ em, khách lớn tuổi, dịp sinh nhật..." /><small>{form.ghiChu.length}/500</small></label>
            </div>

            <div className="reservation-public-form-note"><ShieldCheck size={18} /><p>Khách chỉ chọn khu vực mong muốn. Nhà hàng sẽ xác nhận và lựa chọn bàn phù hợp dựa trên số lượng khách và tình trạng bàn.</p></div>
            <button className="reservation-public-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={19} /> : <CalendarCheck2 size={19} />}{editing ? 'Lưu thay đổi' : 'Gửi yêu cầu đặt bàn'}</button>
          </form>
        ) : (
          <div className="reservation-public-lookup">
            <form onSubmit={(event) => { event.preventDefault(); loadReservation(); }}>
              <div><h2>Tra cứu đặt bàn</h2><p>Nhập mã đặt bàn và số điện thoại đã sử dụng khi đăng ký.</p></div>
              <label><span>Mã đặt bàn</span><input value={lookup.code} onChange={(e) => setLookup((current) => ({ ...current, code: e.target.value.toUpperCase() }))} placeholder="DB-7A1B2C3D4E" /></label>
              <label><span>Số điện thoại</span><input value={lookup.phone} onChange={(e) => setLookup((current) => ({ ...current, phone: e.target.value }))} placeholder="0901 234 567" /></label>
              <button type="submit" disabled={searching}>{searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Tra cứu</button>
            </form>

            {reservation ? (
              <>
                <button type="button" className="reservation-public-copy" onClick={copyCode}><Copy size={16} /> Sao chép mã {reservation.maTraCuu}</button>
                <ReservationDetail item={reservation} onEdit={startEdit} onCancel={() => setCancelOpen(true)} />
                <CustomerReservationPreorder
                  reservation={reservation}
                  code={lookup.code}
                  phone={lookup.phone}
                  onChanged={() => loadReservation(true)}
                />
              </>
            ) : <div className="reservation-public-lookup-empty"><CalendarCheck2 size={42} /><strong>Thông tin đặt bàn sẽ hiển thị tại đây</strong><p>Nhà hàng cập nhật trạng thái theo thời gian thực sau khi nhận yêu cầu.</p></div>}
          </div>
        )}
      </section>

      {cancelOpen ? (
        <div className="reservation-cancel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && setCancelOpen(false)}>
          <section className="reservation-cancel-modal" role="dialog" aria-modal="true">
            <span><XCircle size={24} /></span><h3>Hủy yêu cầu đặt bàn?</h3><p>Lịch <b>{reservation?.maTraCuu}</b> sẽ được hủy và không thể khôi phục.</p>
            <label>Lý do hủy<textarea rows="4" maxLength="500" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Nhập lý do hủy..." /></label>
            <div><button type="button" onClick={() => setCancelOpen(false)} disabled={submitting}>Quay lại</button><button type="button" onClick={cancelReservation} disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : null} Xác nhận hủy</button></div>
          </section>
        </div>
      ) : null}
      <LumoraChatbot />
    </main>
  );
}
