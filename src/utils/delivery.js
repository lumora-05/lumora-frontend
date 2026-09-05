export const DELIVERY_ORDER_STATUSES = [
  'ALL',
  'CHO_THANH_TOAN',
  'CHO_XAC_NHAN',
  'CHO_DEN_GIO',
  'DANG_CHUAN_BI',
  'CHO_TAI_XE_NHAN',
  'CHO_BAN_GIAO',
  'CHO_KHACH_NHAN',
  'DANG_GIAO',
  'CHO_DOI_SOAT',
  'HOAN_THANH',
  'GIAO_THAT_BAI',
  'DA_HUY',
];

const STATUS_LABELS = {
  ALL: 'Tất cả',
  CHO_XAC_NHAN: 'Chờ nhà hàng xác nhận',
  CHO_DEN_GIO: 'Đã xác nhận · chờ đến giờ',
  CHO_THANH_TOAN: 'Chờ thanh toán',
  DANG_CHUAN_BI: 'Đang chuẩn bị',
  CHO_TAI_XE_NHAN: 'Chờ tài xế đến nhận',
  CHO_BAN_GIAO: 'Chờ bàn giao',
  CHO_KHACH_NHAN: 'Sẵn sàng để khách đến lấy',
  DANG_GIAO: 'Đang giao',
  CHO_DOI_SOAT: 'Chờ đối soát COD',
  HOAN_THANH: 'Đã giao',
  GIAO_THAT_BAI: 'Giao thất bại',
  DA_HUY: 'Đã hủy',
  CHO_BEP: 'Chờ bếp',
  DANG_NAU: 'Đang chế biến',
  DANG_CHE_BIEN: 'Đang chế biến',
  DA_HOAN_THANH: 'Hoàn thành',
  DA_THANH_TOAN: 'Đã thanh toán',
  CHO_HOAN_TIEN: 'Chờ hoàn tiền',
  DA_HOAN_TIEN: 'Đã hoàn tiền',
  HET_HAN: 'Hết hạn thanh toán',
};

const PAYMENT_LABELS = {
  CHO_THANH_TOAN: 'Chờ thanh toán',
  DA_THANH_TOAN: 'Đã thanh toán',
  CHO_HOAN_TIEN: 'Chờ hoàn tiền',
  DA_HOAN_TIEN: 'Đã hoàn tiền',
  HET_HAN: 'Hết hạn thanh toán',
  DA_HUY: 'Đã hủy',
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

export function deliveryAreaLabel(area) {
  const code = String(area || '').toUpperCase();
  if (code === 'NOI_THANH') return 'Nội thành';
  if (code === 'LAN_CAN') return 'Khu vực lân cận';
  if (code === 'BAN_KINH_3KM') return 'Phạm vi giao hàng mức 1';
  if (code === 'BAN_KINH_6KM') return 'Phạm vi giao hàng mức 2';
  if (code === 'BAN_KINH_10KM') return 'Phạm vi giao hàng mức 3';
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


export const CASHIER_DELIVERY_ATTENTION_STATUSES = [
  'CHO_THANH_TOAN',
  'CHO_XAC_NHAN',
  'CHO_TAI_XE_NHAN',
  'CHO_BAN_GIAO',
  'CHO_KHACH_NHAN',
  'CHO_DOI_SOAT',
];

export function isCashierDeliveryAttention(order) {
  const status = String(deliveryData(order)?.trangThaiGiaoHang || order?.trangThaiGiaoHang || '').toUpperCase();
  return CASHIER_DELIVERY_ATTENTION_STATUSES.includes(status);
}
