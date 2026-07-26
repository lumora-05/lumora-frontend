import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Printer,
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

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('TIEN_MAT');
  const [cashReceived, setCashReceived] = useState('');
  const [transferVerified, setTransferVerified] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    orderApi.getById(orderId).then((response) => {
      if (!active) return;
      const data = response?.data || response;
      setOrder(data);
      setCashReceived(String(totalOf(data)));
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

  const subtotal = useMemo(() => subtotalOf(order), [order]);
  const discount = useMemo(() => discountOf(order), [order]);
  const total = useMemo(() => totalOf(order), [order]);
  const promotionCode = order?.maCodeKhuyenMai || order?.khuyenMai?.maCode || '';
  const cashValue = Number(cashReceived);
  const change = useMemo(
    () => Math.max(0, Number.isFinite(cashValue) ? cashValue - total : 0),
    [cashValue, total],
  );
  const cashOptions = useMemo(() => quickAmounts(total), [total]);
  const methodLabel = METHODS.find((item) => item.key === method)?.label || method;

  function validate() {
    if (!order) return 'Không tìm thấy thông tin đơn hàng.';
    if (order?.trangThai === 'DA_THANH_TOAN') return 'Hóa đơn này đã được thanh toán.';
    if (!PAYABLE_STATUSES.includes(order?.trangThai)) return 'Đơn hàng chưa sẵn sàng để thanh toán.';

    if (method === 'TIEN_MAT') {
      if (cashReceived === '') return 'Vui lòng nhập số tiền khách đưa.';
      if (!Number.isFinite(cashValue) || cashValue <= 0 || !Number.isInteger(cashValue)) {
        return 'Tiền khách đưa phải là số nguyên dương hợp lệ.';
      }
      if (cashValue < total) return 'Tiền khách đưa chưa đủ.';
    }

    if (method === 'CHUYEN_KHOAN' && !transferVerified) {
      return 'Vui lòng xác nhận đã kiểm tra và nhận đủ tiền chuyển khoản.';
    }

    if (note.trim().length > 255) return 'Ghi chú tối đa 255 ký tự.';
    return '';
  }

  function chooseMethod(nextMethod) {
    setMethod(nextMethod);
    setError('');
    setConfirmOpen(false);
    if (nextMethod !== 'CHUYEN_KHOAN') setTransferVerified(false);
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
    const validationMessage = validate();
    if (validationMessage) {
      setConfirmOpen(false);
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        maDonHang: Number(orderId),
        phuongThucThanhToan: method,
        tienKhachDua: method === 'TIEN_MAT' ? cashValue : null,
        ghiChu: note.trim() || null,
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
            <h1>{documentCode(order)}</h1>
          </div>

          <div className="cashier-payment-meta">
            <p><span>Bàn</span><strong>{tableNameOf(order)}</strong></p>
            <p><span>Thời gian đặt</span><strong>{dateTimeText(order?.thoiGianDat)}</strong></p>
            <p><span>Nhân viên phục vụ</span><strong>{order?.nhanVien?.hoTen || order?.tenNhanVien || '—'}</strong></p>
          </div>

          <div className="cashier-payment-total cashier-payment-breakdown">
            <p><span>Tạm tính</span><b>{formatMoney(subtotal)}</b></p>
            {discount > 0 ? <p><span>Khuyến mãi {promotionCode ? `(${promotionCode})` : ''}</span><b>-{formatMoney(discount)}</b></p> : null}
            <div><span>Tổng tiền cần thu</span><strong>{formatMoney(total)}</strong></div>
          </div>

          {method === 'TIEN_MAT' && (
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

          <div className="cashier-method-grid cashier-method-grid-two">
            {METHODS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" className={method === key ? 'active' : ''} onClick={() => chooseMethod(key)}>
                <Icon size={23} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {method === 'CHUYEN_KHOAN' && (
            <div className="cashier-transfer-confirmation">
              <div className="cashier-transfer-heading">
                <div className="cashier-transfer-icon"><Printer size={22} /></div>
                <div>
                  <strong>Thanh toán bằng phiếu VietQR</strong>
                  <p>In phiếu có mã QR và giao cho phục vụ mang ra bàn. Khách quét mã trên phiếu, không cần quét màn hình thu ngân.</p>
                </div>
              </div>

              <Link
                className="cashier-print-slip-link"
                to={`/cashier/print/${orderId}?preview=1`}
                target="_blank"
                rel="noreferrer"
              >
                <Printer size={17} />Mở phiếu thanh toán có VietQR
              </Link>


              <label className="cashier-transfer-check">
                <input
                  type="checkbox"
                  checked={transferVerified}
                  onChange={(event) => setTransferVerified(event.target.checked)}
                />
                <span>
                  <strong>Tôi đã kiểm tra tài khoản và nhận đủ tiền</strong>
                  <small>Chỉ tích sau khi khoản chuyển đã thực sự vào tài khoản nhà hàng.</small>
                </span>
              </label>
            </div>
          )}

          <div className="cashier-payment-review">
            <p><span>Bàn</span><strong>{tableNameOf(order)}</strong></p>
            <p><span>Phương thức</span><strong>{methodLabel}</strong></p>
            {promotionCode ? <p><span>Khuyến mãi</span><strong>{promotionCode}</strong></p> : null}
            <p><span>Số tiền</span><strong>{formatMoney(total)}</strong></p>
          </div>

          {error && <div className="cashier-error">{error}</div>}

          <div className="cashier-payment-actions">
            <Link className="cashier-outline-action" to={`/cashier/invoices/${orderId}`}>Quay lại chi tiết</Link>
            <button className="cashier-confirm-action" type="button" disabled={submitting} onClick={requestConfirmation}>
              <WalletCards size={18} />{method === 'CHUYEN_KHOAN' ? 'Xác nhận đã nhận tiền' : 'Xác nhận thanh toán'}
            </button>
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
            <p>{method === 'CHUYEN_KHOAN' ? 'Xác nhận khoản chuyển đã vào tài khoản trước khi hoàn tất đơn.' : 'Vui lòng kiểm tra lại thông tin trước khi ghi nhận thanh toán.'}</p>
            <div className="cashier-confirm-summary">
              <p><span>Bàn</span><strong>{tableNameOf(order)}</strong></p>
              <p><span>Tổng tiền</span><strong>{formatMoney(total)}</strong></p>
              <p><span>Phương thức</span><strong>{methodLabel}</strong></p>
              {method === 'TIEN_MAT' ? (
                <>
                  <p><span>Khách đưa</span><strong>{formatMoney(cashValue || 0)}</strong></p>
                  <p><span>Tiền thừa</span><strong>{formatMoney(change)}</strong></p>
                </>
              ) : (
                <>
                  <p><span>Kiểm tra tiền</span><strong className="cashier-confirm-verified">Đã nhận đủ</strong></p>
                </>
              )}
              {note.trim() ? <p><span>Ghi chú</span><strong>{note.trim()}</strong></p> : null}
            </div>
            <div className="cashier-confirm-buttons">
              <button type="button" className="cashier-outline-action" onClick={() => setConfirmOpen(false)} disabled={submitting}>Kiểm tra lại</button>
              <button type="button" className="cashier-confirm-action" onClick={confirmPayment} disabled={submitting}>
                <WalletCards size={18} />{submitting ? 'Đang xử lý...' : 'Xác nhận thu tiền'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
