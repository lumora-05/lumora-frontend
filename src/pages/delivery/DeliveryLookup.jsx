import { ArrowLeft, KeyRound, LoaderCircle, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DeliveryPublicHeader from '../../components/delivery/DeliveryPublicHeader';
import { deliveryApi } from '../../api/deliveryApi';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { unwrapDeliveryResponse } from '../../utils/delivery';

function normalizeToken(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const parts = url.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts.at(-1) || '').trim();
  } catch {
    return text;
  }
}

export default function DeliveryLookup() {
  const navigate = useNavigate();
  const toast = useToast();
  const [trackingToken, setTrackingToken] = useState(
    () => sessionStorage.getItem('lumora_delivery_last_token') || '',
  );
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const token = normalizeToken(trackingToken);
    if (!token) {
      toast.error('Vui lòng nhập mã tra cứu bí mật.');
      return;
    }
    setLoading(true);
    try {
      const response = await deliveryApi.track(token);
      const order = unwrapDeliveryResponse(response);
      sessionStorage.setItem('lumora_delivery_last_token', token);
      sessionStorage.setItem(`lumora_delivery_order_${token}`, JSON.stringify(order));
      navigate(`/menu/orders/${encodeURIComponent(token)}`, { state: { order } });
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tìm thấy đơn hàng theo mã tra cứu.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="delivery-public-page">
      <DeliveryPublicHeader compact />
      <section className="delivery-public-container delivery-lookup-page">
        <Link to="/menu"><ArrowLeft size={18} /> Quay lại thực đơn</Link>
        <div className="delivery-lookup-card large">
          <span><KeyRound size={36} /></span>
          <small>THEO DÕI GIAO HÀNG</small>
          <h1>Tra cứu đơn đã đặt</h1>
          <p>Nhập mã tra cứu bí mật được cấp sau khi đặt món. Không chia sẻ mã này cho người khác.</p>
          <form onSubmit={submit}>
            <label><span>Mã tra cứu bí mật</span><div><Search size={19} /><input value={trackingToken} onChange={(event) => setTrackingToken(event.target.value)} placeholder="Dán mã tra cứu hoặc đường dẫn theo dõi" autoComplete="off" /></div></label>
            <button type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <Search size={19} />}{loading ? 'Đang tra cứu...' : 'Tra cứu trạng thái'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
