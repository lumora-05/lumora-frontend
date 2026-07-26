import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Minus, Plus, Printer } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { paymentApi } from '../../api/paymentApi';
import { errorMessageOf } from '../../context/ToastContext';
import { formatMoney } from '../../utils/formatMoney';
import {
  dateTimeText,
  discountOf,
  documentCode,
  serviceFeeOf,
  subtotalOf,
  tableNameOf,
  totalOf,
} from '../../utils/cashier';

const METHOD_LABELS = {
  TIEN_MAT: 'Tiền mặt',
  CHUYEN_KHOAN: 'Chuyển khoản',
};

const RESTAURANT = {
  name: import.meta.env.VITE_RESTAURANT_NAME || 'NHÀ HÀNG LUMORA',
  address: import.meta.env.VITE_RESTAURANT_ADDRESS || 'Địa chỉ nhà hàng',
  phone: import.meta.env.VITE_RESTAURANT_PHONE || 'Số điện thoại nhà hàng',
};

function slipItemsOf(slip) {
  return (slip?.items || []).map((item) => ({
    key: item?.maChiTiet,
    name: item?.tenMonAn || 'Món ăn',
    quantity: Number(item?.soLuong || 0),
    unitPrice: Number(item?.donGia || 0),
    lineTotal: Number(item?.thanhTien ?? Number(item?.donGia || 0) * Number(item?.soLuong || 0)),
    note: item?.ghiChu,
  }));
}

function orderItemsOf(order) {
  return (order?.chiTietDonHang || []).filter((item) => item?.trangThaiMon !== 'DA_HUY').map((item) => {
    const unitPrice = Number(item?.donGia ?? item?.monAn?.gia ?? 0);
    const quantity = Number(item?.soLuong || 0);
    return {
      key: item?.maChiTiet,
      name: item?.monAn?.tenMonAn || item?.tenMonAn || 'Món ăn',
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      note: item?.ghiChu,
    };
  });
}

function Receipt({ order, payment, slip, preview }) {
  const items = preview ? slipItemsOf(slip) : orderItemsOf(order);
  const subtotal = preview
    ? Number(slip?.tamTinh ?? items.reduce((sum, item) => sum + item.lineTotal, 0))
    : Number(payment?.tamTinh ?? subtotalOf(order));
  const serviceFee = preview ? 0 : serviceFeeOf(order);
  const discount = preview
    ? Number(slip?.tienGiam ?? Math.max(0, subtotal - Number(slip?.tongTien || 0)))
    : Number(payment?.tienGiam ?? discountOf(order));
  const total = preview ? Number(slip?.tongTien || 0) : Number(payment?.tongTien ?? totalOf(order));
  const promotionCode = preview
    ? slip?.maCodeKhuyenMai
    : (payment?.maCodeKhuyenMai || order?.maCodeKhuyenMai || order?.khuyenMai?.maCode);
  const qr = slip?.vietQr;
  const code = preview
    ? (slip?.maDonHangHienThi || `DH${String(slip?.maDonHang || '').padStart(7, '0')}`)
    : documentCode({ ...order, maHoaDon: payment?.maHoaDon || order?.maHoaDon });
  const tableName = preview ? (slip?.tenBan || 'Mang đi') : tableNameOf(order);
  const time = preview
    ? (slip?.thoiGianTaoPhieu || slip?.thoiGianYeuCauThanhToan || slip?.thoiGianDat)
    : (payment?.thoiGianThanhToan || payment?.ngayThanhToan || order?.thoiGianDat);
  const employee = preview
    ? (slip?.nhanVienPhucVu || '—')
    : (payment?.nhanVien?.hoTen || payment?.tenNhanVien || order?.nhanVien?.hoTen || '—');

  return (
    <article className={`cashier-receipt ${preview ? 'cashier-payment-slip' : ''}`}>
      <header>
        <h2>{RESTAURANT.name}</h2>
        <p>Địa chỉ: 139 Nguyễn Thị Thập, Thanh Khê, Đà Nẵng</p>
        <p>Điện thoại: 0979792909</p>
        <strong>{preview ? 'PHIẾU TẠM TÍNH' : 'HÓA ĐƠN THANH TOÁN'}</strong>
      </header>

      <div className="cashier-receipt-meta">
        <p><span>{preview ? 'Mã đơn' : 'Mã hóa đơn'}</span><b>{code}</b></p>
        <p><span>Bàn</span><b>{tableName}</b></p>
        <p><span>Thời gian</span><b>{dateTimeText(time)}</b></p>
        <p><span>Nhân viên</span><b>{employee}</b></p>
        {!preview && <p><span>Thanh toán</span><b>{METHOD_LABELS[payment?.phuongThucThanhToan || payment?.phuongThuc] || 'Đã thanh toán'}</b></p>}
      </div>

      <table>
        <thead><tr><th>STT</th><th>Tên món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.key || index}>
              <td>{index + 1}</td>
              <td>
                {item.name}
                {item.note ? <small className="cashier-receipt-item-note">{item.note}</small> : null}
              </td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.unitPrice)}</td>
              <td>{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cashier-receipt-total">
        <p><span>Tạm tính</span><b>{formatMoney(subtotal)}</b></p>
        {!preview && <p><span>Phí phục vụ</span><b>{formatMoney(serviceFee)}</b></p>}
        {discount > 0 && <p><span>Khuyến mãi{promotionCode ? ` (${promotionCode})` : ''}</span><b>-{formatMoney(discount)}</b></p>}
        <p className="grand"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></p>
      </div>

      {preview && qr ? (
        <section className="cashier-receipt-qr">
          <strong>QUÉT MÃ ĐỂ CHUYỂN KHOẢN</strong>
          <img src={qr.qrUrl} alt={`VietQR thanh toán đơn ${code}`} />
          <div className="cashier-receipt-bank">
            <p><span>Ngân hàng</span><b>{qr.bankName || qr.bankId}</b></p>
            <p><span>Số tài khoản</span><b>{qr.accountNo}</b></p>
            <p><span>Chủ tài khoản</span><b>{qr.accountName}</b></p>
            <p><span>Số tiền</span><b>{formatMoney(Number(qr.amount || total))}</b></p>
            <p><span>Nội dung</span><b>{qr.addInfo}</b></p>
          </div>
          <p className="cashier-receipt-qr-note">Vui lòng chuyển đúng số tiền và giữ nguyên nội dung chuyển khoản.</p>
        </section>
      ) : null}

      {!preview && payment?.phuongThucThanhToan === 'TIEN_MAT' ? (
        <div className="cashier-receipt-payment-detail">
          <p><span>Khách đưa</span><b>{formatMoney(Number(payment?.tienKhachDua || total))}</b></p>
          <p><span>Tiền thừa</span><b>{formatMoney(Number(payment?.tienThua || 0))}</b></p>
        </div>
      ) : null}

      {!preview && payment?.phuongThucThanhToan === 'CHUYEN_KHOAN' && payment?.maGiaoDich ? (
        <div className="cashier-receipt-payment-detail">
          <p><span>Mã tham chiếu</span><b>{payment.maGiaoDich}</b></p>
        </div>
      ) : null}

      <footer>
        {preview ? (
          <>
            <p><strong>PHIẾU NÀY CHƯA XÁC NHẬN THANH TOÁN</strong></p>
            <p>Vui lòng báo nhân viên sau khi chuyển khoản.</p>
          </>
        ) : (
          <>
            <p>Cảm ơn quý khách!</p>
            <p>Hẹn gặp lại</p>
          </>
        )}
      </footer>
    </article>
  );
}

export default function PrintInvoice() {
  const { orderId } = useParams();
  const location = useLocation();
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [slip, setSlip] = useState(null);
  const [paperSize, setPaperSize] = useState('80');
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const request = preview
      ? paymentApi.paymentSlipByOrder(orderId).then((response) => {
        if (!active) return;
        setSlip(response?.data || response);
      })
      : Promise.all([
        orderApi.getById(orderId),
        paymentApi.byOrder(orderId).catch(() => null),
      ]).then(([orderResponse, paymentResponse]) => {
        if (!active) return;
        setOrder(orderResponse?.data || orderResponse);
        setPayment(paymentResponse?.data || paymentResponse || null);
      });

    request.catch((requestError) => {
      if (active) setError(errorMessageOf(requestError, preview ? 'Không tạo được phiếu tạm tính có VietQR.' : 'Không tải được dữ liệu để in.'));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [orderId, preview]);

  const printableCopies = useMemo(() => Array.from({ length: copies }, (_, index) => index), [copies]);
  const hasData = preview ? Boolean(slip) : Boolean(order);

  if (loading) {
    return <section className="page cashier-page"><div className="cashier-table-empty cashier-loading-card">{preview ? 'Đang tạo phiếu tạm tính có VietQR...' : 'Đang tải hóa đơn...'}</div></section>;
  }

  if (!hasData) {
    return (
      <section className="page cashier-page cashier-workspace">
        <div className="cashier-load-error">
          <span>{error || (preview ? 'Không tạo được phiếu thanh toán.' : 'Không tìm thấy hóa đơn.')}</span>
          <Link to={`/cashier/invoices/${orderId}`}>Quay lại chi tiết đơn</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page cashier-page cashier-workspace cashier-print-page">
      <div className="cashier-back-row no-print">
        <Link className="cashier-back-button" to={`/cashier/invoices/${orderId}`}><ArrowLeft size={17} />Quay lại</Link>
      </div>

      <div className="cashier-print-layout">
        <div className={`cashier-receipt-stage paper-${paperSize}`}>
          <div className="cashier-preview-label no-print">{preview ? 'Phiếu tạm tính có VietQR' : 'Bản xem trước hóa đơn'}</div>
          <Receipt order={order} payment={payment} slip={slip} preview={preview} />
        </div>

        <aside className="cashier-print-options no-print">
          <div className="cashier-section-title">
            <span>TÙY CHỌN IN</span>
            <h2>{preview ? 'In phiếu thanh toán' : 'Thiết lập hóa đơn'}</h2>
          </div>

          {preview ? (
            <div className="cashier-print-flow-note">
              <strong>Phiếu dành cho khách tại bàn</strong>
              <p>Phiếu có VietQR đúng số tiền và nội dung đơn. In phiếu rồi giao cho phục vụ mang ra bàn.</p>
              <p>Việc in phiếu không làm đơn chuyển sang đã thanh toán.</p>
            </div>
          ) : null}

          <label>
            <span>Khổ giấy</span>
            <select value={paperSize} onChange={(event) => setPaperSize(event.target.value)}>
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
              <option value="A4">A4</option>
            </select>
          </label>

          <div className="cashier-copy-control">
            <span>Số bản in</span>
            <div>
              <button type="button" onClick={() => setCopies((value) => Math.max(1, value - 1))}><Minus size={16} /></button>
              <strong>{copies}</strong>
              <button type="button" onClick={() => setCopies((value) => Math.min(9, value + 1))}><Plus size={16} /></button>
            </div>
          </div>

          <button type="button" className="cashier-primary-action cashier-print-main-button" onClick={() => window.print()}>
            <Printer size={18} />{preview ? 'In phiếu có VietQR' : 'In hóa đơn'}
          </button>

          <p className="cashier-print-note">Bản xem trước đang hiển thị bên trái. Khi bấm in, trình duyệt sẽ mở hộp thoại hệ thống để chọn máy in thực tế.</p>
        </aside>
      </div>

      <div className={`cashier-print-copies paper-${paperSize}`} aria-hidden="true">
        {printableCopies.map((copy) => <Receipt key={copy} order={order} payment={payment} slip={slip} preview={preview} />)}
      </div>
    </section>
  );
}
