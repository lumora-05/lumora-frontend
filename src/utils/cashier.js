export const CASHIER_STATUS = {
  CHO_THANH_TOAN: { label: 'Chờ thanh toán', tone: 'warning' },
  SAN_SANG_THANH_TOAN: { label: 'Chờ thanh toán', tone: 'warning' },
  DA_PHUC_VU: { label: 'Có thể thanh toán', tone: 'info' },
  DA_THANH_TOAN: { label: 'Đã thanh toán', tone: 'success' },
  DA_HUY: { label: 'Đã hủy', tone: 'muted' },
  HUY: { label: 'Đã hủy', tone: 'muted' },
};

export const PAYMENT_REQUEST_STATUSES = ['CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN'];
export const PAYABLE_STATUSES = [...PAYMENT_REQUEST_STATUSES, 'DA_PHUC_VU'];
export const PAID_STATUSES = ['DA_THANH_TOAN'];
export const CANCELED_STATUSES = ['DA_HUY', 'HUY'];

export function unwrap(response, fallback = []) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.data?.content)) return response.data.content;
  return fallback;
}

export function invoiceCode(order) {
  const raw = order?.maHoaDon || order?.hoaDon?.maHoaDon || order?.maDonHang || order?.id || '';
  if (String(raw).toUpperCase().startsWith('HD')) return String(raw).toUpperCase();
  const numeric = String(raw).replace(/\D/g, '') || String(raw);
  return `HD${numeric.padStart(7, '0')}`;
}

export function orderCode(order) {
  const raw = order?.maDonHang ?? order?.id ?? '';
  if (String(raw).toUpperCase().startsWith('DH')) return String(raw).toUpperCase();
  const numeric = String(raw).replace(/\D/g, '') || String(raw);
  return `DH${numeric.padStart(7, '0')}`;
}

export function documentCode(order) {
  return PAID_STATUSES.includes(order?.trangThai) || order?.maHoaDon || order?.hoaDon?.maHoaDon
    ? invoiceCode(order)
    : orderCode(order);
}

export function orderIdOf(order) {
  return order?.maDonHang ?? order?.id ?? order?.maHoaDon;
}

export function tableNameOf(order) {
  return order?.banAn?.tenBan || order?.tenBan || order?.ban || 'Mang đi';
}

export function itemCountOf(order) {
  if (Number.isFinite(Number(order?.soMon))) return Number(order.soMon);
  return (order?.chiTietDonHang || []).reduce((sum, item) => sum + Number(item?.soLuong || 0), 0);
}

export function guestCountOf(order) {
  return order?.soKhach ?? order?.soLuongKhach ?? order?.banAn?.soCho ?? '—';
}

export function statusInfo(status) {
  return CASHIER_STATUS[status] || { label: status || 'Không xác định', tone: 'neutral' };
}

export function orderTimeOf(order) {
  return order?.thoiGianDat || order?.ngayTao || order?.createdAt;
}

export function paymentRequestTimeOf(order) {
  return order?.thoiGianYeuCauThanhToan
    || order?.thoiGianCapNhat
    || order?.updatedAt
    || orderTimeOf(order);
}

export function paymentTimeOf(order) {
  return order?.thoiGianThanhToan
    || order?.thanhToan?.thoiGianThanhToan
    || order?.payment?.thoiGianThanhToan
    || order?.thoiGianCapNhat
    || orderTimeOf(order);
}

export function localDateValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function timeText(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function dateTimeText(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function elapsedInfo(value, now = Date.now()) {
  if (!value) return { minutes: 0, label: 'Chưa có thời gian', tone: 'normal' };
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return { minutes: 0, label: 'Chưa có thời gian', tone: 'normal' };
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  const tone = minutes >= 15 ? 'urgent' : minutes >= 8 ? 'warning' : 'normal';
  if (minutes < 1) return { minutes, label: 'Vừa yêu cầu', tone };
  if (minutes < 60) return { minutes, label: `Đã chờ ${minutes} phút`, tone };
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return { minutes, label: `Đã chờ ${hours} giờ${rest ? ` ${rest} phút` : ''}`, tone };
}

export function subtotalOf(order) {
  const explicit = Number(order?.tamTinh);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  return (order?.chiTietDonHang || [])
    .filter((item) => item?.trangThaiMon !== 'DA_HUY')
    .reduce((sum, item) => {
      const price = Number(item?.donGia ?? item?.monAn?.gia ?? item?.gia ?? 0);
      return sum + price * Number(item?.soLuong || 0);
    }, 0);
}

export function serviceFeeOf(order) {
  return Number(order?.phiPhucVu ?? order?.phiDichVu ?? 0);
}

export function discountOf(order) {
  return Number(order?.tienGiam ?? order?.giamGia ?? order?.soTienGiam ?? 0);
}

export function totalOf(order) {
  const explicit = Number(order?.tongTien ?? order?.tongCong);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  return Math.max(0, subtotalOf(order) + serviceFeeOf(order) - discountOf(order));
}
