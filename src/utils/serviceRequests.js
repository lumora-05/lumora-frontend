export const SERVICE_REQUEST_TYPES = [
  { value: 'GOI_NHAN_VIEN', label: 'Gọi nhân viên', description: 'Tôi cần nhân viên hỗ trợ tại bàn.' },
  { value: 'THEM_NUOC', label: 'Xin thêm nước', description: 'Xin thêm nước uống cho bàn.' },
  { value: 'THEM_DUNG_CU', label: 'Xin thêm dụng cụ', description: 'Xin thêm chén, đũa, muỗng hoặc dụng cụ ăn.' },
  { value: 'THEM_KHAN_GIAY', label: 'Xin thêm khăn giấy', description: 'Xin thêm khăn giấy cho bàn.' },
  { value: 'DON_BAN', label: 'Dọn bàn', description: 'Nhờ nhân viên dọn phần bàn đang dùng.' },
  { value: 'YEU_CAU_KHAC', label: 'Yêu cầu khác', description: 'Nhập nội dung cụ thể để nhân viên hỗ trợ.' },
];

export const SERVICE_REQUEST_STATUS = {
  MOI: { label: 'Mới', tone: 'new' },
  DA_TIEP_NHAN: { label: 'Đã tiếp nhận', tone: 'processing' },
  HOAN_THANH: { label: 'Hoàn thành', tone: 'done' },
  DA_HUY: { label: 'Đã hủy', tone: 'cancelled' },
};

export function unwrapServiceRequestList(response) {
  const data = response?.data ?? response;
  return Array.isArray(data) ? data : [];
}

export function serviceRequestId(item) {
  return item?.maYeuCau ?? item?.id;
}

export function serviceRequestStatus(item) {
  return String(item?.trangThai || '').toUpperCase();
}

export function serviceRequestTypeLabel(item) {
  return item?.tenLoaiYeuCau
    || SERVICE_REQUEST_TYPES.find((type) => type.value === item?.loaiYeuCau)?.label
    || item?.loaiYeuCau
    || 'Yêu cầu phục vụ';
}

export function serviceRequestTableLabel(item) {
  return item?.tenBan || (item?.maBan ? `Bàn ${item.maBan}` : 'Bàn');
}

export function serviceRequestTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function serviceRequestWaitLabel(item) {
  const minutes = Number(item?.soPhutCho);
  if (Number.isFinite(minutes) && minutes >= 0) {
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${Math.floor(minutes)} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
  }
  return serviceRequestTime(item?.thoiGianTao);
}
