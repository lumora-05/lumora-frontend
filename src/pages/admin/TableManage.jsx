import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  CircleOff,
  Download,
  Eye,
  Grid2X2,
  Link2,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Plus,
  QrCode,
  Search,
  Table2,
  Trash2,
  Unlink2,
  Wrench,
  Users,
  X,
} from 'lucide-react';
import { tableApi } from '../../api/tableApi';
import { API_BASE_URL } from '../../api/axiosClient';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import ConfirmActionModal from '../../components/common/ConfirmActionModal';
import TableArrangementModal from '../../components/common/TableArrangementModal';
import { useWebSocket } from '../../hooks/useWebSocket';
import ReservationManagement from '../../components/reservation/ReservationManagement';
import { fetchReservationHoldMap, reservationHoldDateTime, reservationHoldTime } from '../../utils/reservationHolds';

const EMPTY_FORM = {
  tenBan: '',
  trangThai: 'TRONG',
  ghiChu: '',
  khuVuc: '',
  sucChua: 4,
};

const TABLE_STATUS = {
  TRONG: { label: 'Trống', tone: 'empty' },
  DANG_SU_DUNG: { label: 'Đang phục vụ', tone: 'serving' },
  DAT_TRUOC: { label: 'Đã đặt', tone: 'reserved' },
  DANG_DON_DEP: { label: 'Đang dọn dẹp', tone: 'cleaning' },
  BAO_TRI: { label: 'Bảo trì', tone: 'maintenance' },
  DANG_THANH_TOAN: { label: 'Đang thanh toán', tone: 'payment' },
};

const TABLE_FILTER_STATUS = ['TRONG', 'DANG_SU_DUNG', 'DANG_THANH_TOAN', 'BAO_TRI'];
const ADMIN_MANUAL_TABLE_STATUS = new Set(['TRONG', 'BAO_TRI']);

function unwrapList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function tableId(row) {
  return row?.maBan ?? row?.id;
}

function customerTableKey(row) {
  return row?.qrToken || row?.tokenQr || row?.qrTokenValue || tableId(row);
}

function customerPath(row) {
  return `/table/${encodeURIComponent(String(customerTableKey(row) ?? ''))}`;
}

function getArea(row) {
  return row?.khuVuc?.tenKhuVuc
    || row?.tenKhuVuc
    || (typeof row?.khuVuc === 'string' ? row.khuVuc : '')
    || row?.tang
    || 'Khu vực chung';
}

function getCapacity(row) {
  return Number(row?.sucChua ?? row?.soCho ?? row?.soLuongCho ?? 4);
}

function isGrouped(row) {
  return Boolean(row?.maNhomBan || row?.maBanChinh || row?.dangGhepBan);
}

function isPrimaryTable(row) {
  if (!isGrouped(row)) return false;
  if (typeof row?.laBanChinh === 'boolean') return row.laBanChinh;
  return String(tableId(row)) === String(row?.maBanChinh);
}

function groupRoleLabel(row) {
  if (!isGrouped(row)) return '';
  return isPrimaryTable(row) ? 'Bàn chính' : 'Bàn ghép';
}

function groupPrimaryName(row, rows) {
  if (!isGrouped(row)) return '—';
  const primary = rows.find((item) => String(tableId(item)) === String(row?.maBanChinh));
  return primary?.tenBan || `Bàn ${row?.maBanChinh}`;
}

function canTransfer(row) {
  return !isGrouped(row) && ['DANG_SU_DUNG', 'DANG_THANH_TOAN'].includes(row?.trangThai);
}

function canMerge(row) {
  return !isGrouped(row) && ['TRONG', 'DANG_SU_DUNG'].includes(row?.trangThai || 'TRONG');
}

function canUnmerge(row) {
  return isGrouped(row) && String(row?.trangThai || '').toUpperCase() === 'TRONG';
}

function getTableStatus(row) {
  return TABLE_STATUS[row?.trangThai] || { label: row?.trangThai || 'Trống', tone: 'empty' };
}

function qrSrc(row) {
  const source = row?.anhQr
    || row?.qrCodeUrl
    || row?.duongDanQr
    || row?.maQrUrl
    || row?.qrImage
    || row?.qrCode
    || '';

  if (!source || typeof source !== 'string') return '';
  if (source.startsWith('data:image/')) return source;
  if (/^https?:\/\//i.test(source)) return source;
  if (source.length > 120 && /^[A-Za-z0-9+/=\r\n]+$/.test(source)) {
    return `data:image/png;base64,${source.replace(/\s/g, '')}`;
  }
  const looksLikePath = source.includes('/') || /\.(png|jpe?g|webp|svg)(\?.*)?$/i.test(source);
  if (!looksLikePath) return '';
  return `${API_BASE_URL}${source.startsWith('/') ? source : `/${source}`}`;
}

function qrCodeValue(row) {
  return row?.maQr || row?.maQR || row?.qrCodeId || row?.qrId || `QR${String(tableId(row) || '').padStart(4, '0')}`;
}

function qrStatusCode(row) {
  const raw = row?.trangThaiQr || row?.qrTrangThai || row?.qrStatus;
  if (!qrSrc(row)) return 'CHUA_TAO';
  if (raw === false || raw === 'NGUNG_SU_DUNG' || raw === 'DISABLED') return 'NGUNG_SU_DUNG';
  if (raw === 'TAM_NGUNG' || raw === 'PAUSED') return 'TAM_NGUNG';
  return 'DANG_HOAT_DONG';
}

function qrStatusMeta(row) {
  const code = qrStatusCode(row);
  if (code === 'TAM_NGUNG') return { label: 'Tạm ngưng', tone: 'paused' };
  if (code === 'NGUNG_SU_DUNG') return { label: 'Ngừng sử dụng', tone: 'disabled' };
  if (code === 'CHUA_TAO') return { label: 'Chưa tạo', tone: 'missing' };
  return { label: 'Đang hoạt động', tone: 'active' };
}

function formatDateTime(value) {
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

function roundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawCenteredText(ctx, text, centerX, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, centerX, y);
}

async function loadQrImage(source) {
  const response = await fetch(source);
  if (!response.ok) throw new Error('Không tải được ảnh QR');

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Ảnh QR không hợp lệ'));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function downloadQr(row, toast) {
  const source = qrSrc(row);
  if (!source) {
    toast.error('Bàn này chưa có mã QR. Hãy tạo QR trước.');
    return;
  }

  try {
    const qrImage = await loadQrImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1748;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ tạo ảnh');

    const centerX = canvas.width / 2;
    const orange = '#f45b16';
    const orangeDark = '#d9480f';
    const ink = '#241a15';
    const muted = '#73665f';
    const cream = '#fbf3e9';

    ctx.fillStyle = cream;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Họa tiết nền nhẹ, giúp mẫu giống thẻ để bàn thật nhưng không ảnh hưởng việc quét QR.
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = orange;
    ctx.lineWidth = 4;
    for (let i = -180; i < canvas.width + 260; i += 170) {
      ctx.beginPath();
      ctx.arc(i, 130, 120, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    roundedRectPath(ctx, 72, 58, 1096, 1632, 56);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#eadfd5';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = 'rgba(69, 37, 18, 0.12)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 18;
    roundedRectPath(ctx, 72, 58, 1096, 1632, 56);
    ctx.strokeStyle = 'rgba(255,255,255,0.01)';
    ctx.stroke();
    ctx.restore();

    // Logo.
    roundedRectPath(ctx, centerX - 48, 122, 96, 96, 28);
    const logoGradient = ctx.createLinearGradient(centerX - 48, 122, centerX + 48, 218);
    logoGradient.addColorStop(0, '#ff7a00');
    logoGradient.addColorStop(1, '#ff3d00');
    ctx.fillStyle = logoGradient;
    ctx.fill();
    drawCenteredText(ctx, 'L', centerX, 192, '700 56px Georgia, serif', '#ffffff');
    drawCenteredText(ctx, 'LUMORA', centerX, 286, '700 58px Georgia, serif', orangeDark);
    drawCenteredText(ctx, 'RESTAURANT', centerX, 330, '700 20px Arial, sans-serif', muted);

    drawCenteredText(ctx, 'QUÉT MÃ ĐỂ', centerX, 414, '800 30px Arial, sans-serif', orange);
    drawCenteredText(ctx, 'XEM THỰC ĐƠN & GỌI MÓN', centerX, 468, '800 38px Arial, sans-serif', ink);

    // Khung QR có vùng trắng an toàn để camera dễ nhận diện.
    roundedRectPath(ctx, 184, 520, 872, 872, 38);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = orange;
    ctx.lineWidth = 8;
    ctx.stroke();

    const qrMaxSize = 730;
    const qrRatio = qrImage.width / qrImage.height || 1;
    let qrWidth = qrMaxSize;
    let qrHeight = qrMaxSize;
    if (qrRatio > 1) qrHeight = qrMaxSize / qrRatio;
    if (qrRatio < 1) qrWidth = qrMaxSize * qrRatio;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, centerX - qrWidth / 2, 591 + (qrMaxSize - qrHeight) / 2, qrWidth, qrHeight);
    ctx.imageSmoothingEnabled = true;

    const tableLabel = String(row.tenBan || `Bàn ${tableId(row)}`).trim();
    roundedRectPath(ctx, centerX - 225, 1436, 450, 112, 56);
    const badgeGradient = ctx.createLinearGradient(centerX - 225, 1436, centerX + 225, 1548);
    badgeGradient.addColorStop(0, '#ff7a00');
    badgeGradient.addColorStop(1, '#ff3d00');
    ctx.fillStyle = badgeGradient;
    ctx.fill();
    drawCenteredText(ctx, tableLabel.toUpperCase(), centerX, 1510, '800 42px Arial, sans-serif', '#ffffff');

    drawCenteredText(ctx, 'Mở camera hoặc Zalo để quét mã', centerX, 1608, '700 26px Arial, sans-serif', ink);
    drawCenteredText(
      ctx,
      `${getArea(row)}  •  Phù hợp ${getCapacity(row)} khách`,
      centerX,
      1650,
      '500 21px Arial, sans-serif',
      muted,
    );

    const safeName = tableLabel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
    if (!blob) throw new Error('Không thể tạo file ảnh');

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lumora-ma-qr-${safeName || tableId(row)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success('Tải mã QR thành công');
  } catch (error) {
    toast.error(error?.message || 'Không thể tạo mẫu mã QR');
  }
}

export default function TableManage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = ['tables', 'reservations'].includes(requestedTab) ? requestedTab : 'tables';
  const [rows, setRows] = useState([]);
  const [reservationHolds, setReservationHolds] = useState(() => new Map());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedId, setSelectedId] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [arrangementMode, setArrangementMode] = useState(null);
  const [arrangementLoading, setArrangementLoading] = useState(false);
  const tableEvent = useWebSocket(['/topic/tables', '/topic/admin/reservations', '/topic/reservations']);

  async function load(preferredId) {
    try {
      const [response, holdMap] = await Promise.all([
        tableApi.getAll(),
        fetchReservationHoldMap().catch(() => new Map()),
      ]);
      const list = unwrapList(response);
      setRows(list);
      setReservationHolds(holdMap);
      const nextId = preferredId ?? selectedId;
      if (list.length && !list.some((item) => tableId(item) === nextId)) {
        setSelectedId(tableId(list[0]));
      } else if (!nextId && list.length) {
        setSelectedId(tableId(list[0]));
      }
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được danh sách bàn'));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (['/topic/tables', '/topic/admin/reservations', '/topic/reservations'].includes(tableEvent?.topic)) load();
  }, [tableEvent]);

  useEffect(() => {
    const nextTab = ['tables', 'reservations'].includes(requestedTab) ? requestedTab : 'tables';
    setActiveTab((currentTab) => currentTab === nextTab ? currentTab : nextTab);
  }, [requestedTab]);

  const selected = useMemo(
    () => rows.find((row) => tableId(row) === selectedId) || rows[0] || null,
    [rows, selectedId],
  );

  const areas = useMemo(
    () => [...new Set(rows.map(getArea))].sort((a, b) => a.localeCompare(b, 'vi')),
    [rows],
  );

  const tableRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchKeyword = !query || `${row.tenBan || ''} ${getArea(row)}`.toLowerCase().includes(query);
      const matchArea = areaFilter === 'all' || getArea(row) === areaFilter;
      const matchStatus = statusFilter === 'all' || row.trangThai === statusFilter;
      return matchKeyword && matchArea && matchStatus;
    });
  }, [rows, keyword, areaFilter, statusFilter]);

  const groupedTables = useMemo(() => {
    return tableRows.reduce((groups, row) => {
      const area = getArea(row);
      if (!groups[area]) groups[area] = [];
      groups[area].push(row);
      return groups;
    }, {});
  }, [tableRows]);

  const qrRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchKeyword = !query || `${row.tenBan || ''} ${getArea(row)} ${qrCodeValue(row)}`.toLowerCase().includes(query);
      const matchArea = areaFilter === 'all' || getArea(row) === areaFilter;
      const matchStatus = statusFilter === 'all' || qrStatusCode(row) === statusFilter;
      return matchKeyword && matchArea && matchStatus;
    });
  }, [rows, keyword, areaFilter, statusFilter]);

  const qrStats = useMemo(() => {
    const createdRows = rows.filter((row) => Boolean(qrSrc(row)));
    const total = createdRows.length;
    const active = createdRows.filter((row) => qrStatusCode(row) === 'DANG_HOAT_DONG').length;
    const paused = createdRows.filter((row) => qrStatusCode(row) === 'TAM_NGUNG').length;
    const disabled = createdRows.filter((row) => qrStatusCode(row) === 'NGUNG_SU_DUNG').length;
    return { total, active, paused, disabled };
  }, [rows]);

  function changeTab(tab) {
    setActiveTab(tab);
    setSearchParams(tab === 'tables' ? {} : { tab }, { replace: true });
    setKeyword('');
    setAreaFilter('all');
    setStatusFilter('all');
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingId(tableId(row));
    setForm({
      tenBan: row.tenBan || '',
      trangThai: row.trangThai || 'TRONG',
      ghiChu: row.ghiChu || '',
      khuVuc: getArea(row) === 'Khu vực chung' ? '' : getArea(row),
      sucChua: getCapacity(row),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      tenBan: form.tenBan.trim(),
      ghiChu: form.ghiChu.trim(),
      khuVuc: form.khuVuc.trim(),
      tenKhuVuc: form.khuVuc.trim(),
      sucChua: Number(form.sucChua || 4),
    };

    // Trạng thái vận hành do hệ thống quản lý. Bàn mới luôn bắt đầu ở trạng thái Trống;
    // việc đưa bàn vào/ra bảo trì được xử lý bằng hành động riêng ở chi tiết bàn.
    if (!editingId) payload.trangThai = 'TRONG';

    try {
      const response = editingId
        ? await tableApi.update(editingId, payload)
        : await tableApi.create(payload);
      toast.success(messageOf(response, editingId ? 'Cập nhật bàn thành công' : 'Thêm bàn thành công'));
      const id = editingId;
      closeModal();
      await load(id);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Lưu bàn thất bại'));
    }
  }

  function askRemove(row) {
    setDeleteTarget(row);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteTarget(null);
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const response = await tableApi.remove(tableId(deleteTarget));
      toast.success(messageOf(response, 'Xóa bàn thành công'));
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Xóa bàn thất bại'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function submitArrangement(value) {
    if (!selected || arrangementLoading) return;
    setArrangementLoading(true);
    try {
      let response;
      let preferredId = tableId(selected);
      if (arrangementMode === 'transfer') {
        response = await tableApi.transfer(tableId(selected), value);
        preferredId = value;
      } else if (arrangementMode === 'merge') {
        response = await tableApi.merge(tableId(selected), value);
      } else if (arrangementMode === 'unmerge') {
        response = await tableApi.unmerge(selected.maNhomBan);
      } else {
        return;
      }
      toast.success(messageOf(response, arrangementMode === 'transfer' ? 'Chuyển bàn thành công' : arrangementMode === 'merge' ? 'Ghép bàn thành công' : 'Tách bàn thành công'));
      setArrangementMode(null);
      await load(preferredId);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể cập nhật sắp xếp bàn'));
    } finally {
      setArrangementLoading(false);
    }
  }

  async function generateQr(row) {
    if (!row) {
      toast.info('Hãy chọn một bàn trước khi tạo QR');
      return;
    }
    try {
      const response = await tableApi.generateQr(tableId(row));
      toast.success(messageOf(response, `Tạo QR cho ${row.tenBan || 'bàn'} thành công`));
      await load(tableId(row));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Tạo mã QR thất bại'));
    }
  }

  async function toggleMaintenance(row) {
    if (!row) return;
    const currentStatus = String(row.trangThai || 'TRONG').toUpperCase();
    if (!ADMIN_MANUAL_TABLE_STATUS.has(currentStatus)) {
      toast.info('Trạng thái phục vụ/thanh toán do hệ thống tự cập nhật.');
      return;
    }

    const targetStatus = currentStatus === 'BAO_TRI' ? 'TRONG' : 'BAO_TRI';
    const payload = {
      tenBan: String(row.tenBan || '').trim(),
      trangThai: targetStatus,
      ghiChu: String(row.ghiChu || '').trim(),
      khuVuc: getArea(row) === 'Khu vực chung' ? '' : getArea(row),
      tenKhuVuc: getArea(row) === 'Khu vực chung' ? '' : getArea(row),
      sucChua: getCapacity(row),
    };

    try {
      const response = await tableApi.update(tableId(row), payload);
      toast.success(messageOf(response, targetStatus === 'BAO_TRI' ? 'Đã đưa bàn vào bảo trì' : 'Bàn đã sẵn sàng phục vụ'));
      await load(tableId(row));
    } catch (error) {
      toast.error(errorMessageOf(error, targetStatus === 'BAO_TRI' ? 'Không thể đưa bàn vào bảo trì' : 'Không thể kết thúc bảo trì'));
    }
  }

  function statusOptions() {
    if (activeTab === 'qr') {
      return (
        <>
          <option value="all">Tất cả trạng thái</option>
          <option value="DANG_HOAT_DONG">Đang hoạt động</option>
          <option value="TAM_NGUNG">Tạm ngưng</option>
          <option value="NGUNG_SU_DUNG">Ngừng sử dụng</option>
          <option value="CHUA_TAO">Chưa tạo</option>
        </>
      );
    }

    return (
      <>
        <option value="all">Tất cả trạng thái</option>
        {TABLE_FILTER_STATUS.map((value) => (
          <option key={value} value={value}>{TABLE_STATUS[value].label}</option>
        ))}
      </>
    );
  }

  return (
    <section className="table-qr-page">
      <div className="table-qr-tabs" role="tablist" aria-label="Bàn và đặt chỗ">
        <button className={activeTab === 'tables' ? 'active' : ''} onClick={() => changeTab('tables')}>Quản lý bàn</button>
        <button className={activeTab === 'reservations' ? 'active' : ''} onClick={() => changeTab('reservations')}>Lịch đặt bàn</button>
      </div>

      {activeTab === 'tables' ? (
        <div className="table-tab-layout">
          <div className="table-map-panel">
            <div className="table-map-heading">
              <h3>Sơ đồ bàn</h3>
              <div className="table-map-controls">
                <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                  <option value="all">Tất cả khu vực</option>
                  {areas.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {statusOptions()}
                </select>
                <button className="table-primary-btn" type="button" onClick={openCreate}><Plus size={18} /> Thêm bàn</button>
              </div>
            </div>

            <div className="table-groups">
              {Object.entries(groupedTables).map(([area, items]) => (
                <section className="table-area-card" key={area}>
                  <header><span><Building2 size={21} /> {area}</span><span>{items.length} bàn</span></header>
                  <div className="table-map-grid">
                    {items.map((row) => {
                      const status = getTableStatus(row);
                      const hold = reservationHolds.get(String(tableId(row)));
                      const isSelected = tableId(row) === tableId(selected);
                      return (
                        <button
                          key={tableId(row)}
                          type="button"
                          className={`restaurant-table-tile ${status.tone} ${hold ? 'has-reservation' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedId(tableId(row))}
                        >
                          <span className="table-tile-icon"><Table2 size={20} /></span>
                          {isGrouped(row) ? <span className={`table-group-tag ${isPrimaryTable(row) ? 'primary' : 'secondary'}`}>{groupRoleLabel(row)}</span> : null}
                          <strong>{row.tenBan || `Bàn ${tableId(row)}`}</strong>
                          <small>{getCapacity(row)} khách{hold ? ` · Đặt ${reservationHoldTime(hold)}` : ''}</small>
                          <em>{status.label}</em>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {!tableRows.length && <div className="table-qr-empty">Không tìm thấy bàn phù hợp</div>}
            </div>

            <div className="table-status-legend">
              <span>Chú thích trạng thái</span>
              {TABLE_FILTER_STATUS.map((key) => {
                const meta = TABLE_STATUS[key];
                return <i key={key} className={meta.tone}><b />{meta.label}</i>;
              })}
            </div>
          </div>

          <aside className="table-detail-panel">
            {selected ? (
              <>
                <div className="table-detail-title">
                  <h3>QR của bàn: {selected.tenBan || tableId(selected)}</h3>
                  <span className={`table-status-chip ${getTableStatus(selected).tone}`}>{getTableStatus(selected).label}</span>
                </div>

                <div className="large-qr-box">
                  {qrSrc(selected) ? <img src={qrSrc(selected)} alt={`QR ${selected.tenBan || ''}`} /> : <QrCode size={96} />}
                </div>
                <p className="qr-helper">Khách hàng quét mã để xem menu và đặt món</p>

                <div className="table-info-card">
                  <h4>Thông tin bàn</h4>
                  <dl>
                    <div><dt>Tên bàn</dt><dd>{selected.tenBan || '—'}</dd></div>
                    <div><dt>Khu vực</dt><dd>{getArea(selected)}</dd></div>
                    <div><dt>Sức chứa</dt><dd>{getCapacity(selected)} khách</dd></div>
                    <div><dt>Trạng thái</dt><dd><span className={`inline-dot ${getTableStatus(selected).tone}`} />{getTableStatus(selected).label}</dd></div>
                    {reservationHolds.get(String(tableId(selected))) ? <div><dt>Lịch sắp tới</dt><dd><span className="table-reservation-hold-detail">Đã giữ lúc {reservationHoldDateTime(reservationHolds.get(String(tableId(selected))))}</span></dd></div> : null}
                    {isGrouped(selected) ? <div><dt>Ghép bàn</dt><dd><span className={`table-group-inline ${isPrimaryTable(selected) ? 'primary' : 'secondary'}`}>{groupRoleLabel(selected)}</span></dd></div> : null}
                    {isGrouped(selected) ? <div><dt>Bàn chính</dt><dd>{groupPrimaryName(selected, rows)}</dd></div> : null}
                    <div><dt>Ghi chú</dt><dd>{selected.ghiChu || 'Không có'}</dd></div>
                  </dl>
                </div>

                <div className="table-action-card">
                  <h4>Hành động</h4>
                  <div className="table-detail-actions">
                    <a href={customerPath(selected)} target="_blank" rel="noreferrer"><Eye size={17} /> Xem menu QR</a>
                    <button onClick={() => downloadQr(selected, toast)}><Download size={17} /> Tải mã QR</button>
                    {!isGrouped(selected) ? <button disabled={!canTransfer(selected)} title={!canTransfer(selected) ? 'Chỉ chuyển bàn đang có đơn phục vụ' : ''} onClick={() => setArrangementMode('transfer')}><ArrowRightLeft size={17} /> Chuyển bàn</button> : null}
                    {!isGrouped(selected) ? <button disabled={!canMerge(selected) || Boolean(reservationHolds.get(String(tableId(selected))) && String(selected?.trangThai || 'TRONG').toUpperCase() === 'TRONG')} title={reservationHolds.get(String(tableId(selected))) && String(selected?.trangThai || 'TRONG').toUpperCase() === 'TRONG' ? `Bàn đã được giữ lúc ${reservationHoldTime(reservationHolds.get(String(tableId(selected))))}` : !canMerge(selected) ? 'Bàn hiện tại không thể ghép' : ''} onClick={() => setArrangementMode('merge')}><Link2 size={17} /> Ghép bàn</button> : null}
                    {isGrouped(selected) ? <button disabled={!canUnmerge(selected)} title={!canUnmerge(selected) ? 'Chỉ tách nhóm khi không còn đơn đang mở' : ''} onClick={() => setArrangementMode('unmerge')}><Unlink2 size={17} /> Tách bàn</button> : null}
                    <button onClick={() => openEdit(selected)}><Pencil size={17} /> Chỉnh sửa</button>
                    {ADMIN_MANUAL_TABLE_STATUS.has(String(selected?.trangThai || 'TRONG').toUpperCase()) ? (
                      <button onClick={() => toggleMaintenance(selected)}>
                        <Wrench size={17} /> {String(selected?.trangThai || 'TRONG').toUpperCase() === 'BAO_TRI' ? 'Kết thúc bảo trì' : 'Đưa vào bảo trì'}
                      </button>
                    ) : null}
                    <button className="primary" onClick={() => generateQr(selected)}><QrCode size={17} /> {qrSrc(selected) ? 'Tạo lại QR' : 'Tạo QR'}</button>
                    <button className="danger" onClick={() => askRemove(selected)}><Trash2 size={17} /> Xóa bàn</button>
                  </div>
                </div>
              </>
            ) : <div className="table-qr-empty">Chưa có bàn để hiển thị</div>}
          </aside>
        </div>
      ) : activeTab === 'qr' ? (
        <>
          <div className="qr-stat-grid">
            <article><span className="blue"><QrCode size={24} /></span><div><small>Tổng QR</small><strong>{qrStats.total}</strong><p>100% tổng số</p></div></article>
            <article><span className="green"><CheckCircle2 size={24} /></span><div><small>Đang hoạt động</small><strong>{qrStats.active}</strong><p>{qrStats.total ? Math.round(qrStats.active / qrStats.total * 100) : 0}% tổng số</p></div></article>
            <article><span className="orange"><PauseCircle size={24} /></span><div><small>Tạm ngưng</small><strong>{qrStats.paused}</strong><p>{qrStats.total ? Math.round(qrStats.paused / qrStats.total * 100) : 0}% tổng số</p></div></article>
            <article><span className="red"><CircleOff size={24} /></span><div><small>Ngừng sử dụng</small><strong>{qrStats.disabled}</strong><p>{qrStats.total ? Math.round(qrStats.disabled / qrStats.total * 100) : 0}% tổng số</p></div></article>
          </div>

          <div className="qr-manage-layout">
            <div className="qr-list-panel">
              <div className="qr-toolbar">
                <label><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo bàn hoặc khu vực..." /><Search size={18} /></label>
                <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                  <option value="all">Tất cả khu vực</option>
                  {areas.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{statusOptions()}</select>
                <button className="table-primary-btn" onClick={() => generateQr(selected)}><Plus size={18} /> Tạo QR mới</button>
              </div>

              <div className="qr-table-wrap">
                <table className="qr-management-table">
                  <thead>
                    <tr>
                      <th>Mã QR</th>
                      <th>Bàn</th>
                      <th>Khu vực</th>
                      <th>Sức chứa</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qrRows.map((row) => {
                      const status = qrStatusMeta(row);
                      return (
                        <tr key={tableId(row)} className={tableId(row) === tableId(selected) ? 'selected' : ''} onClick={() => setSelectedId(tableId(row))}>
                          <td><div className="qr-code-cell">{qrSrc(row) ? <img src={qrSrc(row)} alt="" /> : <QrCode size={27} />}<span>{qrCodeValue(row)}</span></div></td>
                          <td>{row.tenBan || `Bàn ${tableId(row)}`}</td>
                          <td>{getArea(row)}</td>
                          <td>{getCapacity(row)} khách</td>
                          <td><span className={`qr-status-chip ${status.tone}`}>{status.label}</span></td>
                          <td>{formatDateTime(row.ngayTaoQr || row.qrCreatedAt || row.ngayTao || row.createdAt)}</td>
                          <td>
                            <div className="qr-row-actions" onClick={(e) => e.stopPropagation()}>
                              <button title="Xem chi tiết" onClick={() => setSelectedId(tableId(row))}><Eye size={16} /></button>
                              <button title="Tải mã QR" onClick={() => downloadQr(row, toast)}><Download size={16} /></button>
                              <button title="Thêm thao tác" onClick={() => setSelectedId(tableId(row))}><MoreHorizontal size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!qrRows.length && <tr><td colSpan="7" className="table-qr-empty">Không tìm thấy mã QR phù hợp</td></tr>}
                  </tbody>
                </table>
              </div>

              <footer className="qr-list-footer">
                <span>Hiển thị 1 - {qrRows.length} trong {rows.length} kết quả</span>
                <div><button disabled>‹</button><button className="active">1</button><button disabled>›</button></div>
                <select defaultValue="10"><option>10 / trang</option><option>20 / trang</option></select>
              </footer>
            </div>

            <aside className="qr-detail-panel">
              {selected ? (
                <>
                  <div className="qr-detail-head"><h3>Chi tiết QR</h3><X size={19} /></div>
                  <span className={`qr-status-chip ${qrStatusMeta(selected).tone}`}>{qrStatusMeta(selected).label}</span>
                  <div className="qr-detail-image">{qrSrc(selected) ? <img src={qrSrc(selected)} alt={`QR ${selected.tenBan || ''}`} /> : <QrCode size={110} />}</div>
                  <p>Khách hàng quét mã để xem menu và đặt món</p>
                  <dl>
                    <div><dt>Mã QR</dt><dd>{qrCodeValue(selected)}</dd></div>
                    <div><dt>Bàn</dt><dd>{selected.tenBan || `Bàn ${tableId(selected)}`}</dd></div>
                    <div><dt>Khu vực</dt><dd>{getArea(selected)}</dd></div>
                    <div><dt>Sức chứa</dt><dd>{getCapacity(selected)} khách</dd></div>
                    <div><dt>Ngày tạo</dt><dd>{formatDateTime(selected.ngayTaoQr || selected.qrCreatedAt || selected.ngayTao || selected.createdAt)}</dd></div>
                    <div><dt>Cập nhật cuối</dt><dd>{formatDateTime(selected.ngayCapNhatQr || selected.updatedAt || selected.ngayCapNhat)}</dd></div>
                  </dl>
                  <div className="qr-detail-actions">
                    <a href={customerPath(selected)} target="_blank" rel="noreferrer"><Eye size={16} /> Xem menu QR</a>
                    <button onClick={() => downloadQr(selected, toast)}><Download size={16} /> Tải mã QR</button>
                    <button onClick={() => openEdit(selected)}><Pencil size={16} /> Chỉnh sửa bàn</button>
                    <button className="primary" onClick={() => generateQr(selected)}><QrCode size={16} /> {qrSrc(selected) ? 'Tạo lại QR' : 'Tạo QR'}</button>
                  </div>
                </>
              ) : <div className="table-qr-empty">Chọn một mã QR để xem chi tiết</div>}
            </aside>
          </div>
        </>
      ) : (
        <div className="table-reservation-tab">
          <ReservationManagement role="admin" />
        </div>
      )}

      {modalOpen && (
        <div className="table-modal-backdrop" onMouseDown={closeModal}>
          <form className="table-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div><h3>{editingId ? 'Cập nhật bàn' : 'Thêm bàn mới'}</h3><p>Nhập thông tin bàn ăn trong nhà hàng</p></div>
              <button type="button" onClick={closeModal}><X size={20} /></button>
            </header>
            <div className="table-modal-grid">
              <label><span>Tên bàn</span><input required value={form.tenBan} onChange={(e) => setForm({ ...form, tenBan: e.target.value })} placeholder="Ví dụ: Bàn 01" /></label>
              <label><span>Khu vực</span><input value={form.khuVuc} onChange={(e) => setForm({ ...form, khuVuc: e.target.value })} placeholder="Ví dụ: Tầng 1 - Trong nhà" /></label>
              <label><span>Sức chứa</span><input min="1" type="number" value={form.sucChua} onChange={(e) => setForm({ ...form, sucChua: e.target.value })} /></label>
              <label>
                <span>Trạng thái</span>
                <input
                  value={editingId ? (TABLE_STATUS[form.trangThai]?.label || form.trangThai || 'Trống') : 'Trống'}
                  disabled
                  readOnly
                  title={editingId ? 'Trạng thái vận hành do hệ thống quản lý' : 'Bàn mới mặc định ở trạng thái Trống'}
                />
              </label>
              <label className="full"><span>Ghi chú</span><textarea rows="3" value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} placeholder="Ghi chú thêm về bàn..." /></label>
            </div>
            <footer><button type="button" onClick={closeModal}>Hủy</button><button className="save" type="submit">{editingId ? 'Cập nhật' : 'Lưu bàn'}</button></footer>
          </form>
        </div>
      )}
      <TableArrangementModal
        open={Boolean(arrangementMode)}
        mode={arrangementMode || 'transfer'}
        sourceTable={selected}
        tables={rows}
        loading={arrangementLoading}
        reservationHolds={reservationHolds}
        onClose={() => !arrangementLoading && setArrangementMode(null)}
        onSubmit={submitArrangement}
      />
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={confirmRemove}
        loading={deleteLoading}
        title="Xác nhận xóa bàn"
        description="Bạn có chắc chắn muốn xóa bàn này không?"
        itemName={deleteTarget?.tenBan}
        warning="Hành động này không thể hoàn tác và thông tin bàn cùng mã QR liên quan sẽ bị xóa khỏi hệ thống."
        confirmText="Xóa bàn"
      />

    </section>
  );
}
