import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import { useAuth } from '../hooks/useAuth';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { imageUrl } from '../utils/imageUrl';

const pageMeta = {
  '/admin': ['Tổng quan', ''],
  '/admin/menu': ['Món ăn', 'Quản lý và cập nhật danh sách món ăn trong nhà hàng'],
  '/admin/orders': ['Đơn hàng', 'Theo dõi và xử lý đơn hàng của nhà hàng'],
  '/admin/customers': ['Khách hàng thân thiết', 'Quản lý thông tin, điểm tích lũy và lịch sử giao dịch của khách hàng'],
  '/admin/tables': ['Bàn & Đặt chỗ', 'Quản lý bàn, mã QR và lịch đặt chỗ của nhà hàng'],
  '/admin/categories': ['Danh mục', 'Quản lý danh mục món ăn'],
  '/admin/inventory': ['Kho nguyên liệu', 'Theo dõi tồn kho, nhập xuất và cảnh báo nguyên liệu'],
  '/admin/reports': ['Thống kê', 'Theo dõi và phân tích hoạt động kinh doanh theo thời gian'],
  '/admin/reviews': ['Đánh giá', 'Theo dõi phản hồi và mức độ hài lòng của khách hàng'],
  '/admin/promotions': ['Khuyến mãi', 'Quản lý các chương trình ưu đãi và mã giảm giá'],
  '/admin/employees': ['Nhân viên', 'Quản lý tài khoản và phân quyền nhân viên'],
  '/admin/account': ['Tài khoản', 'Quản lý thông tin cá nhân và bảo mật tài khoản quản trị'],
  '/admin/settings': ['Cài đặt hệ thống', 'Quản lý thông tin nhà hàng, logo và banner trang chủ'],
};

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [brandSettings, setBrandSettings] = useState({ restaurantName: 'LUMORA', logoUrl: '' });

  useEffect(() => {
    let active = true;
    systemSettingApi.getPublic()
      .then((response) => {
        if (!active) return;
        const data = systemSettingData(response);
        setBrandSettings((current) => ({ ...current, ...(data || {}) }));
      })
      .catch(() => {
        // Giữ nhận diện mặc định nếu backend tạm thời không phản hồi.
      });
    return () => { active = false; };
  }, []);
  const items = [
    { to: '/admin', label: 'Tổng quan', icon: 'dashboard' },
    { to: '/admin/categories', label: 'Danh mục', icon: 'category' },
    { to: '/admin/menu', label: 'Món ăn', icon: 'menu' },
    { to: '/admin/orders', label: 'Đơn hàng', icon: 'orders' },
    { to: '/admin/customers', label: 'Khách hàng', icon: 'users' },
    { to: '/admin/tables', label: 'Bàn & Đặt chỗ', icon: 'table' },
    { to: '/admin/employees', label: 'Nhân viên', icon: 'users' },
    { to: '/admin/promotions', label: 'Khuyến mãi', icon: 'gift' },
    { to: '/admin/inventory', label: 'Kho nguyên liệu', icon: 'inventory' },
    { to: '/admin/reviews', label: 'Đánh giá', icon: 'review' },
    { to: '/admin/reports', label: 'Thống kê', icon: 'report' },
    { to: '/admin/settings', label: 'Cài đặt hệ thống', icon: 'settings' },
  ];

  const normalizedPath = location.pathname.length > 1
    ? location.pathname.replace(/\/+$/, '')
    : location.pathname;
  const [title, defaultSubtitle] = pageMeta[normalizedPath] || pageMeta['/admin'];
  const displayName = user?.hoTen || user?.fullName || user?.tenNhanVien || user?.tenDangNhap || user?.username || 'Quản trị viên';
  const subtitle = normalizedPath === '/admin'
    ? `Xin chào ${displayName}, chúc bạn một ngày làm việc hiệu quả!`
    : defaultSubtitle;

  return (
    <div className="app-shell admin-shell">
      <Sidebar
        title="Quản lý nhà hàng"
        items={items}
        logoUrl={imageUrl(brandSettings.logoUrl)}
        restaurantName={brandSettings.restaurantName}
      />
      <main className="admin-main">
        <Header title={title} subtitle={subtitle} />
        <Outlet />
      </main>
    </div>
  );
}
