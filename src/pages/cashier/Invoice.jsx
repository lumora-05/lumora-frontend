import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, Printer, TicketPercent, WalletCards, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { paymentApi } from '../../api/paymentApi';
import { promotionApi } from '../../api/promotionApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import {
  PAID_STATUSES,
  dateTimeText,
  discountOf,
  guestCountOf,
  documentCode,
  orderTimeOf,
  paymentRequestTimeOf,
  elapsedInfo,
  serviceFeeOf,
  statusInfo,
  subtotalOf,
  tableNameOf,
  totalOf,
} from '../../utils/cashier';

const PROMOTION_EDITABLE_STATUSES = ['DA_PHUC_VU', 'CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'];

export default function Invoice() {
  const { orderId } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [promotionCode, setPromotionCode] = useState('');
  const [updatingPromotion, setUpdatingPromotion] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [orderResponse, paymentResponse] = await Promise.all([
      orderApi.getById(orderId),
      paymentApi.byOrder(orderId).catch(() => null),
    ]);
    const orderData = orderResponse?.data || orderResponse;
    setOrder(orderData);
    setPayment(paymentResponse?.data || paymentResponse || null);
    setPromotionCode(orderData?.maCodeKhuyenMai || orderData?.khuyenMai?.maCode || '');
  }, [orderId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().catch(() => {
      if (active) setOrder(null);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [load]);

  const subtotal = useMemo(() => subtotalOf(order), [order]);
  const serviceFee = useMemo(() => serviceFeeOf(order), [order]);
  const discount = useMemo(() => discountOf(order), [order]);
  const total = useMemo(() => Number(payment?.tongTien ?? totalOf(order)), [order, payment]);
  const pointDiscount = useMemo(() => Number(payment?.tienGiamTuDiem ?? order?.tienGiamTuDiem ?? 0), [order, payment]);

  if (loading || !order) {
    return <section className="page cashier-page"><div className="cashier-table-empty cashier-loading-card">Đang tải chi tiết hóa đơn...</div></section>;
  }

  const paid = PAID_STATUSES.includes(order?.trangThai) || Boolean(payment);
  const info = statusInfo(paid ? 'DA_THANH_TOAN' : order?.trangThai);
  const wait = elapsedInfo(paymentRequestTimeOf(order));
  const backUrl = paid ? '/cashier/history' : '/cashier';
  const appliedPromotionCode = payment?.maCodeKhuyenMai || order?.maCodeKhuyenMai || order?.khuyenMai?.maCode || '';
  const canEditPromotion = !paid && PROMOTION_EDITABLE_STATUSES.includes(order?.trangThai);
  const visibleItems = (order?.chiTietDonHang || []).filter((item) => item?.trangThaiMon !== 'DA_HUY');
  const loyaltyCustomer = payment?.khachHang || order?.khachHang;
  const pointsUsed = Number(payment?.diemDaSuDung ?? order?.diemDaSuDung ?? 0);
  const pointsEarned = Number(payment?.diemDuocCong ?? order?.diemDuocCong ?? 0);

  async function applyPromotion() {
    const code = promotionCode.trim().toUpperCase();
    if (!canEditPromotion || updatingPromotion) return;
    if (!code) {
      toast.error('Vui lòng nhập mã khuyến mãi.');
      return;
    }
    try {
      setUpdatingPromotion(true);
      await promotionApi.apply({ maDonHang: Number(orderId), maCode: code });
      await load();
      toast.success(`Đã áp dụng mã ${code}.`);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể áp dụng mã khuyến mãi.'));
    } finally {
      setUpdatingPromotion(false);
    }
  }

  async function removePromotion() {
    if (!appliedPromotionCode || !canEditPromotion || updatingPromotion) return;
    try {
      setUpdatingPromotion(true);
      await promotionApi.removeFromOrder(orderId);
      await load();
      setPromotionCode('');
      toast.success('Đã gỡ mã khuyến mãi khỏi đơn hàng.');
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể gỡ mã khuyến mãi.'));
    } finally {
      setUpdatingPromotion(false);
    }
  }

  return (
    <section className="page cashier-page cashier-workspace">
      <div className="cashier-back-row">
        <Link className="cashier-back-button" to={backUrl}><ArrowLeft size={17} />Quay lại</Link>
      </div>

      <div className="cashier-detail-card">
        <div className="cashier-detail-heading">
          <div>
            <span className="cashier-eyebrow">{paid ? 'CHI TIẾT HÓA ĐƠN' : 'CHI TIẾT ĐƠN THANH TOÁN'}</span>
            <h1>{documentCode(order)}</h1>
          </div>
          <span className={`cashier-state-pill cashier-tone-${info.tone}`}>{info.label}</span>
        </div>

        <div className="cashier-detail-meta">
          <p><span>Bàn</span><strong>{tableNameOf(order)}</strong></p>
          <p><span>Số khách</span><strong>{guestCountOf(order)}</strong></p>
          <p><span>Thời gian</span><strong>{dateTimeText(orderTimeOf(order))}</strong></p>
          <p><span>Nhân viên phục vụ</span><strong>{order?.nhanVien?.hoTen || order?.tenNhanVien || '—'}</strong></p>
          {paid && loyaltyCustomer?.hoTen ? <p><span>Khách hàng</span><strong>{loyaltyCustomer.hoTen}</strong></p> : null}
          {paid && loyaltyCustomer?.soDienThoai ? <p><span>Số điện thoại</span><strong>{loyaltyCustomer.soDienThoai}</strong></p> : null}
          {!paid ? <p><span>Thời gian chờ</span><strong className={`cashier-wait-text ${wait.tone}`}>{wait.label}</strong></p> : null}
        </div>

        <div className="cashier-detail-table-wrap">
          <table className="cashier-detail-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Tên món</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => {
                const unitPrice = Number(item?.donGia ?? item?.monAn?.gia ?? 0);
                return (
                  <tr key={item?.maChiTiet || `${index}-${item?.monAn?.maMonAn || ''}`}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item?.monAn?.tenMonAn || item?.tenMonAn || 'Món ăn'}</strong>
                      {item?.ghiChu ? <small>{item.ghiChu}</small> : null}
                    </td>
                    <td>{item?.soLuong || 0}</td>
                    <td>{formatMoney(unitPrice)}</td>
                    <td><strong>{formatMoney(unitPrice * Number(item?.soLuong || 0))}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="cashier-detail-bottom">
          <div className="cashier-detail-side">
            <div className="cashier-note-box">
              <span>Ghi chú</span>
              <p>{order?.ghiChu || 'Không có ghi chú.'}</p>
            </div>

            <div className="cashier-promotion-box">
              <div className="cashier-promotion-title">
                <span><TicketPercent size={17} /> Khuyến mãi</span>
                {appliedPromotionCode ? (
                  <strong>
                    {appliedPromotionCode}
                    {canEditPromotion ? <button type="button" onClick={removePromotion} disabled={updatingPromotion} title="Gỡ mã"><X size={14} /></button> : null}
                  </strong>
                ) : null}
              </div>
              {!paid ? (
                <div className="cashier-promotion-form">
                  <input
                    value={promotionCode}
                    onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => { if (event.key === 'Enter') applyPromotion(); }}
                    disabled={!canEditPromotion || updatingPromotion}
                    maxLength="50"
                    placeholder="Nhập mã khách cung cấp"
                  />
                  <button type="button" onClick={applyPromotion} disabled={!canEditPromotion || updatingPromotion}>
                    {updatingPromotion ? 'Đang xử lý...' : appliedPromotionCode ? 'Đổi mã' : 'Áp dụng'}
                  </button>
                </div>
              ) : null}
              <small>{paid ? 'Mã đã được lưu trên hóa đơn.' : 'Mã mới sẽ thay thế mã đang áp dụng.'}</small>
            </div>

            {paid && loyaltyCustomer ? (
              <div className="cashier-detail-loyalty-card">
                <div><Award size={18} /><strong>Điểm khách hàng</strong></div>
                <p><span>Đã sử dụng</span><b>{pointsUsed} điểm</b></p>
                <p><span>Được cộng</span><b>+{pointsEarned} điểm</b></p>
                <p><span>Điểm hiện có</span><b>{Number(loyaltyCustomer.diemTichLuy || 0)} điểm</b></p>
              </div>
            ) : null}
          </div>

          <div className="cashier-detail-summary">
            <p><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></p>
            <p><span>Phí phục vụ{serviceFee ? '' : ' (nếu có)'}</span><strong>{formatMoney(serviceFee)}</strong></p>
            {discount > 0 && <p><span>Khuyến mãi {appliedPromotionCode ? `(${appliedPromotionCode})` : ''}</span><strong>-{formatMoney(discount)}</strong></p>}
            {pointDiscount > 0 && <p><span>Giảm bằng điểm ({pointsUsed} điểm)</span><strong>-{formatMoney(pointDiscount)}</strong></p>}
            <p className="grand"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></p>
          </div>
        </div>

        <div className="cashier-detail-actions">
          {paid ? (
            <Link className="cashier-primary-action" to={`/cashier/print/${orderId}`}><Printer size={18} />In hóa đơn</Link>
          ) : (
            <>
              <Link className="cashier-outline-action" to={`/cashier/print/${orderId}?preview=1`}><Printer size={18} />In phiếu có VietQR</Link>
              <Link className="cashier-primary-action" to={`/cashier/payment/${orderId}`}><WalletCards size={18} />Thanh toán</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
