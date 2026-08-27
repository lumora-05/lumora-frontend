export const RESERVATION_STATUS = {
  CHO_XAC_NHAN: { label: 'Chờ xác nhận', tone: 'pending' },
  DA_XAC_NHAN: { label: 'Đã xác nhận', tone: 'confirmed' },
  KHACH_DA_DEN: { label: 'Khách đã đến', tone: 'arrived' },
  DA_XEP_BAN: { label: 'Đã xếp bàn', tone: 'seated' },
  HOAN_THANH: { label: 'Hoàn thành', tone: 'completed' },
  DA_HUY: { label: 'Đã hủy', tone: 'cancelled' },
  TU_CHOI: { label: 'Từ chối', tone: 'rejected' },
  KHONG_DEN: { label: 'Không đến', tone: 'no-show' },
  HET_HAN: { label: 'Hết hạn', tone: 'expired' },
};

export function reservationData(response) {
  if (response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

export function reservationId(item) {
  return item?.maDatBan ?? item?.id ?? null;
}

export function reservationStatus(item) {
  return String(item?.trangThai || '').toUpperCase();
}

export function reservationStatusMeta(value) {
  const status = typeof value === 'string' ? value.toUpperCase() : reservationStatus(value);
  return RESERVATION_STATUS[status] || { label: status || 'Không xác định', tone: 'neutral' };
}

export function reservationPreorderNeedsReview(item) {
  const bookingStatus = reservationStatus(item);
  const preorderStatus = String(item?.trangThaiDatMonTruoc || '').trim().toUpperCase();
  return preorderStatus === 'CHO_XAC_NHAN'
    && ['DA_XAC_NHAN', 'KHACH_DA_DEN', 'DA_XEP_BAN'].includes(bookingStatus);
}

export function reservationPreorderChangedAfterApproval(item) {
  return Boolean(item?.canDuyetLaiDatMonTruoc) && reservationPreorderNeedsReview(item);
}

export function reservationNeedsCashierAttention(item) {
  return reservationStatus(item) === 'CHO_XAC_NHAN' || reservationPreorderNeedsReview(item);
}

export function currentLocalDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function reservationDateTime(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: options.hideYear ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function reservationDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function reservationTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function minReservationDateTime(offsetMinutes = 30) {
  const date = new Date(Date.now() + Math.max(Number(offsetMinutes) || 0, 0) * 60000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function maxReservationDateTime(maximumAdvanceDays = 60) {
  const days = Math.max(Number(maximumAdvanceDays) || 1, 1);
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function canCustomerEdit(status) {
  return ['CHO_XAC_NHAN', 'DA_XAC_NHAN'].includes(String(status || '').toUpperCase());
}

export function canCustomerCancel(status) {
  return ['CHO_XAC_NHAN', 'DA_XAC_NHAN'].includes(String(status || '').toUpperCase());
}

export function canCheckIn(item, checkInEarlyMinutes = 30, noShowGraceMinutes = 15, now = Date.now()) {
  if (reservationStatus(item) !== 'DA_XAC_NHAN' || !item?.ngayGioDen) return false;
  const arrival = new Date(item.ngayGioDen).getTime();
  if (!Number.isFinite(arrival)) return false;
  const earliest = arrival - Math.max(Number(checkInEarlyMinutes) || 0, 0) * 60000;
  const latest = arrival + Math.max(Number(noShowGraceMinutes) || 0, 0) * 60000;
  return now >= earliest && now <= latest;
}

export function canMarkNoShow(item, noShowGraceMinutes = 15, now = Date.now()) {
  if (reservationStatus(item) !== 'DA_XAC_NHAN' || !item?.ngayGioDen) return false;
  const arrival = new Date(item.ngayGioDen).getTime();
  if (!Number.isFinite(arrival)) return false;
  const allowed = arrival + Math.max(Number(noShowGraceMinutes) || 0, 0) * 60000;
  return now >= allowed;
}

export function tableLabel(item) {
  return item?.tenBanThucTe || item?.tenBanDuKien || 'Chưa xếp bàn';
}
