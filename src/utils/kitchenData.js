export const CLOSED_ORDER_STATUSES = new Set(['DA_THANH_TOAN', 'DA_HUY']);
export const HIDDEN_KITCHEN_ITEM_STATUSES = new Set(['DA_HUY', 'YEU_CAU_HUY']);

export function unwrapList(response) {
  const data = response?.data ?? response;
  return Array.isArray(data) ? data : [];
}

export function unwrapObject(response) {
  return response?.data ?? response ?? null;
}

export function canonicalKitchenStatus(item) {
  const raw = String(item?.trangThaiMon || item?.status || 'CHO_BEP').toUpperCase();
  if (['MOI', 'CHO_CHE_BIEN', 'CHO_BEP'].includes(raw)) return 'CHO_BEP';
  if (['DANG_CHE_BIEN', 'DANG_NAU'].includes(raw)) return 'DANG_NAU';
  if (['HOAN_THANH', 'DA_HOAN_THANH', 'SAN_SANG', 'SAN_SANG_PHUC_VU', 'DA_PHUC_VU'].includes(raw)) return 'HOAN_THANH';
  return raw;
}

export function kitchenStatusMeta(code) {
  if (code === 'DANG_NAU') return { label: 'Đang chế biến', tone: 'cooking' };
  if (code === 'HOAN_THANH') return { label: 'Hoàn thành', tone: 'done' };
  return { label: 'Mới', tone: 'waiting' };
}

export function kitchenItemId(item) {
  return item?.maChiTiet || item?.maChiTietDonHang || item?.id;
}

export function kitchenOrderId(orderOrItem) {
  return orderOrItem?.maDonHang || orderOrItem?.orderId || orderOrItem?.donHang?.maDonHang || orderOrItem?.id;
}

export function kitchenTableName(orderOrItem) {
  const delivery = orderOrItem?.giaoHang || orderOrItem?.donHang?.giaoHang;
  const type = String(orderOrItem?.loaiDon || orderOrItem?.donHang?.loaiDon || '').toUpperCase();
  if (type === 'GIAO_HANG' || delivery) {
    return `Giao hàng${delivery?.tenNguoiNhan ? ` · ${delivery.tenNguoiNhan}` : ''}`;
  }
  return orderOrItem?.banAn?.tenBan || orderOrItem?.tenBan || orderOrItem?.donHang?.banAn?.tenBan || `Bàn ${orderOrItem?.maBan || '—'}`;
}

export function kitchenOrderedAt(orderOrItem) {
  return orderOrItem?.thoiGianThem || orderOrItem?.thoiGianDat || orderOrItem?.createdAt || orderOrItem?.ngayTao;
}

export function kitchenCallNumber(item) {
  const value = Number(item?.lanGoi || 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function formatKitchenTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatKitchenDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
}

export function kitchenWaitMinutes(value, now = Date.now()) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now - date.getTime()) / 60000));
}

export function formatKitchenWait(value, now = Date.now()) {
  const minutes = kitchenWaitMinutes(value, now);
  if (minutes < 1) return 'Vừa gửi';
  if (minutes < 60) return `Đã chờ ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain ? `Đã chờ ${hours} giờ ${remain} phút` : `Đã chờ ${hours} giờ`;
}

export function kitchenItemName(item) {
  return item?.monAn?.tenMonAn || item?.tenMonAn || item?.tenMon || 'Món ăn';
}

function kitchenItemUnitGroupKey(item) {
  const foodId = item?.monAn?.maMonAn ?? item?.maMonAn ?? kitchenItemName(item);
  const note = String(item?.ghiChu || '').trim();
  return `${foodId}::${kitchenCallNumber(item)}::${note}`;
}

/**
 * Trả về vị trí của một suất trong nhóm các suất cùng món.
 * Backend mới lưu mỗi suất thành một chi tiết riêng (soLuong = 1), vì vậy
 * 10 suất cùng món sẽ luôn được hiển thị thành 10 dòng độc lập.
 */
export function kitchenUnitPosition(items, currentIndex) {
  const list = Array.isArray(items) ? items : [];
  const current = list[currentIndex];
  if (!current) return { position: 1, total: 1 };

  const key = kitchenItemUnitGroupKey(current);
  let position = 0;
  let total = 0;

  list.forEach((item, index) => {
    if (kitchenItemUnitGroupKey(item) !== key) return;
    total += 1;
    if (index <= currentIndex) position += 1;
  });

  return {
    position: Math.max(1, position),
    total: Math.max(1, total),
  };
}

export function flattenKitchenOrders(orders, { includeClosed = false } = {}) {
  return orders
    .filter((order) => includeClosed || !CLOSED_ORDER_STATUSES.has(String(order?.trangThai || '').toUpperCase()))
    .flatMap((order) => (order?.chiTietDonHang || [])
      .filter((item) => !HIDDEN_KITCHEN_ITEM_STATUSES.has(String(item?.trangThaiMon || '').toUpperCase()))
      .map((item) => ({
        ...item,
        maDonHang: order?.maDonHang ?? order?.id,
        banAn: order?.banAn,
        tenBan: order?.banAn?.tenBan || order?.tenBan,
        maBan: order?.maBan,
        thoiGianDat: item?.thoiGianThem || order?.thoiGianDat || order?.createdAt,
        trangThaiDon: order?.trangThai,
        ghiChuDon: order?.ghiChu,
        loaiDon: order?.loaiDon,
        giaoHang: order?.giaoHang,
        nguonDon: order?.nguonDon,
      })));
}

export function kitchenOrderProgress(order) {
  const items = (order?.chiTietDonHang || []).filter((item) => !HIDDEN_KITCHEN_ITEM_STATUSES.has(String(item?.trangThaiMon || '').toUpperCase()));
  const total = items.length;
  const done = items.filter((item) => canonicalKitchenStatus(item) === 'HOAN_THANH').length;
  const cooking = items.filter((item) => canonicalKitchenStatus(item) === 'DANG_NAU').length;
  const waiting = Math.max(0, total - done - cooking);
  const status = total > 0 && done === total ? 'HOAN_THANH' : cooking > 0 || done > 0 ? 'DANG_NAU' : 'CHO_BEP';
  return { total, done, cooking, waiting, status };
}
