import { useEffect, useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  ConciergeBell,
  QrCode,
  ShoppingCart,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { tableApi } from '../../api/tableApi';
import { systemSettingApi, systemSettingData } from '../../api/systemSettingApi';
import { imageUrl } from '../../utils/imageUrl';
import { useCart } from '../../context/CartContext';
import CustomerServiceRequest from './CustomerServiceRequest';
import LanguageSwitcher from '../common/LanguageSwitcher';

function isOrdersPath(pathname) {
  return pathname.includes('/orders') || pathname.includes('/success');
}

function normalizeTableLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d+$/.test(text)) return `Bàn ${text.padStart(2, '0')}`;
  return text;
}

function tableLabelFromResponse(response) {
  const data = response?.data ?? response;
  const table = data?.banAn ?? data?.table ?? data;
  return normalizeTableLabel(
    table?.tenBan
    ?? table?.soBan
    ?? table?.tableNumber
    ?? table?.name,
  );
}

function tableCacheKey(qrToken) {
  return `lumora_customer_table_label_${qrToken || 'unknown'}`;
}

function readCachedTableLabel(qrToken) {
  try {
    return normalizeTableLabel(window.sessionStorage.getItem(tableCacheKey(qrToken)));
  } catch {
    return '';
  }
}

function cacheTableLabel(qrToken, label) {
  try {
    window.sessionStorage.setItem(tableCacheKey(qrToken), label);
  } catch {
    // Không ảnh hưởng việc hiển thị nếu trình duyệt chặn sessionStorage.
  }
}

export default function CustomerHeader({ tableName, variant = 'default' }) {
  const { qrToken } = useParams();
  const { pathname } = useLocation();
  const cart = useCart();
  const fallbackTable = 'Bàn';
  const [resolvedTableId, setResolvedTableId] = useState(null);
  const [showcaseBrand, setShowcaseBrand] = useState({ restaurantName: 'LUMORA', logoUrl: '' });
  const [displayTable, setDisplayTable] = useState(
    () => normalizeTableLabel(tableName) || readCachedTableLabel(qrToken) || fallbackTable,
  );

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const settings = systemSettingData(response);
        setShowcaseBrand({
          restaurantName: settings?.restaurantName || 'LUMORA',
          logoUrl: settings?.logoUrl || '',
        });
      })
      .catch(() => {
        // Giữ wordmark dự phòng nếu không tải được cài đặt công khai.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const providedLabel = normalizeTableLabel(tableName);
    const cachedLabel = readCachedTableLabel(qrToken);

    if (providedLabel) {
      setDisplayTable(providedLabel);
      cacheTableLabel(qrToken, providedLabel);
    } else if (cachedLabel) {
      setDisplayTable(cachedLabel);
    }

    let active = true;
    tableApi.customerTableByQrToken(qrToken)
      .then((response) => {
        if (!active) return;
        const data = response?.data ?? response;
        const table = data?.banAn ?? data?.table ?? data;
        setResolvedTableId(table?.maBan ?? table?.id ?? null);
        const resolvedLabel = tableLabelFromResponse(response);
        if (!resolvedLabel) return;
        setDisplayTable(resolvedLabel);
        cacheTableLabel(qrToken, resolvedLabel);
      })
      .catch(() => {
        if (active && !cachedLabel && !providedLabel) setDisplayTable(fallbackTable);
      });

    return () => {
      active = false;
    };
  }, [fallbackTable, qrToken, tableName]);

  const menuActive = pathname === `/table/${qrToken}` || pathname.includes('/foods/');
  const cartActive = pathname.endsWith('/cart');
  const ordersActive = isOrdersPath(pathname);
  const reviewsActive = pathname.includes('/reviews');
  const isMenuShowcase = variant === 'menu-showcase';
  const headerClassName = `customer-site-header${isMenuShowcase ? ' menu-showcase' : ''}`;
  const brandClassName = `customer-site-brand${isMenuShowcase ? ' menu-showcase' : ''}`;
  const navClassName = `customer-site-nav${isMenuShowcase ? ' menu-showcase' : ''}`;
  const actionsClassName = `customer-header-actions${isMenuShowcase ? ' menu-showcase' : ''}`;
  const tableBadgeClassName = `customer-table-badge${isMenuShowcase ? ' menu-showcase' : ''}`;

  return (
    <>
      <header className={headerClassName}>
        <Link className={brandClassName} to={`/table/${qrToken}`}>
          {showcaseBrand.logoUrl ? (
            <span className="customer-site-brand-home-logo">
              <img
                src={imageUrl(showcaseBrand.logoUrl)}
                alt={`Logo ${showcaseBrand.restaurantName}`}
              />
            </span>
          ) : isMenuShowcase ? (
            <>
              <span className="customer-site-brand-wordmark-star" aria-hidden="true">✦</span>
              <span className="customer-site-brand-wordmark-copy">
                <strong>LUMORA</strong>
                <small>RESTAURANT</small>
              </span>
            </>
          ) : (
            <>
              <span className="customer-site-brand-mark">{String(showcaseBrand.restaurantName || 'L').trim().charAt(0).toUpperCase()}</span>
              <span>
                <strong>LUMORA</strong>
                <small>Restaurant</small>
              </span>
            </>
          )}
        </Link>

        <nav className={navClassName} aria-label="Điều hướng khách hàng">
          <Link className={menuActive ? 'active' : ''} to={`/table/${qrToken}`}>
            {isMenuShowcase ? <BookOpen size={18} /> : <UtensilsCrossed size={19} />}
            <span>Thực đơn</span>
          </Link>
          <Link className={cartActive ? 'active' : ''} to={`/table/${qrToken}/cart`}>
            <ShoppingCart size={18} />
            <span>Giỏ hàng</span>
            {cart.count > 0 ? <b>{cart.count}</b> : null}
          </Link>
          <Link className={ordersActive ? 'active' : ''} to={`/table/${qrToken}/orders`}>
            <ClipboardList size={18} />
            <span>Đơn hàng</span>
          </Link>
          <Link className={reviewsActive ? 'active' : ''} to={`/table/${qrToken}/reviews`}>
            <Star size={18} />
            <span>Đánh giá</span>
          </Link>
        </nav>

        <div className={actionsClassName}>
          <LanguageSwitcher compact />
          <CustomerServiceRequest qrToken={qrToken} tableId={resolvedTableId} />
          <div className={tableBadgeClassName}>
            {isMenuShowcase ? <span className="customer-table-badge-icon" aria-hidden="true"><QrCode size={16} /></span> : null}
            <span>{displayTable}</span>
            {!isMenuShowcase ? <span className="customer-table-badge-icon" aria-hidden="true"><QrCode size={15} /></span> : null}
          </div>
        </div>
      </header>

      <nav className="customer-mobile-nav" aria-label="Điều hướng khách hàng trên điện thoại">
        <Link className={menuActive ? 'active' : ''} to={`/table/${qrToken}`}>
          <UtensilsCrossed size={21} /><span>Thực đơn</span>
        </Link>
        <Link className={cartActive ? 'active' : ''} to={`/table/${qrToken}/cart`}>
          <span className="customer-mobile-cart-icon"><ShoppingCart size={21} />{cart.count > 0 ? <b>{cart.count}</b> : null}</span>
          <span>Giỏ hàng</span>
        </Link>
        <Link className={ordersActive ? 'active' : ''} to={`/table/${qrToken}/orders`}>
          <ClipboardList size={21} /><span>Đơn hàng</span>
        </Link>
        <Link className={reviewsActive ? 'active' : ''} to={`/table/${qrToken}/reviews`}>
          <Star size={21} /><span>Đánh giá</span>
        </Link>
      </nav>
    </>
  );
}
