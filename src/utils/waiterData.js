export const WAITER_STATUS_META = {
  CHO_XAC_NHAN: { label: 'Chờ phục vụ xác nhận', tone: 'new', group: 'CONFIRM', priority: 0 },
  DA_XAC_NHAN: { label: 'Đã chuyển xuống bếp', tone: 'confirmed', group: 'PREPARING', priority: 4 },
  DANG_CHUAN_BI: { label: 'Đang chuẩn bị', tone: 'confirmed', group: 'PREPARING', priority: 4 },
  DANG_CHE_BIEN: { label: 'Đang chế biến', tone: 'preparing', group: 'PREPARING', priority: 4 },
  SAN_SANG: { label: 'Sẵn sàng phục vụ', tone: 'ready', group: 'READY', priority: 1 },
  SAN_SANG_PHUC_VU: { label: 'Sẵn sàng phục vụ', tone: 'ready', group: 'READY', priority: 1 },
  DA_PHUC_VU: { label: 'Đã phục vụ', tone: 'served', group: 'SERVED', priority: 5 },
  CHO_THANH_TOAN: { label: 'Chờ thanh toán', tone: 'payment', group: 'PAYMENT', priority: 3 },
  SAN_SANG_THANH_TOAN: { label: 'Chờ thanh toán', tone: 'payment', group: 'PAYMENT', priority: 3 },
  DA_THANH_TOAN: { label: 'Đã thanh toán', tone: 'paid', group: 'FINAL', priority: 9 },
  DA_HUY: { label: 'Đã hủy', tone: 'cancelled', group: 'FINAL', priority: 10 },
};

export const READY_ITEM_STATUSES = new Set([
  'HOAN_THANH',
  'DA_HOAN_THANH',
  'SAN_SANG',
  'SAN_SANG_PHUC_VU',
]);

export const SERVED_ITEM_STATUSES = new Set(['DA_PHUC_VU']);

export function unwrapList(response) {
  if (Array.isArray(response?.data?.content)) return response.data.content;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.data)) return response.data;
  return Array.isArray(response) ? response : [];
}

export function orderId(order) {
  return order?.maDonHang ?? order?.id;
}

export function itemId(item) {
  return item?.maChiTiet ?? item?.maChiTietDonHang ?? item?.id;
}

export function tableIdOfOrder(order) {
  return order?.banAn?.maBan ?? order?.maBan;
}

export function tableNameOfOrder(order) {
  return order?.banAn?.tenBan || (tableIdOfOrder(order) ? `Bàn ${tableIdOfOrder(order)}` : 'Chưa xác định bàn');
}

export function orderCreatedAt(order) {
  return order?.thoiGianDat || order?.ngayTao || order?.createdAt || null;
}

export function itemName(item) {
  return item?.monAn?.tenMonAn || item?.tenMonAn || 'Món ăn';
}

export function itemStatus(item) {
  return item?.trangThaiMon || item?.trangThai || 'CHO_BEP';
}

export function itemCount(order) {
  return (order?.chiTietDonHang || [])
    .filter((item) => String(item?.trangThaiMon || '').toUpperCase() !== 'DA_HUY')
    .reduce((sum, item) => sum + Number(item?.soLuong || 0), 0);
}

export function statusMeta(status) {
  return WAITER_STATUS_META[status] || { label: status || 'Không xác định', tone: 'neutral', group: 'OTHER', priority: 8 };
}

export function orderGroup(order) {
  return statusMeta(order?.trangThai).group;
}

export function isActiveOrder(order) {
  return !['DA_THANH_TOAN', 'DA_HUY'].includes(order?.trangThai);
}

export function hasPendingConfirmation(order) {
  if (String(order?.trangThai || '').toUpperCase() === 'CHO_XAC_NHAN') return true;
  return (order?.chiTietDonHang || []).some(
    (item) => String(item?.trangThaiMon || item?.trangThai || '').toUpperCase() === 'CHO_XAC_NHAN',
  );
}

export function readyItems(order) {
  return (order?.chiTietDonHang || []).filter((item) => READY_ITEM_STATUSES.has(itemStatus(item)));
}

export function pendingReadyCount(order) {
  return readyItems(order).reduce((sum, item) => sum + Number(item?.soLuong || 0), 0);
}

export function waitMinutes(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export function waitLabel(value) {
  const minutes = waitMinutes(value);
  if (minutes === null) return 'Chưa rõ thời gian';
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain ? `${hours} giờ ${remain} phút` : `${hours} giờ`;
}

export function waitTone(value, group) {
  const minutes = waitMinutes(value) ?? 0;
  const urgentLimit = group === 'READY' ? 5 : ['NEW', 'CONFIRM'].includes(group) ? 8 : group === 'PAYMENT' ? 5 : 20;
  const warningLimit = Math.max(2, Math.floor(urgentLimit * 0.6));
  if (minutes >= urgentLimit) return 'urgent';
  if (minutes >= warningLimit) return 'warning';
  return 'normal';
}

export function formatClock(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function callNumber(item) {
  const value = Number(item?.lanGoi ?? item?.lanGoiMon ?? item?.dotGoi ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function callTime(item, fallback) {
  return item?.thoiGianThem || item?.thoiGianGoi || item?.ngayTao || fallback || null;
}

export function groupItemsByCall(order) {
  const groups = new Map();
  const fallback = orderCreatedAt(order);
  (order?.chiTietDonHang || []).forEach((item) => {
    const number = callNumber(item);
    if (!groups.has(number)) groups.set(number, { number, time: callTime(item, fallback), items: [] });
    const group = groups.get(number);
    group.items.push(item);
    const time = callTime(item, fallback);
    if (time && (!group.time || new Date(time) < new Date(group.time))) group.time = time;
  });
  return [...groups.values()].sort((a, b) => a.number - b.number);
}

export function actionPriority(order) {
  const meta = statusMeta(order?.trangThai);
  const created = new Date(orderCreatedAt(order) || 0).getTime();
  return [meta.priority, created];
}
