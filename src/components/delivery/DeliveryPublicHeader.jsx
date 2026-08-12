import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { imageUrl } from '../../utils/imageUrl';

export default function DeliveryPublicHeader({ compact = false, homeStyle = false }) {
  const [settings, setSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

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

          <nav className="delivery-public-nav delivery-home-nav" aria-label="Điều hướng thực đơn">
            <Link to="/#trang-chu">Trang chủ</Link>
            <NavLink to="/menu" end>Thực đơn</NavLink>
            <Link to="/#gioi-thieu">Về chúng tôi</Link>
            <Link to="/reservations">Đặt bàn</Link>
            <Link to="/#lien-he">Liên hệ</Link>
          </nav>

          <div className="delivery-header-actions">
            <Link className="delivery-back-home" to="/"><ArrowLeft size={17} /> Trang chủ</Link>
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
              <div><strong>{settings.restaurantName || 'LUMORA'}</strong><small>Thực đơn nhà hàng</small></div>
            </>
          )}
        </Link>

        <nav className="delivery-public-nav" aria-label="Điều hướng thực đơn">
          <NavLink to="/menu" end>Thực đơn</NavLink>
        </nav>

        <div className="delivery-header-actions">
          <Link className="delivery-back-home" to="/"><ArrowLeft size={17} /> Trang chủ</Link>
        </div>
      </div>
    </header>
  );
}
