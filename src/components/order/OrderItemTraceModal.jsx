import { useEffect, useState } from 'react';
import { CircleAlert, PackageCheck, PackageSearch, ShieldCheck } from 'lucide-react';
import { foodSafetyApi } from '../../api/foodSafetyApi';
import Modal from '../common/Modal';
import { errorMessageOf, useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatDate';

function unwrapData(response, fallback = null) {
  return response?.data ?? response ?? fallback;
}

function itemId(item) {
  return item?.maChiTiet ?? item?.maChiTietDonHang ?? item?.id;
}

function quantity(value) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

function dateOnly(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function safetyLabel(value) {
  switch (String(value || 'AN_TOAN').toUpperCase()) {
    case 'KHOA_TAM_THOI': return ['Khóa tạm thời', 'locked'];
    case 'CO_SU_CO': return ['Có sự cố', 'incident'];
    case 'THU_HOI': return ['Thu hồi', 'recalled'];
    case 'DA_TIEU_HUY': return ['Đã tiêu hủy', 'disposed'];
    default: return ['An toàn', 'safe'];
  }
}

export default function OrderItemTraceModal({ open, item, onClose }) {
  const toast = useToast();
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = itemId(item);
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setTrace(null);
    foodSafetyApi.traceOrderItem(id)
      .then((response) => {
        if (!cancelled) setTrace(unwrapData(response, null));
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessageOf(error, 'Không thể truy xuất nguyên liệu của món trong đơn'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, itemId(item)]);

  return (
    <Modal open={open} title="Truy xuất nguyên liệu của món" onClose={onClose}>
      <div className="order-item-trace-modal">
        {loading ? <div className="order-item-trace-empty">Đang tải dữ liệu truy xuất...</div> : trace ? (
          <>
            <div className="order-item-trace-head">
              <span><PackageSearch size={22} /></span>
              <div>
                <small>ĐƠN #{trace.maDonHang} · {trace.tenBan}</small>
                <h3>{trace.tenMonAn} × {trace.soLuongMon}</h3>
                <p>Đặt lúc {formatDate(trace.thoiGianDat)} · Trạng thái: {trace.trangThaiMon || '—'}</p>
              </div>
            </div>

            {!trace.coCongThuc ? (
              <div className="order-item-trace-notice warning"><CircleAlert size={20} /><div><strong>Món chưa thiết lập công thức</strong><p>Backend giữ nguyên quy trình cũ nên chưa thể xác định lô nguyên liệu của món này.</p></div></div>
            ) : !trace.daCapPhatNguyenLieu ? (
              <div className="order-item-trace-notice info"><PackageCheck size={20} /><div><strong>Chưa cấp phát nguyên liệu</strong><p>Nguyên liệu sẽ được chọn theo FEFO khi bếp bắt đầu chế biến món.</p></div></div>
            ) : (
              <>
                <div className="order-item-trace-notice success"><ShieldCheck size={20} /><div><strong>Đã ghi nhận {trace.cacLoDaSuDung?.length || 0} lượt cấp phát lô</strong><p>Các dữ liệu dưới đây được lưu tại thời điểm bếp bắt đầu chế biến.</p></div></div>
                <div className="order-item-trace-table-wrap">
                  <table className="order-item-trace-table">
                    <thead><tr><th>Nguyên liệu</th><th>Số lô</th><th>Lượng dùng</th><th>Hạn sử dụng</th><th>Nhà cung cấp</th><th>An toàn</th><th>Cấp phát</th></tr></thead>
                    <tbody>
                      {(trace.cacLoDaSuDung || []).map((row) => {
                        const safety = safetyLabel(row.trangThaiAnToan);
                        return (
                          <tr key={row.maSuDung}>
                            <td><strong>{row.tenNguyenLieu}</strong><small>{row.donViTinh}</small></td>
                            <td><b>{row.soLo}</b><small>Nhập: {dateOnly(row.ngayNhap)}</small></td>
                            <td><strong>{quantity(row.soLuongSuDung)} {row.donViTinh}</strong></td>
                            <td>{dateOnly(row.hanSuDung)}</td>
                            <td>{row.nhaCungCap || '—'}</td>
                            <td><span className={`order-item-trace-safety ${safety[1]}`}>{safety[0]}</span></td>
                            <td><small>{formatDate(row.thoiGianCapPhat)}</small><small>{row.nguoiCapPhat || 'Hệ thống'}</small></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : <div className="order-item-trace-empty">Không có dữ liệu truy xuất.</div>}
        <div className="order-item-trace-actions"><button type="button" onClick={onClose}>Đóng</button></div>
      </div>
    </Modal>
  );
}
