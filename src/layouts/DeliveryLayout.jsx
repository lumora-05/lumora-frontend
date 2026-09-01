import { Outlet } from 'react-router-dom';
import { CartProvider } from '../context/CartContext';
import LumoraChatbot from '../components/customer/LumoraChatbot';

export default function DeliveryLayout() {
  return (
    <CartProvider qrToken="delivery">
      <Outlet />
      <LumoraChatbot />
    </CartProvider>
  );
}
