import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Banknote,
  Building2,
  CheckCircle2,
  Printer,
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
  { key: 'CHUYEN_KHOAN', label: 'Chuyển khoản', icon: Building2 },
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

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const previousPayableRef = useRef(0);
  const [order, setOrder] = useState(null);
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('TIEN_MAT');
  const [cashReceived, setCashReceived] = useState('');
  const transferCompletedRef = useRef(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loyaltyPreview, setLoyaltyPreview] = useState(null);
  const [loyaltyChecked, setLoyaltyChecked] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState('');
  const [pointsInput, setPointsInput] = useState('0');
  const [appliedPoints, setAppliedPoints] = useState(0);

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

  useEffect(() => {
    if (!order || method !== 'CHUYEN_KHOAN' || total <= 0 || order?.trangThai === 'DA_THANH_TOAN') {
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
          toast.success('Thanh toán chuyển khoản đã được xác nhận tự động.');
          navigate(`/cashier/print/${orderId}`, { replace: true });
        }
      } catch {
        // Webhook có thể đến trong lúc một lần kiểm tra trạng thái bị lỗi mạng;
        // lần kiểm tra kế tiếp sẽ tiếp tục mà không làm phiền thu ngân bằng toast lỗi.
      }
    };

    void checkTransferStatus();
    const timer = window.setInterval(checkTransferStatus, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [method, navigate, order?.trangThai, orderId, toast, total]);

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
      setError('Chuyển khoản VietQR được hệ thống xác nhận tự động sau khi nhận webhook payOS.');
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
    <section className="page cashier-page cashier-workspace">
      <div className="cashier-back-row">
        <Link className="cashier-back-button" to={`/cashier/invoices/${orderId}`}><ArrowLeft size={17} />Quay lại</Link>
      </div>

      <div className="cashier-payment-shell">
        <div className="cashier-payment-info">
          <div className="cashier-section-title">
            <h1>{displayCode}</h1>
            {sharedBill ? <p>Thanh toán chung nhiều đơn trong cùng nhóm bàn</p> : null}
          </div>

          <div className="cashier-payment-meta">
            <p><span>Bàn</span><strong>{tableLabel}</strong></p>
            <p><span>Thời gian đặt</span><strong>{dateTimeText(paymentSlip?.thoiGianDat || order?.thoiGianDat)}</strong></p>
            <p><span>Nhân viên phục vụ</span><strong>{paymentSlip?.nhanVienPhucVu || order?.nhanVien?.hoTen || order?.tenNhanVien || '—'}</strong></p>
          </div>

          <div className="cashier-payment-total cashier-payment-breakdown">
            <p><span>Tạm tính</span><b>{formatMoney(subtotal)}</b></p>
            {discount > 0 ? <p><span>Khuyến mãi {promotionCode ? `(${promotionCode})` : ''}</span><b>-{formatMoney(discount)}</b></p> : null}
            {pointDiscount > 0 ? <p><span>Giảm bằng điểm ({appliedPoints} điểm)</span><b>-{formatMoney(pointDiscount)}</b></p> : null}
            <p><span>Tổng sau ưu đãi</span><b>{formatMoney(grossTotal)}</b></p>
            {depositApplied > 0 ? <p className="cashier-deposit-deduction"><span>Cọc đặt bàn đã thanh toán</span><b>-{formatMoney(depositApplied)}</b></p> : null}
            <div><span>Còn phải thu</span><strong>{formatMoney(total)}</strong></div>
          </div>

          <section className="cashier-loyalty-box">
            <div className="cashier-loyalty-heading">
              <div className="cashier-loyalty-icon"><Award size={22} /></div>
              <div>
                <strong>Khách hàng thân thiết</strong>
                <p>Nhập số điện thoại để tích điểm hoặc sử dụng điểm hiện có.</p>
              </div>
              {customerPhone ? <button type="button" className="cashier-loyalty-reset" onClick={resetLoyalty} title="Bỏ thông tin khách hàng"><RotateCcw size={16} />Đặt lại</button> : null}
            </div>

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
          </section>

          {total > 0 && method === 'TIEN_MAT' && (
            <div className="cashier-cash-area">
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
          )}

          <label className="cashier-payment-note">
            <span>Ghi chú</span>
            <textarea
              rows="4"
              maxLength="255"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú nếu có..."
            />
          </label>
        </div>

        <div className="cashier-method-panel">
          <div className="cashier-section-title">
            <span>PHƯƠNG THỨC THANH TOÁN</span>
            <h2>Chọn hình thức thanh toán</h2>
          </div>

          {total > 0 ? (
            <div className="cashier-method-grid cashier-method-grid-two">
              {METHODS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" className={method === key ? 'active' : ''} onClick={() => chooseMethod(key)}>
                  <Icon size={23} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : <div className="cashier-deposit-covered"><CheckCircle2 size={22} /><div><strong>Tiền cọc đã đủ thanh toán</strong><p>Không cần thu thêm tiền từ khách. Hệ thống sẽ hoàn tất hóa đơn bằng khoản cọc đã thanh toán.</p></div></div>}

          {total > 0 && method === 'CHUYEN_KHOAN' && (
            <div className="cashier-transfer-confirmation">
              <div className="cashier-transfer-heading">
                <div className="cashier-transfer-icon"><Printer size={22} /></div>
                <div>
                  <strong>Thanh toán bằng phiếu VietQR</strong>
                  <p>Phiếu VietQR sẽ dùng đúng số tiền sau khuyến mãi và sau khi đổi điểm.</p>
                </div>
              </div>

              <Link
                className="cashier-print-slip-link"
                to={transferSlipUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Printer size={17} />Mở phiếu thanh toán có VietQR
              </Link>

              <div className="cashier-transfer-auto-status" role="status" aria-live="polite">
                <span className="cashier-transfer-pulse" aria-hidden="true" />
                <span>
                  <strong>Đang chờ hệ thống xác nhận tự động</strong>
                  <small>Sau khi khách chuyển khoản thành công, payOS gửi webhook về backend và trạng thái đơn sẽ tự cập nhật.</small>
                </span>
              </div>
            </div>
          )}

          <div className="cashier-payment-review">
            <p><span>Bàn</span><strong>{tableLabel}</strong></p>
            {sharedBill ? <p><span>Loại thanh toán</span><strong>Bill chung</strong></p> : null}
            <p><span>Phương thức</span><strong>{total <= 0 ? 'Khấu trừ tiền cọc' : methodLabel}</strong></p>
            {promotionCode ? <p><span>Khuyến mãi</span><strong>{promotionCode}</strong></p> : null}
            {loyaltyPreview ? <p><span>Khách hàng</span><strong>{customerName || customerPhone}</strong></p> : null}
            {appliedPoints > 0 ? <p><span>Điểm sử dụng</span><strong>{appliedPoints} điểm</strong></p> : null}
            {depositApplied > 0 ? <p><span>Cọc khấu trừ</span><strong>-{formatMoney(depositApplied)}</strong></p> : null}
            <p><span>Còn phải thu</span><strong>{formatMoney(total)}</strong></p>
          </div>

          {error && <div className="cashier-error">{error}</div>}

          <div className="cashier-payment-actions">
            <Link className="cashier-outline-action" to={`/cashier/invoices/${orderId}`}>Quay lại chi tiết</Link>
            {total > 0 && method === 'CHUYEN_KHOAN' ? (
              <div className="cashier-transfer-waiting-action" role="status">
                <span className="cashier-transfer-pulse" aria-hidden="true" />
                <strong>Đang chờ thanh toán</strong>
              </div>
            ) : (
              <button className="cashier-confirm-action" type="button" disabled={submitting} onClick={requestConfirmation}>
                <WalletCards size={18} />{total <= 0 ? 'Hoàn tất bằng tiền cọc' : 'Xác nhận thanh toán'}
              </button>
            )}
          </div>
        </div>
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
    </section>
  );
}
