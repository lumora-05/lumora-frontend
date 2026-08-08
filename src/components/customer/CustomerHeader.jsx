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
import { useCart } from '../../context/CartContext';
import CustomerServiceRequest from './CustomerServiceRequest';

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
  const [displayTable, setDisplayTable] = useState(
    () => normalizeTableLabel(tableName) || readCachedTableLabel(qrToken) || fallbackTable,
  );

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
          {isMenuShowcase ? (
            <>
              <span className="customer-site-brand-wordmark-star" aria-hidden="true">✦</span>
              <span className="customer-site-brand-wordmark-copy">
                <strong>LUMORA</strong>
                <small>RESTAURANT</small>
              </span>
            </>
          ) : (
            <>
              <span className="customer-site-brand-mark"><UtensilsCrossed size={24} /></span>
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
