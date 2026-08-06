import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { deliveryApi } from '../../api/deliveryApi';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import {
  calculateDeliveryFee,
  deliveryAreaLabel,
  normalizePhone,
  unwrapDeliveryResponse,
} from '../../utils/delivery';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `delivery-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function itemId(item) {
  return item?.maMonAn ?? item?.id;
}

export default function DeliveryCheckout() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const requestIdRef = useRef(createRequestId());
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tenNguoiNhan: '',
    soDienThoaiNhan: '',
    diaChiGiaoHang: '',
    khuVucGiaoHang: 'NOI_THANH',
    ghiChuGiaoHang: '',
    phuongThucThanhToan: 'COD',
    ghiChuDonHang: '',
  });

  const deliveryFee = calculateDeliveryFee(form.khuVucGiaoHang);
  const total = cart.total + deliveryFee;
  const itemCountLabel = useMemo(() => `${cart.count} suất món`, [cart.count]);

  function updateField(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!cart.items.length) {
      toast.error('Giỏ hàng đang trống.');
      return;
    }

    const phone = normalizePhone(form.soDienThoaiNhan);
    if (!/^\+?[0-9]{9,15}$/.test(phone)) {
      toast.error('Số điện thoại nhận hàng không hợp lệ.');
      return;
    }
    if (!form.tenNguoiNhan.trim() || !form.diaChiGiaoHang.trim()) {
      toast.error('Vui lòng nhập đầy đủ người nhận và địa chỉ giao hàng.');
      return;
    }
    if (!['NOI_THANH', 'LAN_CAN'].includes(form.khuVucGiaoHang)) {
      toast.error('Vui lòng chọn khu vực giao hàng.');
      return;
    }
    if (cart.count > 100 || cart.items.some((item) => Number(item.soLuong || 0) > 50)) {
      toast.error('Một đơn tối đa 100 suất và mỗi món tối đa 50 suất.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await deliveryApi.create({
        clientRequestId: requestIdRef.current,
        tenNguoiNhan: form.tenNguoiNhan.trim(),
        soDienThoaiNhan: phone,
        diaChiGiaoHang: form.diaChiGiaoHang.trim(),
        khuVucGiaoHang: form.khuVucGiaoHang,
        ghiChuGiaoHang: form.ghiChuGiaoHang.trim() || null,
        phuongThucThanhToan: form.phuongThucThanhToan,
        ghiChuDonHang: form.ghiChuDonHang.trim() || null,
        items: cart.items.map((item) => ({
          maMonAn: Number(itemId(item)),
          soLuong: Number(item.soLuong || 1),
          ghiChu: String(item.ghiChu || '').trim() || null,
        })),
      });
      const order = unwrapDeliveryResponse(response);
      const trackingToken = order?.trackingToken;
      if (!trackingToken) throw new Error('Backend không trả về mã tra cứu đơn hàng.');

      sessionStorage.setItem('lumora_delivery_last_token', trackingToken);
      sessionStorage.setItem(`lumora_delivery_order_${trackingToken}`, JSON.stringify(order));
      cart.clear();
      toast.success('Đặt món giao tận nơi thành công. Nhà hàng sẽ xác nhận trước khi chế biến.');
      navigate(`/delivery/orders/${encodeURIComponent(trackingToken)}`, {
        replace: true,
        state: { order },
      });
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể tạo đơn giao hàng.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart.items.length) {
    return (
      <main className="delivery-public-page">
        <DeliveryPublicHeader compact />
        <section className="delivery-public-container delivery-empty-cart">
          <span><ShoppingBag size={42} /></span>
          <h1>Giỏ hàng đang trống</h1>
          <p>Hãy chọn món trước khi nhập thông tin giao hàng.</p>
          <Link to="/delivery"><ArrowLeft size={18} /> Quay lại thực đơn</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader compact />
      <section className="delivery-public-container delivery-checkout-heading">
        <Link to="/delivery"><ArrowLeft size={18} /> Tiếp tục chọn món</Link>
        <span>Hoàn tất đơn hàng</span>
        <h1>Thông tin giao món</h1>
        <p>Nhà hàng sẽ kiểm tra thông tin, xác nhận đơn rồi mới chuyển món xuống bếp.</p>
      </section>

      <form className="delivery-public-container delivery-checkout-grid" onSubmit={submit}>
        <div className="delivery-checkout-main">
          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><UserRound size={20} /></span><div><h2>Người nhận</h2><p>Thông tin để nhà hàng và người giao liên hệ</p></div></div>
            <div className="delivery-form-grid two">
              <label><span>Họ tên người nhận *</span><div><UserRound size={18} /><input required value={form.tenNguoiNhan} onChange={updateField('tenNguoiNhan')} maxLength={120} placeholder="Nguyễn Văn A" /></div></label>
              <label><span>Số điện thoại *</span><div><Phone size={18} /><input required value={form.soDienThoaiNhan} onChange={updateField('soDienThoaiNhan')} maxLength={20} placeholder="0901234567" inputMode="tel" /></div></label>
            </div>
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><MapPin size={20} /></span><div><h2>Địa chỉ giao hàng</h2><p>Phí giao được tính theo khu vực phục vụ</p></div></div>
            <div className="delivery-form-grid">
              <label><span>Địa chỉ chi tiết *</span><div><MapPin size={18} /><input required value={form.diaChiGiaoHang} onChange={updateField('diaChiGiaoHang')} maxLength={500} placeholder="Số nhà, đường, phường/xã, quận/huyện" /></div></label>
              <div className="delivery-form-grid two">
                <label><span>Khu vực giao hàng *</span><div><MapPin size={18} /><select value={form.khuVucGiaoHang} onChange={updateField('khuVucGiaoHang')}><option value="NOI_THANH">Nội thành · 15.000đ</option><option value="LAN_CAN">Khu vực lân cận · 25.000đ</option></select></div><small>{deliveryAreaLabel(form.khuVucGiaoHang)} · Phí {formatMoney(deliveryFee)}</small></label>
                <label><span>Ghi chú giao hàng</span><div><input value={form.ghiChuGiaoHang} onChange={updateField('ghiChuGiaoHang')} maxLength={500} placeholder="Gọi trước khi đến, số tầng..." /></div></label>
              </div>
            </div>
          </section>

          <section className="delivery-checkout-card">
            <div className="delivery-card-title"><span><CreditCard size={20} /></span><div><h2>Thanh toán</h2><p>Chọn phương thức phù hợp</p></div></div>
            <div className="delivery-payment-options">
              <label className={form.phuongThucThanhToan === 'COD' ? 'active' : ''}>
                <input type="radio" name="payment" value="COD" checked={form.phuongThucThanhToan === 'COD'} onChange={updateField('phuongThucThanhToan')} />
                <span><Banknote size={22} /></span><div><strong>Thanh toán khi nhận hàng</strong><small>Thanh toán cho người giao sau khi nhận món</small></div><CheckCircle2 size={20} />
              </label>
              <label className={form.phuongThucThanhToan === 'VIETQR' ? 'active' : ''}>
                <input type="radio" name="payment" value="VIETQR" checked={form.phuongThucThanhToan === 'VIETQR'} onChange={updateField('phuongThucThanhToan')} />
                <span><CreditCard size={22} /></span><div><strong>Chuyển khoản VietQR</strong><small>Chuyển khoản và chờ thu ngân xác nhận</small></div><CheckCircle2 size={20} />
              </label>
            </div>
            <label className="delivery-order-note"><span>Ghi chú chung cho đơn</span><textarea value={form.ghiChuDonHang} onChange={updateField('ghiChuDonHang')} maxLength={255} placeholder="Ví dụ: Không lấy dụng cụ nhựa..." /></label>
          </section>
        </div>

        <aside className="delivery-order-summary">
          <div className="delivery-summary-head"><div><span>Đơn hàng</span><h2>{itemCountLabel}</h2></div><ShoppingBag size={24} /></div>
          <div className="delivery-summary-items">
            {cart.items.map((item) => (
              <article key={itemId(item)}>
                <div className="delivery-summary-image">{item?.hinhAnh ? <img src={imageUrl(item.hinhAnh)} alt={item.tenMonAn} /> : <ShoppingBag size={22} />}</div>
                <div className="delivery-summary-copy"><strong>{item.tenMonAn}</strong><span>{formatMoney(item.gia)}</span><input value={item.ghiChu || ''} onChange={(event) => cart.updateNote(itemId(item), event.target.value)} maxLength={255} placeholder="Ghi chú món..." /></div>
                <div className="delivery-summary-qty">
                  <button type="button" onClick={() => item.soLuong <= 1 ? cart.remove(itemId(item)) : cart.updateQty(itemId(item), item.soLuong - 1)}>{item.soLuong <= 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button>
                  <b>{item.soLuong}</b>
                  <button type="button" onClick={() => cart.updateQty(itemId(item), item.soLuong + 1)} disabled={item.soLuong >= 50 || cart.count >= 100}><Plus size={15} /></button>
                </div>
              </article>
            ))}
          </div>
          <div className="delivery-summary-money">
            <p><span>Tạm tính</span><strong>{formatMoney(cart.total)}</strong></p>
            <p><span>Phí giao hàng</span><strong>{formatMoney(deliveryFee)}</strong></p>
            <div><span>Tổng thanh toán</span><strong>{formatMoney(total)}</strong></div>
          </div>
          <button className="delivery-submit-order" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={19} /> : <ShoppingBag size={19} />}
            {submitting ? 'Đang gửi đơn...' : 'Đặt món giao tận nơi'}
          </button>
          <small className="delivery-submit-note">Nhà hàng có thể liên hệ để xác nhận địa chỉ và khả năng phục vụ trước khi chế biến.</small>
        </aside>
      </form>
    </main>
  );
}
