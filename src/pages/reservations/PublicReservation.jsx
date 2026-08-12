import {
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Edit3,
  LoaderCircle,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reservationApi } from '../../api/reservationApi';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import LumoraChatbot from '../../components/customer/LumoraChatbot';
import { CustomerReservationPreorder, ReservationPreorderDraftModal } from '../../components/reservation/ReservationPreorder';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { useWebSocket } from '../../hooks/useWebSocket';
import { imageUrl } from '../../utils/imageUrl';
import '../../styles/home.css';
import {
  canCustomerCancel,
  canCustomerEdit,
  maxReservationDateTime,
  minReservationDateTime,
  reservationData,
  reservationDate,
  reservationDateTime,
  reservationStatus,
  reservationStatusMeta,
  reservationTime,
  toDateTimeLocal,
} from '../../utils/reservations';

const VIETNAM_MOBILE_PATTERN = /^0(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;
const HOUR_24_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

const DEFAULT_HEADER_SETTINGS = {
  restaurantName: 'LUMORA',
  reservationUrl: '/reservations',
  menuUrl: '/menu',
  logoUrl: '',
};

const RESERVATION_NAV_LINKS = [
  { label: 'Trang chủ', href: '/#trang-chu' },
  { label: 'Thực đơn', href: '/menu' },
  { label: 'Về chúng tôi', href: '/#gioi-thieu' },
  { label: 'Liên hệ', href: '/#lien-he' },
];

function ReservationBrand({ settings }) {
  const logo = imageUrl(settings.logoUrl);
  return logo ? (
    <span className="v0-brand-logo-image"><img src={logo} alt={`Logo ${settings.restaurantName}`} /></span>
  ) : (
    <span className="v0-brand-mark">{(settings.restaurantName || 'L').trim().charAt(0).toUpperCase()}</span>
  );
}

function ReservationNavbar({ settings }) {
  const [open, setOpen] = useState(false);
  const reservationUrl = settings.reservationUrl || '/reservations';

  return (
    <header className="v0-navbar">
      <div className="v0-shell v0-navbar-inner">
        <Link to="/" className="v0-brand"><ReservationBrand settings={settings} /></Link>

        <nav className="v0-nav-desktop">
          {RESERVATION_NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="v0-book-desktop">
          <a href={reservationUrl} className="v0-button v0-button-primary v0-pill">Đặt bàn ngay</a>
        </div>

        <button
          type="button"
          className="v0-menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Mở menu"
          aria-expanded={open}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="v0-mobile-panel">
          <nav className="v0-shell v0-mobile-nav">
            {RESERVATION_NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
            ))}
            <a href={reservationUrl} className="v0-button v0-button-primary v0-pill v0-mobile-book">Đặt bàn ngay</a>
          </nav>
        </div>
      )}
    </header>
  );
}

function normalizeVietnamPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function dateTimeParts(value) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(value || ''));
  return match
    ? { date: match[1], hour: match[2], minute: match[3] }
    : { date: '', hour: '', minute: '' };
}

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
  const terminal = ['DA_HUY', 'TU_CHOI', 'KHONG_DEN', 'HET_HAN'].includes(current);
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

function ReservationDetail({ item, onEdit, onCancel, defaultDurationMinutes = 120 }) {
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
        <p><span>Thời lượng dự kiến</span><strong>{item?.thoiLuongPhut || defaultDurationMinutes} phút</strong></p>
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
  const [headerSettings, setHeaderSettings] = useState(DEFAULT_HEADER_SETTINGS);
  const [mode, setMode] = useState('create');
  const [areas, setAreas] = useState([]);
  const [reservationPolicy, setReservationPolicy] = useState({
    defaultDurationMinutes: 120,
    preparationMinutes: 30,
    noShowGraceMinutes: 15,
    checkInEarlyMinutes: 30,
    minimumAdvanceMinutes: 30,
    maximumAdvanceDays: 60,
    openingHours: '',
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalHour, setArrivalHour] = useState('');
  const [arrivalMinute, setArrivalMinute] = useState('');
  const [lookup, setLookup] = useState({ code: '', phone: '' });
  const [reservation, setReservation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [preorderChoice, setPreorderChoice] = useState('TABLE_ONLY');
  const [draftPreorder, setDraftPreorder] = useState(null);
  const [preorderDraftOpen, setPreorderDraftOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const socketEvent = useWebSocket(reservation?.maTraCuu ? [`/topic/customer/reservations/${reservation.maTraCuu}`] : []);

  useEffect(() => {
    reservationApi.publicAreas()
      .then((response) => setAreas(Array.isArray(reservationData(response)) ? reservationData(response) : []))
      .catch(() => setAreas([]));

    systemSettingApi.getPublic()
      .then((response) => {
        const settings = systemSettingData(response);
        setHeaderSettings((current) => ({ ...current, ...(settings || {}) }));
        const next = {
          defaultDurationMinutes: Number(settings?.reservationDefaultDurationMinutes) || 120,
          preparationMinutes: Math.max(Number(settings?.reservationPreparationMinutes) || 0, 0),
          noShowGraceMinutes: Math.max(Number(settings?.reservationNoShowGraceMinutes) || 0, 0),
          checkInEarlyMinutes: Math.max(Number(settings?.reservationCheckInEarlyMinutes) || 0, 0),
          minimumAdvanceMinutes: Math.max(Number(settings?.reservationMinimumAdvanceMinutes) || 0, 0),
          maximumAdvanceDays: Math.max(Number(settings?.reservationMaximumAdvanceDays) || 60, 1),
          openingHours: settings?.openingHours || '',
        };
        setReservationPolicy(next);
        setForm((current) => ({
          ...current,
          thoiLuongPhut: Number(current.thoiLuongPhut) === 120
            ? next.defaultDurationMinutes
            : current.thoiLuongPhut,
        }));
      })
      .catch(() => {});
  }, []);

  const loadReservation = useCallback(async (silent = false) => {
    const code = lookup.code.trim();
    const phone = normalizeVietnamPhone(lookup.phone);
    if (!code || !phone) {
      if (!silent) toast.error('Vui lòng nhập mã đặt bàn và số điện thoại.');
      return;
    }
    if (!VIETNAM_MOBILE_PATTERN.test(phone)) {
      if (!silent) toast.error('Vui lòng nhập số điện thoại hợp lệ.');
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

  const minDateTime = useMemo(
    () => minReservationDateTime(reservationPolicy.minimumAdvanceMinutes),
    [reservationPolicy.minimumAdvanceMinutes],
  );
  const maxDateTime = useMemo(
    () => maxReservationDateTime(reservationPolicy.maximumAdvanceDays),
    [reservationPolicy.maximumAdvanceDays],
  );
  const durationOptions = useMemo(
    () => Array.from(new Set([60, 90, 120, 150, 180, 240, reservationPolicy.defaultDurationMinutes]))
      .filter((value) => value >= 30 && value <= 360)
      .sort((a, b) => a - b),
    [reservationPolicy.defaultDurationMinutes],
  );
  const minReservationDate = minDateTime.slice(0, 10);
  const maxReservationDate = maxDateTime.slice(0, 10);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateArrival(nextDate = arrivalDate, nextHour = arrivalHour, nextMinute = arrivalMinute) {
    setArrivalDate(nextDate);
    setArrivalHour(nextHour);
    setArrivalMinute(nextMinute);
    setForm((current) => ({
      ...current,
      ngayGioDen: nextDate && nextHour !== '' && nextMinute !== ''
        ? `${nextDate}T${nextHour}:${nextMinute}`
        : '',
    }));
  }

  function validateForm() {
    if (!form.hoTenKhach.trim()) return 'Vui lòng nhập họ tên.';
    if (!form.soDienThoai.trim()) return 'Vui lòng nhập số điện thoại.';
    if (!VIETNAM_MOBILE_PATTERN.test(form.soDienThoai)) {
      return 'Vui lòng nhập số điện thoại hợp lệ.';
    }
    if (!form.ngayGioDen) return 'Vui lòng chọn ngày giờ đến.';
    const arrival = new Date(form.ngayGioDen).getTime();
    const earliest = Date.now() + reservationPolicy.minimumAdvanceMinutes * 60000;
    const latest = Date.now() + reservationPolicy.maximumAdvanceDays * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(arrival) || arrival < earliest) {
      return `Vui lòng đặt bàn trước ít nhất ${reservationPolicy.minimumAdvanceMinutes} phút.`;
    }
    if (arrival > latest) {
      return `Chỉ có thể đặt bàn trước tối đa ${reservationPolicy.maximumAdvanceDays} ngày.`;
    }
    if (Number(form.soLuongKhach) < 1 || Number(form.soLuongKhach) > 50) return 'Số lượng khách phải từ 1 đến 50.';
    return '';
  }

  function payload() {
    return {
      hoTenKhach: form.hoTenKhach.trim(),
      soDienThoai: normalizeVietnamPhone(form.soDienThoai),
      ngayGioDen: form.ngayGioDen,
      soLuongKhach: Number(form.soLuongKhach),
      khuVucMongMuon: form.khuVucMongMuon || null,
      thoiLuongPhut: Number(form.thoiLuongPhut) || reservationPolicy.defaultDurationMinutes,
      ghiChu: form.ghiChu.trim() || null,
    };
  }

  async function persistReservation() {
    try {
      setSubmitting(true);
      const response = editing
        ? await reservationApi.customerUpdate(lookup.code, lookup.phone, payload())
        : await reservationApi.customerCreate(payload());
      let data = reservationData(response);
      const code = data?.maTraCuu || lookup.code;
      const phone = data?.soDienThoai || normalizeVietnamPhone(form.soDienThoai);
      let preorderError = null;

      if (!editing && preorderChoice === 'PREORDER' && draftPreorder?.items?.length) {
        try {
          await reservationApi.customerSavePreorder(code, phone, {
            ghiChu: draftPreorder?.ghiChuDatMonTruoc || null,
            items: draftPreorder.items.map((item) => ({
              maMonAn: Number(item.maMonAn),
              soLuong: Number(item.soLuong),
              ghiChu: item.ghiChu || null,
            })),
          });
          const detailResponse = await reservationApi.customerDetail(code, phone);
          data = reservationData(detailResponse);
        } catch (errorValue) {
          preorderError = errorValue;
        }
      }

      setReservation(data);
      setLookup({ code, phone });
      setEditing(false);
      setReviewOpen(false);
      setMode('lookup');

      if (preorderError) {
        toast.error(`Đã tạo lịch ${code}, nhưng món đặt trước chưa được lưu. Bạn có thể chọn lại món trong phần tra cứu.`);
      } else {
        toast.success(messageOf(response, editing
          ? 'Đã cập nhật yêu cầu đặt bàn.'
          : preorderChoice === 'PREORDER' && draftPreorder?.items?.length
            ? 'Đã gửi yêu cầu đặt bàn kèm món đặt trước.'
            : 'Đã gửi yêu cầu đặt bàn.'));
      }
    } catch (errorValue) {
      toast.error(errorMessageOf(errorValue, editing ? 'Không thể cập nhật đặt bàn.' : 'Không thể gửi yêu cầu đặt bàn.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReservation(event) {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }
    if (!editing) {
      if (preorderChoice === 'PREORDER' && !draftPreorder?.items?.length) {
        toast.error('Vui lòng chọn món trước hoặc chuyển sang Chỉ đặt bàn.');
        setPreorderDraftOpen(true);
        return;
      }
      setReviewOpen(true);
      return;
    }
    await persistReservation();
  }

  function startEdit() {
    const localDateTime = toDateTimeLocal(reservation?.ngayGioDen);
    const parts = dateTimeParts(localDateTime);
    setArrivalDate(parts.date);
    setArrivalHour(parts.hour);
    setArrivalMinute(parts.minute);
    setForm({
      hoTenKhach: reservation?.hoTenKhach || '',
      soDienThoai: reservation?.soDienThoai || '',
      ngayGioDen: localDateTime,
      soLuongKhach: reservation?.soLuongKhach || 2,
      khuVucMongMuon: reservation?.khuVucMongMuon || '',
      thoiLuongPhut: reservation?.thoiLuongPhut || reservationPolicy.defaultDurationMinutes,
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
    <main className="reservation-public-page v0-home">
      <ReservationNavbar settings={headerSettings} />

      <section className="reservation-public-hero">
        <div className="reservation-public-hero-copy">
          <span><Sparkles size={15} /> Đặt bàn trực tuyến</span>
          <h1>Giữ chỗ cho một bữa ăn <em>trọn vẹn.</em></h1>
          <p>Gửi yêu cầu đặt bàn và chọn món trước ngay trong cùng một quy trình. Nhà hàng sẽ xác nhận và chuẩn bị vị trí phù hợp trước khi bạn đến.</p>
          <div><b><ShieldCheck size={18} /> Thông tin được bảo mật</b><b><CalendarCheck2 size={18} /> Tra cứu dễ dàng</b></div>
        </div>
        <div className="reservation-public-hero-card">
          <CalendarCheck2 size={30} />
          <strong>Quy trình nhanh gọn</strong>
          <p>Gửi yêu cầu → Chọn món trước → Nhà hàng xác nhận → Check-in</p>
        </div>
      </section>

      <section className="reservation-public-shell">
        <div className="reservation-public-tabs">
          <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); if (!editing) { setReservation(null); setPreorderChoice('TABLE_ONLY'); setDraftPreorder(null); } }}><CalendarDays size={18} /> {editing ? 'Chỉnh sửa đặt bàn' : 'Đặt bàn mới'}</button>
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
              <label><span><Phone size={16} /> Số điện thoại</span><input inputMode="numeric" autoComplete="tel" maxLength="10" value={form.soDienThoai} onChange={(e) => updateField('soDienThoai', normalizeVietnamPhone(e.target.value))} placeholder="0901234567" disabled={editing} /></label>
              <label className="reservation-public-arrival">
                <span><CalendarDays size={16} /> Ngày giờ đến</span>
                <div className="reservation-public-datetime24">
                  <input
                    type="date"
                    aria-label="Ngày đến"
                    min={minReservationDate}
                    max={maxReservationDate}
                    value={arrivalDate}
                    onChange={(e) => updateArrival(e.target.value, arrivalHour, arrivalMinute)}
                  />
                  <div className="reservation-public-time24">
                    <select aria-label="Giờ đến" value={arrivalHour} onChange={(e) => updateArrival(arrivalDate, e.target.value, arrivalMinute)}>
                      <option value="">Giờ</option>
                      {HOUR_24_OPTIONS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                    </select>
                    <b>:</b>
                    <select aria-label="Phút đến" value={arrivalMinute} onChange={(e) => updateArrival(arrivalDate, arrivalHour, e.target.value)}>
                      <option value="">Phút</option>
                      {MINUTE_OPTIONS.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                    </select>
                  </div>
                </div>
              </label>
              <label><span><UsersRound size={16} /> Số lượng khách</span><input type="number" min="1" max="50" value={form.soLuongKhach} onChange={(e) => updateField('soLuongKhach', e.target.value)} /></label>
              <label><span><MapPin size={16} /> Khu vực mong muốn</span><select value={form.khuVucMongMuon} onChange={(e) => updateField('khuVucMongMuon', e.target.value)}><option value="">Nhà hàng tự sắp xếp</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
              <label><span><Clock3 size={16} /> Thời lượng dự kiến</span><select value={form.thoiLuongPhut} onChange={(e) => updateField('thoiLuongPhut', e.target.value)}>{durationOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} phút</option>)}</select></label>
              <label className="wide"><span>Ghi chú</span><textarea maxLength="500" rows="4" value={form.ghiChu} onChange={(e) => updateField('ghiChu', e.target.value)} placeholder="Ví dụ: cần ghế trẻ em, khách lớn tuổi, dịp sinh nhật..." /><small>{form.ghiChu.length}/500</small></label>
            </div>

            {!editing ? (
              <section className="reservation-public-preorder-choice">
                <div className="reservation-public-preorder-choice-head">
                  <div><span><UtensilsCrossed size={18} /></span><div><h3>Bạn có muốn đặt món trước?</h3><p>Chọn món trước để nhà hàng chủ động chuẩn bị khi bạn đến. Đây là tùy chọn, không bắt buộc.</p></div></div>
                </div>
                <div className="reservation-public-preorder-choice-actions">
                  <button type="button" className={preorderChoice === 'TABLE_ONLY' ? 'active' : ''} onClick={() => { setPreorderChoice('TABLE_ONLY'); setDraftPreorder(null); }}>Chỉ đặt bàn</button>
                  <button type="button" className={preorderChoice === 'PREORDER' ? 'active' : ''} onClick={() => { setPreorderChoice('PREORDER'); setPreorderDraftOpen(true); }}><UtensilsCrossed size={16} /> Đặt món trước</button>
                </div>
                {preorderChoice === 'PREORDER' && draftPreorder?.items?.length ? (
                  <div className="reservation-public-preorder-draft">
                    <div><strong>{draftPreorder.items.length} loại món đã chọn</strong><b>{formatMoney(draftPreorder.tongTienDuKien || 0)}</b></div>
                    <p>{draftPreorder.items.map((item) => `${item.tenMonAn} ×${item.soLuong}`).join(' · ')}</p>
                    <button type="button" onClick={() => setPreorderDraftOpen(true)}>Chỉnh sửa món</button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="reservation-public-form-note"><ShieldCheck size={18} /><p>Khách chỉ chọn khu vực mong muốn, nhà hàng sẽ sắp xếp bàn phù hợp. {preorderChoice === 'PREORDER' && draftPreorder?.items?.length ? 'Món đặt trước sẽ được gửi cùng yêu cầu sau khi bạn xác nhận và chỉ chuyển xuống bếp khi bạn đã đến, được xếp bàn.' : 'Bạn có thể chỉ đặt bàn mà không cần chọn món trước.'} {reservationPolicy.openingHours ? `Giờ phục vụ: ${reservationPolicy.openingHours}.` : ''}</p></div>
            <button className="reservation-public-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={19} /> : <CalendarCheck2 size={19} />}{editing ? 'Lưu thay đổi' : 'Tiếp tục xác nhận'}</button>
          </form>
        ) : (
          <div className="reservation-public-lookup">
            <form onSubmit={(event) => { event.preventDefault(); loadReservation(); }}>
              <div><h2>Tra cứu đặt bàn</h2><p>Nhập mã đặt bàn và số điện thoại đã sử dụng khi đăng ký.</p></div>
              <label><span>Mã đặt bàn</span><input value={lookup.code} onChange={(e) => setLookup((current) => ({ ...current, code: e.target.value.toUpperCase() }))} placeholder="DB-7A1B2C3D4E" /></label>
              <label><span>Số điện thoại</span><input inputMode="numeric" autoComplete="tel" maxLength="10" value={lookup.phone} onChange={(e) => setLookup((current) => ({ ...current, phone: normalizeVietnamPhone(e.target.value) }))} placeholder="0901234567" /></label>
              <button type="submit" disabled={searching}>{searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Tra cứu</button>
            </form>

            {reservation ? (
              <>
                <button type="button" className="reservation-public-copy" onClick={copyCode}><Copy size={16} /> Sao chép mã {reservation.maTraCuu}</button>
                <ReservationDetail item={reservation} defaultDurationMinutes={reservationPolicy.defaultDurationMinutes} onEdit={startEdit} onCancel={() => setCancelOpen(true)} />
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

      {preorderDraftOpen ? (
        <div className="reservation-manage-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPreorderDraftOpen(false)}>
          <ReservationPreorderDraftModal
            current={draftPreorder}
            onSaved={(value) => { setDraftPreorder(value); setPreorderChoice('PREORDER'); }}
            onClose={() => setPreorderDraftOpen(false)}
          />
        </div>
      ) : null}

      {reviewOpen ? (
        <div className="reservation-cancel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && setReviewOpen(false)}>
          <section className="reservation-public-review-modal" role="dialog" aria-modal="true">
            <header><span><CalendarCheck2 size={22} /></span><div><h3>Xác nhận đặt bàn</h3><p>Kiểm tra thông tin trước khi gửi cho nhà hàng.</p></div></header>
            <div className="reservation-public-review-grid">
              <p><span>Khách hàng</span><strong>{form.hoTenKhach}</strong></p>
              <p><span>Số điện thoại</span><strong>{form.soDienThoai}</strong></p>
              <p><span>Ngày giờ đến</span><strong>{reservationDateTime(form.ngayGioDen)}</strong></p>
              <p><span>Số khách</span><strong>{form.soLuongKhach} người</strong></p>
              <p><span>Khu vực</span><strong>{form.khuVucMongMuon || 'Nhà hàng tự sắp xếp'}</strong></p>
              <p><span>Thời lượng</span><strong>{form.thoiLuongPhut} phút</strong></p>
            </div>
            {form.ghiChu ? <div className="reservation-public-review-note"><b>Ghi chú đặt bàn:</b> {form.ghiChu}</div> : null}
            <div className="reservation-public-review-preorder">
              <div><h4>Món đặt trước</h4><strong>{preorderChoice === 'PREORDER' && draftPreorder?.items?.length ? formatMoney(draftPreorder.tongTienDuKien || 0) : 'Không đặt món trước'}</strong></div>
              {preorderChoice === 'PREORDER' && draftPreorder?.items?.length ? (
                <div className="reservation-public-review-items">
                  {draftPreorder.items.map((item) => <p key={item.maMonAn}><span>{item.tenMonAn} ×{item.soLuong}</span><b>{formatMoney(item.thanhTien || 0)}</b></p>)}
                </div>
              ) : <p className="reservation-public-review-empty">Bạn chỉ đặt bàn. Có thể chọn món trước sau trong phần tra cứu khi lịch vẫn còn cho phép.</p>}
            </div>
            <footer><button type="button" onClick={() => setReviewOpen(false)} disabled={submitting}>Quay lại</button><button type="button" className="primary" onClick={persistReservation} disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : <CalendarCheck2 size={17} />} Xác nhận đặt bàn</button></footer>
          </section>
        </div>
      ) : null}

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
