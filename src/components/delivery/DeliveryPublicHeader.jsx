import { ArrowLeft, Bike, Search, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { imageUrl } from '../../utils/imageUrl';

export default function DeliveryPublicHeader({ compact = false, homeStyle = false }) {
  const cart = useCart();
  const [settings, setSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

  useEffect(() => {
    if (!homeStyle) return undefined;
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        if (data) setSettings((current) => ({ ...current, ...data }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [homeStyle]);

  if (homeStyle) {
    const logo = imageUrl(settings.logoUrl);
    return (
      <header className="delivery-public-header delivery-home-header">
        <div className="delivery-public-header-inner delivery-home-header-inner">
          <Link className="delivery-home-brand" to="/">
            {logo ? (
              <span className="delivery-home-brand-logo"><img src={logo} alt={`Logo ${settings.restaurantName || 'LUMORA'}`} /></span>
            ) : (
              <span className="delivery-home-brand-mark">{String(settings.restaurantName || 'L').trim().charAt(0).toUpperCase()}</span>
            )}
          </Link>

          <nav className="delivery-public-nav delivery-home-nav" aria-label="Điều hướng thực đơn trực tuyến">
            <Link to="/#trang-chu">Trang chủ</Link>
            <NavLink to="/delivery" end>Thực đơn</NavLink>
            <Link to="/#gioi-thieu">Về chúng tôi</Link>
            <Link to="/#dat-mon">Đặt món</Link>
            <Link to="/#lien-he">Liên hệ</Link>
          </nav>

          <div className="delivery-header-actions">
            <Link className="delivery-cart-button delivery-home-cart-button" to="/delivery/checkout">
              <ShoppingBag size={18} />
              <span>Giỏ hàng</span>
              <b>{cart?.count || 0}</b>
            </Link>
          </div>
        </div>
      </header>
    );
  }

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
