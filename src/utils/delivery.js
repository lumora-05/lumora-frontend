export const DELIVERY_ORDER_STATUSES = [
  'ALL',
  'CHO_XAC_NHAN',
  'DANG_CHUAN_BI',
  'CHO_BAN_GIAO',
  'DANG_GIAO',
  'HOAN_THANH',
  'GIAO_THAT_BAI',
  'DA_HUY',
];

const STATUS_LABELS = {
  ALL: 'Tất cả',
  CHO_XAC_NHAN: 'Chờ xác nhận',
  DANG_CHUAN_BI: 'Đang chuẩn bị',
  CHO_BAN_GIAO: 'Chờ bàn giao',
  DANG_GIAO: 'Đang giao',
  HOAN_THANH: 'Hoàn thành',
  GIAO_THAT_BAI: 'Giao thất bại',
  DA_HUY: 'Đã hủy',
  CHO_BEP: 'Chờ bếp',
  DANG_NAU: 'Đang chế biến',
  DANG_CHE_BIEN: 'Đang chế biến',
  DA_HOAN_THANH: 'Hoàn thành',
  DA_THANH_TOAN: 'Đã thanh toán',
  CHO_THANH_TOAN: 'Chờ thanh toán',
  CHO_HOAN_TIEN: 'Chờ hoàn tiền',
};

const PAYMENT_LABELS = {
  CHO_THANH_TOAN: 'Chờ thanh toán',
  DA_THANH_TOAN: 'Đã thanh toán',
  CHO_HOAN_TIEN: 'Chờ hoàn tiền',
};

export function deliveryStatusLabel(value) {
  const code = String(value || '').trim().toUpperCase();
  return STATUS_LABELS[code] || value || 'Chưa xác định';
}

export function deliveryPaymentLabel(value) {
  const code = String(value || '').trim().toUpperCase();
  return PAYMENT_LABELS[code] || value || 'Chưa xác định';
}

export function deliveryStatusClass(value) {
  return String(value || '').toLowerCase().replaceAll('_', '-');
}

export function unwrapDeliveryResponse(response) {
  return response?.data ?? response ?? null;
}

export function unwrapDeliveryList(response) {
  const data = unwrapDeliveryResponse(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function calculateDeliveryFee(area) {
  const code = String(area || '').toUpperCase();
  if (code === 'NOI_THANH') return 15000;
  if (code === 'LAN_CAN') return 25000;
  return 0;
}

export function deliveryAreaLabel(area) {
  const code = String(area || '').toUpperCase();
  if (code === 'NOI_THANH') return 'Nội thành';
  if (code === 'LAN_CAN') return 'Khu vực lân cận';
  return area || 'Chưa xác định';
}

export function normalizePhone(value) {
  return String(value || '').replace(/[ .()\-]/g, '');
}

export function isDeliveryFinished(status) {
  return ['HOAN_THANH', 'DA_HUY'].includes(String(status || '').toUpperCase());
}

export function deliveryOrderId(order) {
  return order?.maDonHang ?? order?.id;
}

export function deliveryData(order) {
  return order?.giaoHang || order?.delivery || {};
}

export function displayOrderCode(order) {
  const id = deliveryOrderId(order);
  return order?.maDonHangHienThi || (id == null ? '—' : `DH${String(id).padStart(7, '0')}`);
}
