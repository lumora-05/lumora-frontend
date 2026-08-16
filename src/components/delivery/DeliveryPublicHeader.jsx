import { ArrowLeft, Bike, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { imageUrl } from '../../utils/imageUrl';
import { getCustomerUser, onCustomerSessionChange } from '../../utils/customerSession';
import LanguageSwitcher from '../common/LanguageSwitcher';

export default function DeliveryPublicHeader({ compact = false, homeStyle = false }) {
  const cart = useCart();
  const [settings, setSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });
  const [customer, setCustomer] = useState(getCustomerUser());

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        if (data) setSettings((current) => ({ ...current, ...data }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => onCustomerSessionChange(() => setCustomer(getCustomerUser())), []);

  const logo = imageUrl(settings.logoUrl);

  if (homeStyle) {
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
            <NavLink to="/menu" end>Thực đơn</NavLink>
            <Link to="/#gioi-thieu">Về chúng tôi</Link>
            <Link to="/reservations">Đặt bàn</Link>
            <Link to="/#lien-he">Liên hệ</Link>
          </nav>

          <div className="delivery-header-actions">
            <LanguageSwitcher compact />
            <Link className="delivery-customer-account-link delivery-home-account-link" to={customer ? '/menu/account' : '/login?next=/menu/account'}>
              <UserRound size={18} /><span>{customer ? customer.hoTen?.split(' ').slice(-1)[0] || 'Tài khoản' : 'Đăng nhập'}</span>
            </Link>
            <Link className="delivery-cart-button delivery-home-cart-button" to="/menu/checkout">
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
        <Link className={`delivery-brand${logo ? ' has-restaurant-logo' : ''}`} to="/">
          {logo ? (
            <span className="delivery-brand-logo-image">
              <img src={logo} alt={`Logo ${settings.restaurantName || 'LUMORA'}`} />
            </span>
          ) : (
            <>
              <span className="delivery-brand-fallback-mark">{String(settings.restaurantName || 'L').trim().charAt(0).toUpperCase()}</span>
              <div><strong>{settings.restaurantName || 'LUMORA'}</strong><small>Giao món tận nơi</small></div>
            </>
          )}
        </Link>

        <nav className="delivery-public-nav" aria-label="Điều hướng đặt món giao tận nơi">
          <NavLink to="/menu" end><Bike size={17} /> Thực đơn giao hàng</NavLink>
          <NavLink to="/menu/lookup"><Search size={17} /> Tra cứu đơn</NavLink>
        </nav>

        <div className="delivery-header-actions">
          <LanguageSwitcher compact />
          <Link className="delivery-customer-account-link" to={customer ? '/menu/account' : '/login?next=/menu/account'}>
            <UserRound size={17} /><span>{customer ? 'Tài khoản' : 'Đăng nhập'}</span>
          </Link>
          <Link className="delivery-back-home" to="/"><ArrowLeft size={17} /> Trang chủ</Link>
          <Link className="delivery-cart-button" to="/menu/checkout">
            <ShoppingBag size={18} />
            <span>Giỏ hàng</span>
            <b>{cart?.count || 0}</b>
          </Link>
        </div>
      </div>
    </header>
  );
}
