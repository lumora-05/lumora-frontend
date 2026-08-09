import { reservationApi } from '../api/reservationApi';
import { systemSettingApi, systemSettingData } from '../api/systemSettingApi';
import { normalizePage } from './pagination';
import { reservationStatus } from './reservations';

const HOLD_STATUSES = ['DA_XAC_NHAN', 'KHACH_DA_DEN'];
const DEFAULT_POLICY = {
  defaultDurationMinutes: 120,
  preparationMinutes: 30,
};
let activePolicy = { ...DEFAULT_POLICY };
const PAGE_SIZE = 200;

function policyOf(settings = {}) {
  return {
    defaultDurationMinutes: Number(settings?.reservationDefaultDurationMinutes) || DEFAULT_POLICY.defaultDurationMinutes,
    preparationMinutes: Math.max(Number(settings?.reservationPreparationMinutes) || 0, 0),
  };
}

function localDateValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function reservationTableId(item) {
  return item?.maBanThucTe ?? item?.maBanDuKien ?? null;
}

export function reservationEndTime(item) {
  const explicit = item?.thoiGianKetThucDuKien ? new Date(item.thoiGianKetThucDuKien).getTime() : Number.NaN;
  if (Number.isFinite(explicit)) return explicit;
  const start = item?.ngayGioDen ? new Date(item.ngayGioDen).getTime() : Number.NaN;
  if (!Number.isFinite(start)) return Number.NaN;
  return start + Number(item?.thoiLuongPhut || activePolicy.defaultDurationMinutes) * 60000;
}

export function buildReservationHoldMap(items, now = Date.now(), policy = activePolicy) {
  const effectivePolicy = { ...activePolicy, ...(policy || {}) };
  const serviceEndWithPreparation = now
    + (effectivePolicy.defaultDurationMinutes + effectivePolicy.preparationMinutes) * 60000;
  const result = new Map();

  (Array.isArray(items) ? items : [])
    .filter((item) => HOLD_STATUSES.includes(reservationStatus(item)))
    .filter((item) => {
      const start = item?.ngayGioDen ? new Date(item.ngayGioDen).getTime() : Number.NaN;
      const end = reservationEndTime(item);
      return Number.isFinite(start) && Number.isFinite(end) && start < serviceEndWithPreparation && end > now;
    })
    .sort((a, b) => new Date(a.ngayGioDen).getTime() - new Date(b.ngayGioDen).getTime())
    .forEach((item) => {
      const id = reservationTableId(item);
      if (id != null && !result.has(String(id))) result.set(String(id), item);
    });

  return result;
}

export function reservationHoldTime(item) {
  if (!item?.ngayGioDen) return 'sắp tới';
  const date = new Date(item.ngayGioDen);
  if (Number.isNaN(date.getTime())) return 'sắp tới';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function reservationHoldDateTime(item) {
  if (!item?.ngayGioDen) return 'sắp tới';
  const date = new Date(item.ngayGioDen);
  if (Number.isNaN(date.getTime())) return 'sắp tới';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function reservationHoldMessage(item, tableName = 'Bàn này') {
  return `${tableName} đã được giữ cho lịch đặt lúc ${reservationHoldDateTime(item)}. Lượt phục vụ mới dự kiến kéo dài ${activePolicy.defaultDurationMinutes} phút và cần ${activePolicy.preparationMinutes} phút chuẩn bị bàn. Vui lòng chọn bàn khác.`;
}

export async function fetchReservationHoldMap() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const from = localDateValue(now);
  const to = localDateValue(tomorrow);

  const [settingsResponse, ...responses] = await Promise.all([
    systemSettingApi.getPublic().catch(() => null),
    ...HOLD_STATUSES.map((status) => reservationApi.list({
      status,
      from,
      to,
      page: 0,
      size: PAGE_SIZE,
    })),
  ]);

  activePolicy = policyOf(systemSettingData(settingsResponse));
  const rows = responses.flatMap((response) => normalizePage(response, PAGE_SIZE).content);
  return buildReservationHoldMap(rows, Date.now(), activePolicy);
}
