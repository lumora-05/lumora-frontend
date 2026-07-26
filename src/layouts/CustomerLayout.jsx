import { Outlet, useParams } from 'react-router-dom';
import { CartProvider } from '../context/CartContext';
import LumoraChatbot from '../components/customer/LumoraChatbot';

export default function CustomerLayout() {
  const { qrToken } = useParams();
  return (
    <CartProvider qrToken={qrToken}>
      <div className="customer-shell"><Outlet /></div>
      <LumoraChatbot qrToken={qrToken} />
    </CartProvider>
  );
}
