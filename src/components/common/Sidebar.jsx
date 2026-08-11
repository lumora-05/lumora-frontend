import { NavLink } from 'react-router-dom';
import { AlertTriangle, BarChart3, Bell, BellRing, Bike, Boxes, CalendarCheck2, ChefHat, ClipboardList, CreditCard, Gift, Grid2X2, History, Home, LogOut, Printer, QrCode, ReceiptText, Settings, Star, Table2, Tags, Users, Utensils } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const iconMap = {
  dashboard: Grid2X2,
  users: Users,
  table: Table2,
  menu: Utensils,
  orders: ClipboardList,
  report: BarChart3,
  home: Home,
  qr: QrCode,
  list: ClipboardList,
  category: Tags,
  inventory: Boxes,
  gift: Gift,
  account: Settings,
  settings: Settings,
  notify: Bell,
  review: Star,
  service: BellRing,
  cashier: CreditCard,
  kitchen: ChefHat,
  history: History,
  alert: AlertTriangle,
  printer: Printer,
  receipt: ReceiptText,
  reservation: CalendarCheck2,
  delivery: Bike,
};

export default function Sidebar({ title, items, logoUrl = '', restaurantName = 'LUMORA' }) {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar admin-sidebar">
      <div className={`brand${logoUrl ? ' has-restaurant-logo' : ''}`}>
        {logoUrl ? (
          <>
            <div className="brand-logo-image">
              <img src={logoUrl} alt={`Logo ${restaurantName}`} />
            </div>
          </>
        ) : (
          <>
            <div className="brand-logo">{(restaurantName || 'L').trim().charAt(0).toUpperCase()}</div>
            <div className="brand-text">
              <b>LUMORA</b>
              <span>{title}</span>
            </div>
          </>
        )}
      </div>

      <nav>
        {items.map((i) => {
          const Icon = iconMap[i.icon] || Home;
          return (
            <NavLink key={i.to} to={i.to} end={i.to.split('/').length <= 2} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={20} />
              {i.label}
            </NavLink>
          );
        })}
      </nav>

      {user && <button className="sidebar-logout" onClick={logout}><LogOut size={18} />Đăng xuất</button>}
    </aside>
  );
}
