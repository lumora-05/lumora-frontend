import { Outlet } from 'react-router-dom';
import { CartProvider } from '../context/CartContext';

export default function DeliveryLayout() {
  return (
    <CartProvider qrToken="delivery">
      <Outlet />
    </CartProvider>
  );
}
