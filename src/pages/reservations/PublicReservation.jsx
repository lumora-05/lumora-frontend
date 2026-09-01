import {
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Edit3,
  Landmark,
  LoaderCircle,
  MapPin,
  Menu,
  Phone,
  QrCode,
  RefreshCw,
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
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import { CustomerReservationPreorder, ReservationPreorderDraftModal } from '../../components/reservation/ReservationPreorder';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import { useWebSocket } from '../../hooks/useWebSocket';
import { imageUrl } from '../../utils/imageUrl';
import '../../styles/home.css';
import {
  canCustomerCancel,
  canCustomerEdit,
  formatReservationMoney,
  maxReservationDateTime,
  minReservationDateTime,
  reservationData,
  reservationDate,
  reservationDateTime,
  reservationDepositStatus,
  reservationDepositStatusMeta,
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
  bannerUrl: '',
};

const RESERVATION_NAV_LINKS = [
  { label: 'Trang chủ', href: '/#trang-chu' },
  { label: 'Thực đơn', href: '/menu' },
  { label: 'Về chúng tôi', href: '/#gioi-thieu' },
  { label: 'Đặt bàn', href: '/reservations' },
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
          <LanguageSwitcher compact />
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
            <LanguageSwitcher />
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

function publicReservationStatusMeta(item) {
  if (reservationStatus(item) === 'CHO_XAC_NHAN' && reservationDepositStatus(item) === 'CHO_THANH_TOAN') {
    return reservationDepositStatusMeta('CHO_THANH_TOAN');
  }
  return reservationStatusMeta(item);
}

function ReservationStatusTimeline({ item }) {
  const current = reservationStatus(item);
  const depositStatus = reservationDepositStatus(item);
  const hasDeposit = Number(item?.tienCoc || 0) > 0 && Boolean(depositStatus);
  const terminal = ['DA_HUY', 'TU_CHOI', 'KHONG_DEN', 'HET_HAN'].includes(current);

  if (terminal) {
    const meta = reservationStatusMeta(current);
    return (
      <div className={`reservation-public-terminal ${meta.tone}`}>
        <XCircle size={21} />
        <div><strong>{meta.label}</strong><p>{item?.lyDoHuyTuChoi || 'Lịch đặt bàn đã kết thúc.'}</p></div>
      </div>
    );
  }

  if (!hasDeposit) {
    const steps = [
      ['CHO_XAC_NHAN', 'Đã gửi yêu cầu'],
      ['DA_XAC_NHAN', 'Nhà hàng xác nhận'],
      ['KHACH_DA_DEN', 'Khách đã đến'],
      ['DA_XEP_BAN', 'Đã xếp bàn'],
      ['HOAN_THANH', 'Hoàn thành'],
    ];
    const order = steps.map(([value]) => value);
    const index = order.indexOf(current);
    return (
      <div className="reservation-public-timeline legacy">
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

  const steps = ['Đã tạo lịch', 'Thanh toán cọc', 'Nhà hàng xác nhận', 'Khách đã đến', 'Đã xếp bàn', 'Hoàn thành'];
  let activeIndex = 0;
  let doneThrough = 0;
  if (current === 'CHO_XAC_NHAN') {
    if (depositStatus === 'CHO_THANH_TOAN') {
      activeIndex = 1;
      doneThrough = 0;
    } else {
      activeIndex = 2;
      doneThrough = 1;
    }
  } else if (current === 'DA_XAC_NHAN') {
    activeIndex = 2;
    doneThrough = 2;
  } else if (current === 'KHACH_DA_DEN') {
    activeIndex = 3;
    doneThrough = 3;
  } else if (current === 'DA_XEP_BAN') {
    activeIndex = 4;
    doneThrough = 4;
  } else if (current === 'HOAN_THANH') {
    activeIndex = 5;
    doneThrough = 5;
  }

  return (
    <div className="reservation-public-timeline deposit-flow">
      {steps.map((label, stepIndex) => {
        const done = stepIndex <= doneThrough;
        const active = stepIndex === activeIndex;
        return (
          <div key={label} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}>
            <span>{done ? <Check size={14} /> : stepIndex + 1}</span>
            <p>{label}</p>
          </div>
        );
      })}
    </div>
  );
}

function ReservationDepositCard({ item, qr, loading, error, onLoadQr, onRefresh }) {
  const depositStatus = reservationDepositStatus(item);
  if (!item?.tienCoc || !depositStatus) return null;
  const meta = reservationDepositStatusMeta(depositStatus);
  const pending = depositStatus === 'CHO_THANH_TOAN';
  const paid = ['DA_THANH_TOAN', 'DA_KHAU_TRU'].includes(depositStatus);

  return (
    <section className={`reservation-public-deposit ${meta.tone}`}>
      <header>
        <div><span><CreditCard size={19} /></span><div><h3>Tiền cọc giữ bàn</h3><p>Cọc được dùng để hạn chế đặt bàn không đến và sẽ được khấu trừ vào hóa đơn khi thanh toán.</p></div></div>
        <em className={`reservation-deposit-badge ${meta.tone}`}>{meta.label}</em>
      </header>
      <div className="reservation-public-deposit-summary">
        <p><span>Số tiền cọc</span><strong>{formatReservationMoney(item.tienCoc)}</strong></p>
        <p><span>Hạn thanh toán</span><strong>{item?.thoiHanThanhToanCoc ? reservationDateTime(item.thoiHanThanhToanCoc) : '—'}</strong></p>
        {Number(item?.tienCocDaKhauTru || 0) > 0 ? <p><span>Đã khấu trừ</span><strong>{formatReservationMoney(item.tienCocDaKhauTru)}</strong></p> : null}
      </div>

      {pending ? (
        <div className="reservation-public-deposit-payment">
          {qr ? (
            <>
              <div className="reservation-public-deposit-qr"><img src={qr.qrUrl} alt={`VietQR cọc đặt bàn ${item?.maTraCuu || ''}`} /></div>
              <div className="reservation-public-deposit-bank">
                <p><Landmark size={16} /><span>Ngân hàng</span><strong>{qr.bankName || qr.bankId || '—'}</strong></p>
                <p><span>Số tài khoản</span><strong>{qr.accountNo || '—'}</strong></p>
                <p><span>Chủ tài khoản</span><strong>{qr.accountName || '—'}</strong></p>
                <p className="wide"><span>Nội dung chuyển khoản</span><strong>{qr.addInfo || '—'}</strong></p>
                <p className="wide important"><span>Số tiền</span><strong>{formatReservationMoney(qr.amount ?? item.tienCoc)}</strong></p>
              </div>
            </>
          ) : (
            <div className="reservation-public-deposit-empty">
              <QrCode size={28} />
              <div><strong>{error ? 'Chưa thể tải mã VietQR' : 'Thanh toán cọc bằng VietQR'}</strong><p>{error || 'Mở mã QR để chuyển khoản đúng số tiền và nội dung.'}</p></div>
              <button type="button" onClick={onLoadQr} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <QrCode size={16} />} Hiện VietQR</button>
            </div>
          )}
          <div className="reservation-public-deposit-help">
            <ShieldCheck size={17} />
            <p>Sau khi chuyển khoản, nhà hàng sẽ kiểm tra giao dịch và xác nhận tiền cọc. Khách không thể tự đánh dấu đã thanh toán.</p>
            <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={15} /> Kiểm tra trạng thái</button>
          </div>
        </div>
      ) : null}

      {paid ? <div className="reservation-public-deposit-message deposit-success"><Check size={17} /><p>{depositStatus === 'DA_KHAU_TRU' ? 'Tiền cọc đã được khấu trừ vào khoản phải thanh toán.' : 'Nhà hàng đã xác nhận nhận được tiền cọc. Lịch đang tiếp tục được xử lý.'}</p></div> : null}
      {depositStatus === 'CHO_HOAN' ? <div className="reservation-public-deposit-message warning"><Clock3 size={17} /><p>Khoản cọc đang chờ nhà hàng hoàn lại. Khi hoàn tất, trạng thái sẽ được cập nhật tại đây.</p></div> : null}
      {depositStatus === 'DA_HOAN' ? <div className="reservation-public-deposit-message deposit-success"><Check size={17} /><p>Nhà hàng đã ghi nhận hoàn tiền cọc.</p></div> : null}
      {depositStatus === 'MAT_COC' ? <div className="reservation-public-deposit-message danger"><XCircle size={17} /><p>Khoản cọc không được hoàn theo chính sách của lịch đặt bàn này.</p></div> : null}
      {depositStatus === 'DA_HUY' ? <div className="reservation-public-deposit-message muted"><XCircle size={17} /><p>Yêu cầu cọc đã kết thúc mà không phát sinh khoản tiền cần xử lý.</p></div> : null}
      {item?.lyDoXuLyCoc ? <div className="reservation-public-deposit-reason"><b>Ghi chú xử lý cọc:</b> {item.lyDoXuLyCoc}</div> : null}
    </section>
  );
}


function DepositPaymentModal({ item, qr, loading, error, onLoadQr, onRefresh, onCopy, onClose, embedded = false }) {
  const [now, setNow] = useState(Date.now());
  const depositStatus = reservationDepositStatus(item);
  const pending = depositStatus === 'CHO_THANH_TOAN';
  const paid = ['DA_THANH_TOAN', 'DA_KHAU_TRU'].includes(depositStatus);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const deadline = item?.thoiHanThanhToanCoc ? new Date(item.thoiHanThanhToanCoc).getTime() : NaN;
  const remainingMs = Number.isFinite(deadline) ? Math.max(deadline - now, 0) : null;
  const countdown = remainingMs == null
    ? null
    : remainingMs <= 0
      ? 'Đã hết thời hạn thanh toán'
      : `Còn ${String(Math.floor(remainingMs / 60000)).padStart(2, '0')}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')} để thanh toán`;

  const modal = (
    <section className="reservation-deposit-payment-modal" role="dialog" aria-modal="true" aria-label="Thanh toán cọc giữ bàn">
      <button type="button" className="reservation-deposit-payment-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button>

      {paid ? (
        <div className="reservation-deposit-payment-success">
          <span><Check size={28} /></span>
          <h3>Đã xác nhận tiền cọc</h3>
          <p>Nhà hàng đã ghi nhận khoản cọc <b>{formatReservationMoney(item?.tienCoc)}</b>. Lịch đặt bàn đang tiếp tục được xử lý.</p>
          <button type="button" onClick={onClose}>Xem chi tiết lịch</button>
        </div>
      ) : (
        <>
          <header>
            <span><QrCode size={22} /></span>
            <div><h3>Thanh toán cọc giữ bàn</h3><p>Lịch <b>{item?.maTraCuu}</b> chỉ được nhà hàng xác nhận sau khi nhận được tiền cọc.</p></div>
          </header>

          <div className="reservation-deposit-payment-amount">
            <span>Số tiền cần cọc</span>
            <strong>{formatReservationMoney(item?.tienCoc)}</strong>
            {countdown ? <em className={remainingMs === 0 ? 'expired' : ''}><Clock3 size={15} /> {countdown}</em> : null}
          </div>

          {pending && qr ? (
            <div className="reservation-deposit-payment-content">
              <div className="reservation-deposit-payment-qr"><img src={qr.qrUrl} alt={`VietQR cọc đặt bàn ${item?.maTraCuu || ''}`} /></div>
              <div className="reservation-deposit-payment-bank">
                <p><span>Ngân hàng</span><strong>{qr.bankName || qr.bankId || '—'}</strong></p>
                <p><span>Số tài khoản</span><strong>{qr.accountNo || '—'}</strong>{qr.accountNo ? <button type="button" onClick={() => onCopy(qr.accountNo, 'số tài khoản')}><Copy size={14} /> Sao chép</button> : null}</p>
                <p><span>Chủ tài khoản</span><strong>{qr.accountName || '—'}</strong></p>
                <p className="wide"><span>Nội dung chuyển khoản</span><strong>{qr.addInfo || '—'}</strong>{qr.addInfo ? <button type="button" onClick={() => onCopy(qr.addInfo, 'nội dung chuyển khoản')}><Copy size={14} /> Sao chép</button> : null}</p>
                <p className="wide amount"><span>Số tiền</span><strong>{formatReservationMoney(qr.amount ?? item?.tienCoc)}</strong></p>
              </div>
            </div>
          ) : pending ? (
            <div className="reservation-deposit-payment-loading">
              {loading ? <LoaderCircle className="spin" size={28} /> : <QrCode size={30} />}
              <div><strong>{loading ? 'Đang tải mã VietQR...' : 'Chưa thể hiển thị VietQR'}</strong><p>{error || 'Vui lòng thử tải lại mã thanh toán.'}</p></div>
              {!loading ? <button type="button" onClick={onLoadQr}><RefreshCw size={16} /> Tải lại VietQR</button> : null}
            </div>
          ) : (
            <div className="reservation-deposit-payment-loading">
              <ShieldCheck size={30} />
              <div><strong>Trạng thái cọc đã thay đổi</strong><p>Vui lòng kiểm tra chi tiết lịch đặt bàn.</p></div>
            </div>
          )}

          <div className="reservation-deposit-payment-note"><ShieldCheck size={17} /><p>Chuyển khoản đúng <b>số tiền</b> và <b>nội dung</b> hiển thị. Sau khi chuyển, bấm “Kiểm tra thanh toán”. Khách không thể tự đánh dấu đã thanh toán.</p></div>
          <footer>
            <button type="button" className="secondary" onClick={onClose}>Xem chi tiết lịch</button>
            <button type="button" className="primary" onClick={onRefresh} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={16} /> Kiểm tra thanh toán</button>
          </footer>
        </>
      )}
    </section>
  );

  if (embedded) return modal;
  return <div className="reservation-deposit-payment-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>{modal}</div>;
}

function ReservationDepositPrompt({ item, onPay }) {
  if (reservationDepositStatus(item) !== 'CHO_THANH_TOAN') return null;
  return (
    <section className="reservation-deposit-payment-prompt">
      <div><span><CreditCard size={19} /></span><div><strong>Bạn chưa thanh toán cọc {formatReservationMoney(item?.tienCoc)}</strong><p>Hoàn tất tiền cọc để nhà hàng có thể xác nhận và giữ chỗ cho lịch này.</p></div></div>
      <button type="button" onClick={onPay}><QrCode size={16} /> Thanh toán ngay</button>
    </section>
  );
}

function ReservationDetail({ item, onEdit, onCancel, defaultDurationMinutes = 120 }) {
  const meta = publicReservationStatusMeta(item);
  const status = reservationStatus(item);
  return (
    <section className="reservation-public-result">
      <header>
        <div>
          <span className="reservation-public-code">Mã đặt bàn: <b>{item?.maTraCuu}</b></span>
          <h2>{item?.hoTenKhach}</h2>
          <p>Bạn có thể dùng mã đặt bàn hoặc số điện thoại để theo dõi lịch đặt.</p>
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
    depositAmount: 100000,
    depositPaymentTimeoutMinutes: 10,
    depositRefundAdvanceMinutes: 120,
    openingHours: '',
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalHour, setArrivalHour] = useState('');
  const [arrivalMinute, setArrivalMinute] = useState('');
  const [lookup, setLookup] = useState({ query: '', code: '', phone: '' });
  const [lookupResults, setLookupResults] = useState([]);
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
  const [reviewStep, setReviewStep] = useState('review');
  const [depositQr, setDepositQr] = useState(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositPaymentOpen, setDepositPaymentOpen] = useState(false);
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
          depositAmount: Math.max(Number(settings?.reservationDepositAmount) || 100000, 1000),
          depositPaymentTimeoutMinutes: Math.max(Number(settings?.reservationDepositPaymentTimeoutMinutes) || 10, 1),
          depositRefundAdvanceMinutes: Math.max(Number(settings?.reservationDepositRefundAdvanceMinutes) || 120, 0),
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

  const selectLookupReservation = useCallback((item) => {
    if (!item) return;
    const code = String(item?.maTraCuu || '').trim();
    const phone = normalizeVietnamPhone(item?.soDienThoai);
    setReservation(item);
    setDepositQr(null);
    setDepositError('');
    setLookup((current) => ({ ...current, code, phone }));
  }, []);

  const searchReservations = useCallback(async (silent = false) => {
    const rawQuery = lookup.query.trim();
    if (!rawQuery) {
      if (!silent) toast.error('Vui lòng nhập mã đặt bàn hoặc số điện thoại.');
      return;
    }

    const isCode = rawQuery.toUpperCase().startsWith('DB-');
    const normalizedQuery = isCode ? rawQuery.toUpperCase() : normalizeVietnamPhone(rawQuery);
    if (!isCode && !VIETNAM_MOBILE_PATTERN.test(normalizedQuery)) {
      if (!silent) toast.error('Vui lòng nhập mã đặt bàn hoặc số điện thoại hợp lệ.');
      return;
    }

    try {
      if (!silent) setSearching(true);
      const response = await reservationApi.customerLookup(normalizedQuery);
      const data = reservationData(response);
      const items = Array.isArray(data) ? data : data ? [data] : [];
      setLookupResults(items);
      setMode('lookup');

      if (items.length === 1) {
        selectLookupReservation(items[0]);
      } else {
        setReservation(null);
        setLookup((current) => ({ ...current, code: '', phone: '' }));
      }
    } catch (error) {
      setLookupResults([]);
      setReservation(null);
      setLookup((current) => ({ ...current, code: '', phone: '' }));
      if (!silent) toast.error(errorMessageOf(error, 'Không tìm thấy thông tin đặt bàn.'));
    } finally {
      if (!silent) setSearching(false);
    }
  }, [lookup.query, selectLookupReservation, toast]);

  const refreshSelectedReservation = useCallback(async (silent = false) => {
    const code = lookup.code.trim();
    const phone = normalizeVietnamPhone(lookup.phone);
    if (!code || !phone) return;
    try {
      if (!silent) setSearching(true);
      const response = await reservationApi.customerDetail(code, phone);
      const data = reservationData(response);
      setReservation(data);
      setLookupResults((current) => current.map((item) => item?.maTraCuu === data?.maTraCuu ? data : item));
    } catch (error) {
      if (!silent) toast.error(errorMessageOf(error, 'Không tìm thấy thông tin đặt bàn.'));
    } finally {
      if (!silent) setSearching(false);
    }
  }, [lookup.code, lookup.phone, toast]);

  const loadDepositQr = useCallback(async (silent = false) => {
    const code = lookup.code.trim();
    const phone = normalizeVietnamPhone(lookup.phone);
    if (!code || !phone || reservationDepositStatus(reservation) !== 'CHO_THANH_TOAN') return;
    try {
      setDepositLoading(true);
      setDepositError('');
      const response = await reservationApi.customerDepositVietQr(code, phone);
      setDepositQr(reservationData(response));
    } catch (error) {
      setDepositQr(null);
      const message = errorMessageOf(error, 'Không thể tạo VietQR cọc lúc này.');
      setDepositError(message);
      if (!silent) toast.error(message);
    } finally {
      setDepositLoading(false);
    }
  }, [lookup.code, lookup.phone, reservation, toast]);

  useEffect(() => {
    if (socketEvent && reservation?.maTraCuu) refreshSelectedReservation(true);
  }, [refreshSelectedReservation, reservation?.maTraCuu, socketEvent]);

  useEffect(() => {
    if (reservationDepositStatus(reservation) === 'CHO_THANH_TOAN' && lookup.code && lookup.phone) {
      loadDepositQr(true);
    } else {
      setDepositQr(null);
      setDepositError('');
    }
  }, [loadDepositQr, lookup.code, lookup.phone, reservation?.maTraCuu, reservation?.trangThaiCoc]);

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
      setLookup({ query: code, code, phone });
      setLookupResults(data ? [data] : []);
      setEditing(false);
      setMode('lookup');
      if (!editing && reservationDepositStatus(data) === 'CHO_THANH_TOAN') {
        setReviewStep('payment');
        setReviewOpen(true);
        setDepositPaymentOpen(false);
      } else {
        setReviewOpen(false);
        setReviewStep('review');
      }

      if (preorderError) {
        toast.error(`Đã tạo lịch ${code}, nhưng món đặt trước chưa được lưu. Vui lòng thanh toán cọc và có thể chọn lại món trong phần tra cứu.`);
      } else if (editing) {
        toast.success(messageOf(response, 'Đã cập nhật yêu cầu đặt bàn.'));
      } else {
        toast.success(`Đã tạo lịch ${code}. Vui lòng thanh toán cọc ${formatReservationMoney(data?.tienCoc || reservationPolicy.depositAmount)} trong thời hạn quy định.`);
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
      setReviewStep('review');
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

  async function copyDepositValue(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`Đã sao chép ${label}.`);
    } catch {
      toast.info(`${label}: ${value}`);
    }
  }

  function openDepositPayment() {
    setDepositPaymentOpen(true);
    if (!depositQr && !depositLoading && reservationDepositStatus(reservation) === 'CHO_THANH_TOAN') {
      loadDepositQr(false);
    }
  }

  return (
    <main className="reservation-public-page v0-home">
      <ReservationNavbar settings={headerSettings} />

      <section className="reservation-public-hero" aria-label="Đặt bàn tại Lumora">
        <img
          className="reservation-public-hero-image"
          src={imageUrl(headerSettings.bannerUrl) || "/reservation-hero.png"}
          alt="Không gian nhà hàng Lumora ấm cúng với món ăn được bày trí trên bàn"
        />
        <div className="reservation-public-hero-shade" aria-hidden="true" />
        <div className="reservation-public-hero-inner">
          <div className="reservation-public-hero-copy">
            <span>Trải nghiệm ẩm thực tinh tế</span>
            <h1>Đặt bàn dễ dàng<br />Trải nghiệm trọn vẹn</h1>
            <p>Đặt bàn ngay hôm nay để tận hưởng không gian ấm cúng và những món ăn tuyệt hảo tại Lumora.</p>
            <div><b><ShieldCheck size={18} /> Thông tin được bảo mật</b><b><CalendarCheck2 size={18} /> Tra cứu dễ dàng</b></div>
          </div>
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

            <div className="reservation-public-form-note"><ShieldCheck size={18} /><p>Đặt bàn yêu cầu cọc <b>{formatReservationMoney(reservationPolicy.depositAmount)}</b> mỗi lượt để giữ chỗ. Sau khi gửi yêu cầu, bạn có <b>{reservationPolicy.depositPaymentTimeoutMinutes} phút</b> để thanh toán; cọc được khấu trừ vào hóa đơn khi dùng bữa. {preorderChoice === 'PREORDER' && draftPreorder?.items?.length ? 'Món đặt trước chỉ chuyển xuống bếp khi bạn đã đến và được xếp bàn.' : 'Bạn có thể chỉ đặt bàn mà không cần chọn món trước.'} {reservationPolicy.openingHours ? `Giờ phục vụ: ${reservationPolicy.openingHours}.` : ''}</p></div>
            <button className="reservation-public-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={19} /> : <CalendarCheck2 size={19} />}{editing ? 'Lưu thay đổi' : 'Tiếp tục xác nhận'}</button>
          </form>
        ) : (
          <div className="reservation-public-lookup">
            <form onSubmit={(event) => { event.preventDefault(); searchReservations(); }}>
              <div><h2>Tra cứu đặt bàn</h2><p>Nhập mã đặt bàn hoặc số điện thoại đã sử dụng khi đăng ký.</p></div>
              <label className="reservation-public-lookup-query"><span>Mã đặt bàn hoặc số điện thoại</span><input value={lookup.query} onChange={(e) => { const value = e.target.value.toUpperCase(); setLookup({ query: value, code: '', phone: '' }); setLookupResults([]); setReservation(null); }} placeholder="DB-7A1B2C3D4E hoặc 0901234567" /></label>
              <button type="submit" disabled={searching}>{searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />} Tra cứu</button>
            </form>

            {!reservation && lookupResults.length > 1 ? (
              <section className="reservation-public-lookup-results">
                <header><strong>Tìm thấy {lookupResults.length} lịch đặt bàn</strong><span>Chọn lịch bạn muốn xem</span></header>
                <div>
                  {lookupResults.map((item) => {
                    const meta = publicReservationStatusMeta(item);
                    return (
                      <button type="button" key={item?.maDatBan || item?.maTraCuu} onClick={() => selectLookupReservation(item)}>
                        <span><b>{item?.maTraCuu}</b><small>{reservationDateTime(item?.ngayGioDen)}</small></span>
                        <span><b>{item?.soLuongKhach || 0} khách</b><small>{item?.khuVucMongMuon || 'Không yêu cầu khu vực'}</small></span>
                        <em className={`reservation-status-badge ${meta.tone}`}>{meta.label}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {reservation ? (
              <>
                <button type="button" className="reservation-public-copy" onClick={copyCode}><Copy size={16} /> Sao chép mã {reservation.maTraCuu}</button>
                <ReservationDepositPrompt item={reservation} onPay={openDepositPayment} />
                <ReservationDetail item={reservation} defaultDurationMinutes={reservationPolicy.defaultDurationMinutes} onEdit={startEdit} onCancel={() => setCancelOpen(true)} />
                <ReservationDepositCard item={reservation} qr={depositQr} loading={depositLoading} error={depositError} onLoadQr={() => loadDepositQr(false)} onRefresh={() => refreshSelectedReservation(false)} />
                <CustomerReservationPreorder
                  reservation={reservation}
                  code={lookup.code}
                  phone={lookup.phone}
                  onChanged={() => refreshSelectedReservation(true)}
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
        <div
          className="reservation-cancel-backdrop reservation-booking-flow-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setReviewOpen(false);
              setReviewStep('review');
            }
          }}
        >
          {reviewStep === 'payment' && reservation ? (
            <DepositPaymentModal
              embedded
              item={reservation}
              qr={depositQr}
              loading={depositLoading || searching}
              error={depositError}
              onLoadQr={() => loadDepositQr(false)}
              onRefresh={() => refreshSelectedReservation(false)}
              onCopy={copyDepositValue}
              onClose={() => { setReviewOpen(false); setReviewStep('review'); }}
            />
          ) : (
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
              <div className="reservation-public-review-deposit"><CreditCard size={18} /><div><span>Tiền cọc giữ bàn</span><strong>{formatReservationMoney(reservationPolicy.depositAmount)}</strong><p>Sau khi tạo lịch, vui lòng thanh toán trong {reservationPolicy.depositPaymentTimeoutMinutes} phút. Hủy trước giờ đến ít nhất {reservationPolicy.depositRefundAdvanceMinutes} phút sẽ đủ điều kiện chờ hoàn cọc; hủy sát giờ hoặc không đến sẽ mất cọc.</p></div></div>
              <footer><button type="button" onClick={() => { setReviewOpen(false); setReviewStep('review'); }} disabled={submitting}>Quay lại</button><button type="button" className="primary" onClick={persistReservation} disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : <CalendarCheck2 size={17} />} {submitting ? 'Đang tạo lịch...' : 'Xác nhận & thanh toán cọc'}</button></footer>
            </section>
          )}
        </div>
      ) : null}

      {depositPaymentOpen && reservation ? (
        <DepositPaymentModal
          item={reservation}
          qr={depositQr}
          loading={depositLoading || searching}
          error={depositError}
          onLoadQr={() => loadDepositQr(false)}
          onRefresh={() => refreshSelectedReservation(false)}
          onCopy={copyDepositValue}
          onClose={() => setDepositPaymentOpen(false)}
        />
      ) : null}

      {cancelOpen ? (
        <div className="reservation-cancel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && setCancelOpen(false)}>
          <section className="reservation-cancel-modal" role="dialog" aria-modal="true">
            <span><XCircle size={24} /></span><h3>Hủy yêu cầu đặt bàn?</h3><p>Lịch <b>{reservation?.maTraCuu}</b> sẽ được hủy và không thể khôi phục. Nếu đã cọc, việc hoàn/mất cọc được xử lý theo mốc {reservationPolicy.depositRefundAdvanceMinutes} phút trước giờ đến.</p>
            <label>Lý do hủy<textarea rows="4" maxLength="500" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Nhập lý do hủy..." /></label>
            <div><button type="button" onClick={() => setCancelOpen(false)} disabled={submitting}>Quay lại</button><button type="button" onClick={cancelReservation} disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : null} Xác nhận hủy</button></div>
          </section>
        </div>
      ) : null}
      <LumoraChatbot />
    </main>
  );
}
