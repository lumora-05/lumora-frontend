import { ArrowLeft, Bike, Search, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

export default function DeliveryPublicHeader({ compact = false }) {
  const cart = useCart();

  return (
    <header className={`delivery-public-header ${compact ? 'compact' : ''}`}>
      <div className="delivery-public-header-inner">
        <Link className="delivery-brand" to="/">
          <span><UtensilsCrossed size={22} /></span>
          <div><strong>LUMORA</strong><small>Giao món tận nơi</small></div>
        </Link>

        <nav className="delivery-public-nav" aria-label="Điều hướng đặt món giao tận nơi">
          <NavLink to="/delivery" end><Bike size={17} /> Thực đơn giao hàng</NavLink>
          <NavLink to="/delivery/lookup"><Search size={17} /> Tra cứu đơn</NavLink>
        </nav>

        <div className="delivery-header-actions">
          <Link className="delivery-back-home" to="/"><ArrowLeft size={17} /> Trang chủ</Link>
          <Link className="delivery-cart-button" to="/delivery/checkout">
            <ShoppingBag size={18} />
            <span>Giỏ hàng</span>
            <b>{cart?.count || 0}</b>
          </Link>
        </div>
      </div>
    </header>
  );
}
