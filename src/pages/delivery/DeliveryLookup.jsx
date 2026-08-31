import { ArrowLeft, KeyRound, LoaderCircle, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { deliveryApi } from '../../api/deliveryApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { unwrapDeliveryResponse } from '../../utils/delivery';

function normalizeOrderCode(value) {
  return String(value || '').trim().toUpperCase();
}


export default function DeliveryLookup() {
  const navigate = useNavigate();
  const toast = useToast();
  const [orderCode, setOrderCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const normalizedOrderCode = normalizeOrderCode(orderCode);
    if (!normalizedOrderCode) {
      toast.error('Vui lòng nhập mã đơn hàng.');
      return;
    }
    setLoading(true);
    try {
      const response = await deliveryApi.lookup(normalizedOrderCode);
      const order = unwrapDeliveryResponse(response);
      const trackingToken = order?.trackingToken;
      if (!trackingToken) throw new Error('Backend không trả về mã theo dõi đơn hàng.');
      sessionStorage.setItem('lumora_delivery_last_token', trackingToken);
      sessionStorage.setItem(`lumora_delivery_order_${trackingToken}`, JSON.stringify(order));
      navigate(`/menu/orders/${encodeURIComponent(trackingToken)}`, { state: { order } });
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tìm thấy đơn hàng.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader homeStyle />
      <section className="delivery-public-container delivery-lookup-page">
        <Link to="/menu"><ArrowLeft size={18} /> Quay lại thực đơn</Link>
        <div className="delivery-lookup-card large">
          <span><KeyRound size={36} /></span>
          <small>THEO DÕI GIAO HÀNG</small>
          <h1>Tra cứu đơn đã đặt</h1>
          <p>Nhập mã đơn hàng được cấp sau khi đặt món để xem trạng thái đơn.</p>
          <form onSubmit={submit}>
            <label><span>Mã đơn hàng</span><div><Search size={19} /><input value={orderCode} onChange={(event) => setOrderCode(event.target.value)} placeholder="Ví dụ: DH0000191" autoComplete="off" /></div></label>
            <button type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}{loading ? 'Đang tra cứu...' : 'Tra cứu đơn'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
