export const CANCELLATION_REASONS = [
  { value: 'KHACH_DOI_Y', label: 'Khách đổi ý' },
  { value: 'KHACH_GOI_NHAM', label: 'Khách gọi nhầm món' },
  { value: 'NHAN_VIEN_NHAP_NHAM', label: 'Nhân viên nhập nhầm' },
  { value: 'KHACH_CHO_QUA_LAU', label: 'Khách chờ quá lâu' },
  { value: 'KHACH_DOI_MON', label: 'Khách yêu cầu đổi món' },
  { value: 'HET_NGUYEN_LIEU', label: 'Hết nguyên liệu' },
  { value: 'BEP_KHONG_THE_CHE_BIEN', label: 'Bếp không thể chế biến' },
  { value: 'MON_KHONG_DUNG_YEU_CAU', label: 'Món không đúng yêu cầu' },
  { value: 'LY_DO_KHAC', label: 'Lý do khác' },
];

export const ITEM_CANCELLATION_STATUS_LABELS = {
  CHO_BEP: 'Chờ bếp',
  DANG_NAU: 'Đang chế biến',
  DANG_CHE_BIEN: 'Đang chế biến',
  YEU_CAU_HUY: 'Chờ duyệt hủy',
  DA_HUY: 'Đã hủy',
  HOAN_THANH: 'Sẵn sàng phục vụ',
  DA_HOAN_THANH: 'Sẵn sàng phục vụ',
  SAN_SANG: 'Sẵn sàng phục vụ',
  SAN_SANG_PHUC_VU: 'Sẵn sàng phục vụ',
  DA_PHUC_VU: 'Đã phục vụ',
};

export function cancellationReasonLabel(code) {
  return CANCELLATION_REASONS.find((item) => item.value === code)?.label || code || 'Chưa có lý do';
}

export function itemCancellationStatus(item) {
  return String(item?.trangThaiHuy || '').toUpperCase();
}

export function isPendingCancellation(item) {
  return itemCancellationStatus(item) === 'CHO_DUYET' || String(item?.trangThaiMon || '').toUpperCase() === 'YEU_CAU_HUY';
}

export function isCancelledItem(item) {
  return String(item?.trangThaiMon || '').toUpperCase() === 'DA_HUY' || itemCancellationStatus(item) === 'DA_DUYET';
}

export function canCustomerRequestCancellation(item) {
  return String(item?.trangThaiMon || '').toUpperCase() === 'CHO_BEP' && !isPendingCancellation(item) && !isCancelledItem(item);
}

export function canStaffCancelItem(item) {
  const status = String(item?.trangThaiMon || '').toUpperCase();
  return ['CHO_BEP', 'DANG_NAU', 'DANG_CHE_BIEN'].includes(status) && !isPendingCancellation(item) && !isCancelledItem(item);
}

export function cancellationSourceLabel(source) {
  const value = String(source || '').toUpperCase();
  if (value === 'KHACH_HANG') return 'Khách hàng';
  if (value === 'NHAN_VIEN_PHUC_VU') return 'Nhân viên phục vụ';
  if (value === 'ADMIN') return 'Admin';
  return source || 'Không xác định';
}

export function unwrapCancellationRequests(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}
