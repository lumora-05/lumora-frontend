import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { paymentApi } from '../../api/paymentApi';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import {
  PAYABLE_STATUSES,
  dateTimeText,
  documentCode,
  discountOf,
  subtotalOf,
  tableNameOf,
  totalOf,
} from '../../utils/cashier';

const METHODS = [
  { key: 'TIEN_MAT', label: 'Tiền mặt', icon: Banknote },
  { key: 'CHUYEN_KHOAN', label: 'VietQR', icon: QrCode },
];

function quickAmounts(total) {
  const values = [
    total,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
    Math.ceil(total / 100000) * 100000,
    200000,
    500000,
    1000000,
  ];
  return [...new Set(values.filter((value) => value >= total && value > 0))]
    .sort((a, b) => a - b)
    .slice(0, 5);
}

function normalizePhoneInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function lineItemsOf(paymentSlip, order) {
  const source = Array.isArray(paymentSlip?.items) && paymentSlip.items.length
    ? paymentSlip.items
    : (order?.chiTietDonHang || []);

  const grouped = new Map();

  source
    .filter((item) => item?.trangThaiMon !== 'DA_HUY')
    .forEach((item, index) => {
      const name = item?.tenMonAn || item?.monAn?.tenMonAn || 'Món ăn';
      const quantity = Number(item?.soLuong || 0);
      const unitPrice = Number(item?.donGia ?? item?.monAn?.gia ?? 0);
      const lineTotal = Number(item?.thanhTien ?? unitPrice * quantity);
      const note = String(item?.ghiChu || '').trim();
      const dishId = item?.maMonAn ?? item?.monAn?.maMonAn ?? name;
      const key = `${dishId}|${unitPrice}|${note.toLocaleLowerCase('vi-VN')}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += quantity;
        existing.lineTotal += lineTotal;
      } else {
        grouped.set(key, {
          key: item?.maChiTiet || `${key}-${index}`,
          name,
          quantity,
          unitPrice,
          lineTotal,
          note,
        });
      }
    });

  return Array.from(grouped.values());
}

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const previousPayableRef = useRef(0);
  const transferCompletedRef = useRef(false);

  const [order, setOrder] = useState(null);
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('TIEN_MAT');
  const [cashReceived, setCashReceived] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loyaltyPreview, setLoyaltyPreview] = useState(null);
  const [loyaltyChecked, setLoyaltyChecked] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState('');
  const [pointsInput, setPointsInput] = useState('0');
  const [appliedPoints, setAppliedPoints] = useState(0);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);

  const [transferQr, setTransferQr] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferReloadKey, setTransferReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      orderApi.getById(orderId),
      paymentApi.paymentSlipByOrder(orderId).catch(() => null),
    ]).then(([response, slipResponse]) => {
      if (!active) return;
      const data = response?.data || response;
      const slipData = slipResponse?.data || slipResponse || null;
      const initialTotal = totalOf(data);
      const initialDeposit = Math.min(Number(slipData?.tienCocDaKhauTru || 0), initialTotal);
      const initialPayable = Math.max(0, initialTotal - initialDeposit);
      setOrder(data);
      setPaymentSlip(slipData);
      setCashReceived(initialPayable > 0 ? String(initialPayable) : '0');
      previousPayableRef.current = initialPayable;
      if (data?.trangThai === 'DA_THANH_TOAN') {
        setError('Hóa đơn này đã được thanh toán.');
      }
    }).catch((requestError) => {
      if (active) setError(errorMessageOf(requestError, 'Không tải được hóa đơn.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [orderId]);

  const sharedBill = paymentSlip?.loaiPhieu === 'PHIEU_TAM_TINH_CHUNG'
    || String(paymentSlip?.maDonHangHienThi || '').includes('+');
  const tableLabel = paymentSlip?.tenBan || tableNameOf(order);
  const displayCode = sharedBill && paymentSlip?.maDonHangHienThi
    ? paymentSlip.maDonHangHienThi
    : documentCode(order);
  const subtotal = useMemo(
    () => Number(paymentSlip?.tamTinh ?? subtotalOf(order)),
    [order, paymentSlip],
  );
  const discount = useMemo(
    () => Number(paymentSlip?.tienGiam ?? discountOf(order)),
    [order, paymentSlip],
  );
  const totalBeforePoints = useMemo(
    () => Number(paymentSlip?.tongTien ?? totalOf(order)),
    [order, paymentSlip],
  );
  const pointDiscount = Number(loyaltyPreview?.tienGiamTuDiem || 0);
  const grossTotal = Number(loyaltyPreview?.tongThanhToan ?? totalBeforePoints);
  const depositCredit = Math.max(0, Number(paymentSlip?.tienCocDaKhauTru || 0));
  const depositApplied = Math.min(depositCredit, grossTotal);
  const total = Math.max(0, grossTotal - depositApplied);
  const promotionCode = paymentSlip?.maCodeKhuyenMai || order?.maCodeKhuyenMai || order?.khuyenMai?.maCode || '';
  const cashValue = Number(cashReceived);
  const change = useMemo(
    () => Math.max(0, Number.isFinite(cashValue) ? cashValue - total : 0),
    [cashValue, total],
  );
  const cashOptions = useMemo(() => quickAmounts(total), [total]);
  const methodLabel = METHODS.find((item) => item.key === method)?.label || method;
  const parsedPointsInput = integerValue(pointsInput, -1);
  const pointsPendingApply = loyaltyChecked && parsedPointsInput !== appliedPoints;
  const lineItems = useMemo(() => lineItemsOf(paymentSlip, order), [paymentSlip, order]);

  useEffect(() => {
    if (!order || method !== 'CHUYEN_KHOAN' || total <= 0 || order?.trangThai === 'DA_THANH_TOAN') {
      setTransferLoading(false);
      return undefined;
    }

    let active = true;
    setTransferLoading(true);
    setTransferError('');
    setTransferQr(null);

    const params = customerPhone && loyaltyChecked && loyaltyPreview
      ? { phone: customerPhone, pointsToUse: appliedPoints }
      : {};

    paymentApi.vietQrByOrder(orderId, params)
      .then((response) => {
        if (!active) return;
        const data = response?.data || response;
        if (!data?.qrUrl) throw new Error('QR_MISSING');
        setTransferQr(data);
      })
      .catch((requestError) => {
        if (!active) return;
        const fallback = requestError?.message === 'QR_MISSING'
          ? 'Hệ thống chưa trả về mã VietQR. Vui lòng thử lại.'
          : 'Không tạo được mã VietQR. Vui lòng thử lại.';
        setTransferError(errorMessageOf(requestError, fallback));
      })
      .finally(() => {
        if (active) setTransferLoading(false);
      });

    return () => { active = false; };
  }, [
    appliedPoints,
    customerPhone,
    loyaltyChecked,
    loyaltyPreview,
    method,
    order?.trangThai,
    orderId,
    total,
    transferReloadKey,
  ]);

  useEffect(() => {
    if (!order || method !== 'CHUYEN_KHOAN' || !transferQr || total <= 0 || order?.trangThai === 'DA_THANH_TOAN') {
      return undefined;
    }

    let active = true;

    const checkTransferStatus = async () => {
      try {
        const response = await orderApi.getById(orderId);
        if (!active) return;
        const data = response?.data || response;
        if (data) setOrder(data);

        if (data?.trangThai === 'DA_THANH_TOAN' && !transferCompletedRef.current) {
          transferCompletedRef.current = true;
          setSuccessOpen(true);
        }
      } catch {
        // Tiếp tục kiểm tra ở lần kế tiếp nếu mạng gián đoạn tạm thời.
      }
    };

    void checkTransferStatus();
    const timer = window.setInterval(checkTransferStatus, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [method, order?.trangThai, orderId, total, transferQr]);

  useEffect(() => {
    if (!order) return;
    const previousPayable = previousPayableRef.current;
    setCashReceived((currentValue) => {
      const current = Number(currentValue);
      if (currentValue === '' || current === previousPayable || current < total) {
        return String(total);
      }
      return currentValue;
    });
    previousPayableRef.current = total;
  }, [order, total]);

  function resetLoyalty() {
    setCustomerPhone('');
    setCustomerName('');
    setLoyaltyPreview(null);
    setLoyaltyChecked(false);
    setLoyaltyError('');
    setPointsInput('0');
    setAppliedPoints(0);
  }

  function changeCustomerPhone(value) {
    setCustomerPhone(normalizePhoneInput(value));
    setCustomerName('');
    setLoyaltyPreview(null);
    setLoyaltyChecked(false);
    setLoyaltyError('');
    setPointsInput('0');
    setAppliedPoints(0);
  }

  async function loadLoyaltyPreview(requestedPoints = 0, notify = false) {
    const phone = customerPhone.trim();
    if (!/^0\d{9}$/.test(phone)) {
      setLoyaltyError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.');
      return null;
    }
    if (!Number.isInteger(requestedPoints) || requestedPoints < 0) {
      setLoyaltyError('Số điểm sử dụng phải là số nguyên không âm.');
      return null;
    }

    setLoyaltyLoading(true);
    setLoyaltyError('');
    try {
      const response = await paymentApi.loyaltyPreview(orderId, {
        phone,
        pointsToUse: requestedPoints,
      });
      const data = response?.data || response;
      setLoyaltyPreview(data);
      setLoyaltyChecked(true);
      setAppliedPoints(Number(data?.diemSuDung || 0));
      setPointsInput(String(Number(data?.diemSuDung || 0)));
      if (data?.hoTen) setCustomerName(data.hoTen);
      if (notify) {
        toast.success(requestedPoints > 0 ? 'Đã áp dụng điểm khách hàng.' : 'Đã cập nhật thông tin tích điểm.');
      }
      return data;
    } catch (requestError) {
      const requestMessage = errorMessageOf(requestError, 'Không kiểm tra được thông tin tích điểm.');
      setLoyaltyError(requestMessage);
      return null;
    } finally {
      setLoyaltyLoading(false);
    }
  }

  async function applyPoints() {
    if (parsedPointsInput < 0) {
      setLoyaltyError('Số điểm sử dụng phải là số nguyên không âm.');
      return;
    }
    await loadLoyaltyPreview(parsedPointsInput, true);
  }

  function validate() {
    if (!order) return 'Không tìm thấy thông tin đơn hàng.';
    if (order?.trangThai === 'DA_THANH_TOAN') return 'Hóa đơn này đã được thanh toán.';
    if (!PAYABLE_STATUSES.includes(order?.trangThai)) return 'Đơn hàng chưa sẵn sàng để thanh toán.';

    if (customerPhone) {
      if (!/^0\d{9}$/.test(customerPhone)) return 'Số điện thoại khách hàng không hợp lệ.';
      if (!loyaltyChecked || !loyaltyPreview) return 'Vui lòng kiểm tra khách hàng trước khi thanh toán.';
      if (pointsPendingApply) return 'Số điểm đã thay đổi. Vui lòng bấm Áp dụng điểm trước khi thanh toán.';
      if (loyaltyPreview?.khachHangMoi && !customerName.trim()) return 'Vui lòng nhập họ tên khách hàng mới.';
      if (customerName.trim().length > 100) return 'Họ tên khách hàng tối đa 100 ký tự.';
    }

    if (total <= 0) {
      if (note.trim().length > 255) return 'Ghi chú tối đa 255 ký tự.';
      return '';
    }

    if (method === 'TIEN_MAT') {
      if (cashReceived === '') return 'Vui lòng nhập số tiền khách đưa.';
      if (!Number.isFinite(cashValue) || cashValue <= 0 || !Number.isInteger(cashValue)) {
        return 'Tiền khách đưa phải là số nguyên dương hợp lệ.';
      }
      if (cashValue < total) return 'Tiền khách đưa chưa đủ.';
    }

    if (note.trim().length > 255) return 'Ghi chú tối đa 255 ký tự.';
    return '';
  }

  function chooseMethod(nextMethod) {
    setMethod(nextMethod);
    setError('');
    setConfirmOpen(false);
    if (nextMethod === 'CHUYEN_KHOAN') {
      transferCompletedRef.current = false;
    }
  }

  function requestConfirmation() {
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setError('');
    setConfirmOpen(true);
  }

  async function confirmPayment() {
    if (total > 0 && method === 'CHUYEN_KHOAN') {
      setConfirmOpen(false);
      setError('VietQR được hệ thống xác nhận tự động sau khi nhận được giao dịch.');
      return;
    }

    const validationMessage = validate();
    if (validationMessage) {
      setConfirmOpen(false);
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const hasLoyaltyCustomer = Boolean(customerPhone && loyaltyChecked && loyaltyPreview);
      const payload = {
        maDonHang: Number(orderId),
        phuongThucThanhToan: method,
        tienKhachDua: total > 0 && method === 'TIEN_MAT' ? cashValue : null,
        ghiChu: note.trim() || null,
        soDienThoaiKhachHang: hasLoyaltyCustomer ? customerPhone : null,
        hoTenKhachHang: hasLoyaltyCustomer ? (customerName.trim() || null) : null,
        diemSuDung: hasLoyaltyCustomer ? appliedPoints : 0,
      };
      const response = await paymentApi.create(payload);
      toast.success(messageOf(response, 'Thanh toán thành công'));
      navigate(`/cashier/print/${orderId}`);
    } catch (requestError) {
      const requestMessage = errorMessageOf(requestError, 'Thanh toán thất bại.');
      setError(requestMessage);
      toast.error(requestMessage);
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const transferSlipUrl = useMemo(() => {
    const params = new URLSearchParams({ preview: '1' });
    if (customerPhone && loyaltyChecked && loyaltyPreview) {
      params.set('phone', customerPhone);
      params.set('points', String(appliedPoints));
      if (customerName.trim()) params.set('name', customerName.trim());
    }
    return `/cashier/print/${orderId}?${params.toString()}`;
  }, [appliedPoints, customerName, customerPhone, loyaltyChecked, loyaltyPreview, orderId]);

  if (loading) {
    return <section className="page cashier-page"><div className="cashier-table-empty cashier-loading-card">Đang tải thông tin thanh toán...</div></section>;
  }

  if (!order) {
    return (
      <section className="page cashier-page cashier-workspace">
        <div className="cashier-load-error"><span>{error || 'Không tìm thấy hóa đơn.'}</span><Link to="/cashier">Quay lại hàng chờ</Link></div>
      </section>
    );
  }

  return (
    <section className="page cashier-page cashier-workspace cashier-pos-payment-page">
      <div className="cashier-back-row">
        <Link className="cashier-back-button" to={`/cashier/invoices/${orderId}`}><ArrowLeft size={17} />Quay lại</Link>
      </div>

      <div className="cashier-payment-shell cashier-pos-payment-shell">
        <div className="cashier-payment-info cashier-pos-bill-panel">
          <header className="cashier-pos-order-head">
            <div className="cashier-section-title">
              <span>HÓA ĐƠN ĐANG THANH TOÁN</span>
              <h1>{displayCode}</h1>
              {sharedBill ? <p>Thanh toán chung nhiều đơn trong cùng nhóm bàn</p> : null}
            </div>
            <div className="cashier-pos-order-meta">
              <p><span>Bàn</span><strong>{tableLabel}</strong></p>
              <p><span>Thời gian</span><strong>{dateTimeText(paymentSlip?.thoiGianDat || order?.thoiGianDat)}</strong></p>
              <p><span>Phục vụ</span><strong>{paymentSlip?.nhanVienPhucVu || order?.nhanVien?.hoTen || order?.tenNhanVien || 'Chưa ghi nhận'}</strong></p>
            </div>
          </header>

          <div className="cashier-pos-items-wrap">
            <div className="cashier-pos-items-heading">
              <strong>Chi tiết món</strong>
              <span>{lineItems.reduce((sum, item) => sum + item.quantity, 0)} món</span>
            </div>
            {lineItems.length ? (
              <table className="cashier-pos-items-table">
                <thead>
                  <tr><th>Món ăn</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.key}>
                      <td><strong>{item.name}</strong>{item.note ? <small>{item.note}</small> : null}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.unitPrice)}</td>
                      <td>{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="cashier-pos-items-empty">Không có món cần hiển thị.</div>}
          </div>

          <div className="cashier-payment-total cashier-payment-breakdown cashier-pos-breakdown">
            <p><span>Tạm tính</span><b>{formatMoney(subtotal)}</b></p>
            {discount > 0 ? <p><span>Khuyến mãi {promotionCode ? `(${promotionCode})` : ''}</span><b>-{formatMoney(discount)}</b></p> : null}
            {pointDiscount > 0 ? <p><span>Giảm bằng điểm ({appliedPoints} điểm)</span><b>-{formatMoney(pointDiscount)}</b></p> : null}
            <p><span>Tổng sau ưu đãi</span><b>{formatMoney(grossTotal)}</b></p>
            {depositApplied > 0 ? <p className="cashier-deposit-deduction"><span>Cọc đặt bàn đã thanh toán</span><b>-{formatMoney(depositApplied)}</b></p> : null}
          </div>

          <section className={`cashier-loyalty-box cashier-loyalty-compact ${loyaltyOpen ? 'open' : ''}`}>
            <div className="cashier-loyalty-compact-head">
              <button type="button" className="cashier-loyalty-toggle" onClick={() => setLoyaltyOpen((value) => !value)} aria-expanded={loyaltyOpen}>
                <span className="cashier-loyalty-icon"><Award size={20} /></span>
                <span>
                  <strong>Khách hàng thân thiết</strong>
                  <small>{loyaltyPreview ? `${customerName || customerPhone} · ${Number(loyaltyPreview.diemHienCo || 0)} điểm` : 'Tích điểm hoặc sử dụng điểm nếu khách có nhu cầu.'}</small>
                </span>
                {loyaltyOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>
              {customerPhone ? <button type="button" className="cashier-loyalty-reset" onClick={resetLoyalty} title="Bỏ thông tin khách hàng"><RotateCcw size={16} />Đặt lại</button> : null}
            </div>

            {loyaltyOpen ? (
              <div className="cashier-loyalty-compact-body">
                <div className="cashier-loyalty-search-row">
                  <label>
                    <span>Số điện thoại</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={customerPhone}
                      onChange={(event) => changeCustomerPhone(event.target.value)}
                      placeholder="Ví dụ: 0979792909"
                    />
                  </label>
                  <button type="button" onClick={() => loadLoyaltyPreview(0)} disabled={loyaltyLoading || !customerPhone}>
                    <Search size={17} />{loyaltyLoading ? 'Đang kiểm tra...' : 'Kiểm tra'}
                  </button>
                </div>

                {customerPhone ? (
                  <label className="cashier-loyalty-name">
                    <span>Họ tên khách hàng {loyaltyPreview?.khachHangMoi ? <em>*</em> : null}</span>
                    <div>
                      <UserRound size={17} />
                      <input
                        value={customerName}
                        readOnly={Boolean(loyaltyPreview && !loyaltyPreview.khachHangMoi)}
                        maxLength="100"
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder={loyaltyChecked ? 'Nhập họ tên khách hàng mới' : 'Kiểm tra số điện thoại để lấy thông tin'}
                      />
                    </div>
                  </label>
                ) : null}

                {loyaltyError ? <div className="cashier-loyalty-error">{loyaltyError}</div> : null}

                {loyaltyPreview ? (
                  <div className="cashier-loyalty-result">
                    <div className="cashier-loyalty-customer-line">
                      <span className={loyaltyPreview.khachHangMoi ? 'new' : 'existing'}>
                        {loyaltyPreview.khachHangMoi ? 'Khách hàng mới' : 'Khách hàng đã đăng ký'}
                      </span>
                      <small>{loyaltyPreview.khachHangMoi ? 'Khách sẽ được tạo khi thanh toán thành công.' : loyaltyPreview.soDienThoai}</small>
                    </div>

                    <div className="cashier-loyalty-stats">
                      <article><span>Điểm hiện có</span><strong>{Number(loyaltyPreview.diemHienCo || 0)}</strong></article>
                      <article><span>Dùng tối đa</span><strong>{Number(loyaltyPreview.diemToiDaCoTheDung || 0)}</strong></article>
                      <article><span>Dự kiến cộng</span><strong>+{Number(loyaltyPreview.diemDuKienCong || 0)}</strong></article>
                      <article><span>Điểm sau thanh toán</span><strong>{Number(loyaltyPreview.diemConLaiSauThanhToan || 0)}</strong></article>
                    </div>

                    <div className="cashier-loyalty-points-row">
                      <label>
                        <span>Điểm muốn sử dụng</span>
                        <input
                          type="number"
                          min="0"
                          max={Number(loyaltyPreview.diemToiDaCoTheDung || 0)}
                          step="1"
                          value={pointsInput}
                          onChange={(event) => {
                            setPointsInput(event.target.value);
                            setLoyaltyError('');
                          }}
                        />
                      </label>
                      <button type="button" className="cashier-loyalty-max" onClick={() => setPointsInput(String(Number(loyaltyPreview.diemToiDaCoTheDung || 0)))} disabled={!Number(loyaltyPreview.diemToiDaCoTheDung || 0)}>
                        Dùng tối đa
                      </button>
                      <button type="button" className="cashier-loyalty-apply" onClick={applyPoints} disabled={loyaltyLoading}>
                        {loyaltyLoading ? 'Đang áp dụng...' : 'Áp dụng điểm'}
                      </button>
                    </div>

                    <p className={`cashier-loyalty-hint ${pointsPendingApply ? 'pending' : ''}`}>
                      {pointsPendingApply
                        ? 'Số điểm đã thay đổi. Bấm “Áp dụng điểm” để cập nhật số tiền.'
                        : `Tối thiểu ${Number(loyaltyPreview.diemToiThieuDeDoi || 0)} điểm/lần. 1 điểm giảm ${formatMoney(Number(loyaltyPreview.giaTriMotDiem || 0))}.`}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <label className="cashier-payment-note cashier-pos-note">
            <span>Ghi chú</span>
            <textarea
              rows="2"
              maxLength="255"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú nếu có..."
            />
          </label>
        </div>

        <aside className="cashier-method-panel cashier-pos-payment-panel">
          <div className="cashier-pos-due-card">
            <span>CÒN PHẢI THU</span>
            <strong>{formatMoney(total)}</strong>
            <small>{tableLabel} · {displayCode}</small>
          </div>

          <div className="cashier-section-title cashier-pos-method-title">
            <span>PHƯƠNG THỨC THANH TOÁN</span>
            <h2>Chọn cách khách thanh toán</h2>
          </div>

          {total > 0 ? (
            <div className="cashier-method-grid cashier-method-grid-two cashier-pos-method-grid">
              {METHODS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" className={method === key ? 'active' : ''} onClick={() => chooseMethod(key)}>
                  <Icon size={22} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : <div className="cashier-deposit-covered"><CheckCircle2 size={22} /><div><strong>Tiền cọc đã đủ thanh toán</strong><p>Không cần thu thêm tiền từ khách. Hệ thống sẽ hoàn tất hóa đơn bằng khoản cọc đã thanh toán.</p></div></div>}

          {total > 0 && method === 'TIEN_MAT' ? (
            <div className="cashier-cash-area cashier-pos-cash-area">
              <div className="cashier-cash-fields">
                <label>
                  <span>Khách đưa</span>
                  <input
                    type="number"
                    min={total}
                    step="1000"
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                  />
                </label>
                <div className="cashier-change-box"><span>Tiền thừa</span><strong>{formatMoney(change)}</strong></div>
              </div>
              <div className="cashier-quick-money">
                <span>Chọn nhanh</span>
                <div>
                  {cashOptions.map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      className={cashValue === amount ? 'active' : ''}
                      onClick={() => setCashReceived(String(amount))}
                    >
                      {amount === total ? 'Đúng số tiền' : formatMoney(amount)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {total > 0 && method === 'CHUYEN_KHOAN' ? (
            <div className="cashier-transfer-confirmation cashier-pos-transfer-panel">
              <div className="cashier-transfer-heading">
                <div className="cashier-transfer-icon"><QrCode size={22} /></div>
                <div>
                  <strong>Thanh toán qua VietQR</strong>
                  <p>Khách quét mã ngay tại màn hình. Hệ thống sẽ tự động xác nhận khi nhận được giao dịch.</p>
                </div>
              </div>

              {transferLoading ? (
                <div className="cashier-pos-qr-loading">
                  <span className="cashier-transfer-pulse" aria-hidden="true" />
                  <strong>Đang tạo mã VietQR...</strong>
                </div>
              ) : null}

              {!transferLoading && transferError ? (
                <div className="cashier-pos-qr-error">
                  <span>{transferError}</span>
                  <button type="button" onClick={() => setTransferReloadKey((value) => value + 1)}>Thử tạo lại mã</button>
                </div>
              ) : null}

              {!transferLoading && transferQr ? (
                <>
                  <div className="cashier-pos-qr-card">
                    <img src={transferQr.qrUrl} alt={`VietQR thanh toán ${displayCode}`} />
                    <div>
                      <span>Số tiền</span>
                      <strong>{formatMoney(Number(transferQr.amount ?? total))}</strong>
                      <small>{transferQr.addInfo || displayCode}</small>
                    </div>
                  </div>

                  <div className="cashier-transfer-auto-status" role="status" aria-live="polite">
                    <span className="cashier-transfer-pulse" aria-hidden="true" />
                    <span>
                      <strong>Đang chờ khách thanh toán...</strong>
                      <small>Giao dịch thành công sẽ được hệ thống cập nhật tự động.</small>
                    </span>
                  </div>

                  <Link
                    className="cashier-print-slip-link"
                    to={transferSlipUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Printer size={17} />In phiếu VietQR
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="cashier-payment-review cashier-pos-review">
            <div className="cashier-pos-review-title">Tóm tắt giao dịch</div>
            <p><span>Bàn</span><strong>{tableLabel}</strong></p>
            {sharedBill ? <p><span>Loại thanh toán</span><strong>Bill chung</strong></p> : null}
            <p><span>Phương thức</span><strong>{total <= 0 ? 'Khấu trừ tiền cọc' : methodLabel}</strong></p>
            {promotionCode ? <p><span>Khuyến mãi</span><strong>{promotionCode}</strong></p> : null}
            {loyaltyPreview ? <p><span>Khách hàng</span><strong>{customerName || customerPhone}</strong></p> : null}
            {appliedPoints > 0 ? <p><span>Điểm sử dụng</span><strong>{appliedPoints} điểm</strong></p> : null}
            {depositApplied > 0 ? <p><span>Cọc khấu trừ</span><strong>-{formatMoney(depositApplied)}</strong></p> : null}
            <p className="cashier-pos-review-total"><span>Còn phải thu</span><strong>{formatMoney(total)}</strong></p>
          </div>

          {error ? <div className="cashier-error">{error}</div> : null}

          {(total <= 0 || method === 'TIEN_MAT') ? (
            <div className="cashier-payment-actions cashier-pos-payment-actions">
              <button className="cashier-confirm-action" type="button" disabled={submitting} onClick={requestConfirmation}>
                <WalletCards size={18} />{total <= 0 ? 'Hoàn tất bằng tiền cọc' : 'Xác nhận thu tiền'}
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      {confirmOpen ? (
        <div className="cashier-confirm-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) setConfirmOpen(false);
        }}>
          <div className="cashier-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-confirm-title">
            <button type="button" className="cashier-confirm-close" onClick={() => setConfirmOpen(false)} disabled={submitting} aria-label="Đóng"><X size={20} /></button>
            <div className="cashier-confirm-icon"><CheckCircle2 size={30} /></div>
            <h2 id="cashier-confirm-title">Xác nhận giao dịch</h2>
            <p>{total <= 0 ? 'Khoản cọc đã đủ để thanh toán hóa đơn. Xác nhận để hoàn tất đơn và ghi nhận khấu trừ cọc.' : 'Vui lòng kiểm tra lại thông tin trước khi ghi nhận thanh toán.'}</p>
            <div className="cashier-confirm-summary">
              <p><span>Bàn</span><strong>{tableLabel}</strong></p>
              {sharedBill ? <p><span>Loại thanh toán</span><strong>Thanh toán chung</strong></p> : null}
              {loyaltyPreview ? <p><span>Khách hàng</span><strong>{customerName} · {customerPhone}</strong></p> : null}
              {appliedPoints > 0 ? <p><span>Dùng điểm</span><strong>{appliedPoints} điểm (-{formatMoney(pointDiscount)})</strong></p> : null}
              {loyaltyPreview ? <p><span>Điểm được cộng</span><strong>+{Number(loyaltyPreview.diemDuKienCong || 0)} điểm</strong></p> : null}
              <p><span>Tổng tiền</span><strong>{formatMoney(total)}</strong></p>
              <p><span>Phương thức</span><strong>{total <= 0 ? 'Khấu trừ tiền cọc' : methodLabel}</strong></p>
              {total > 0 && method === 'TIEN_MAT' ? (
                <>
                  <p><span>Khách đưa</span><strong>{formatMoney(cashValue || 0)}</strong></p>
                  <p><span>Tiền thừa</span><strong>{formatMoney(change)}</strong></p>
                </>
              ) : null}
              {note.trim() ? <p><span>Ghi chú</span><strong>{note.trim()}</strong></p> : null}
            </div>
            <div className="cashier-confirm-buttons">
              <button type="button" className="cashier-outline-action" onClick={() => setConfirmOpen(false)} disabled={submitting}>Kiểm tra lại</button>
              <button type="button" className="cashier-confirm-action" onClick={confirmPayment} disabled={submitting}>
                <WalletCards size={18} />{submitting ? 'Đang xử lý...' : total <= 0 ? 'Hoàn tất hóa đơn' : 'Xác nhận thu tiền'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {successOpen ? (
        <div className="cashier-confirm-overlay cashier-payment-success-overlay">
          <div className="cashier-payment-success-dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-payment-success-title">
            <div className="cashier-payment-success-icon"><CheckCircle2 size={38} /></div>
            <h2 id="cashier-payment-success-title">Thanh toán thành công</h2>
            <p>Hệ thống đã ghi nhận giao dịch VietQR cho <strong>{tableLabel}</strong>.</p>
            <div className="cashier-payment-success-amount">{formatMoney(total)}</div>
            <div className="cashier-payment-success-meta">
              <p><span>Mã đơn</span><strong>{displayCode}</strong></p>
              <p><span>Phương thức</span><strong>VietQR</strong></p>
              <p><span>Trạng thái</span><strong>Đã thanh toán</strong></p>
            </div>
            <div className="cashier-payment-success-actions">
              <Link className="cashier-outline-action" to={`/cashier/print/${orderId}`} target="_blank" rel="noreferrer"><Printer size={17} />In hóa đơn</Link>
              <button type="button" className="cashier-confirm-action" onClick={() => navigate('/cashier')}>Hoàn tất</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
