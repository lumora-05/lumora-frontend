import Badge from '../common/Badge';
import { formatMoney } from '../../utils/formatMoney';
import { formatDate } from '../../utils/formatDate';
export default function OrderCard({ order, actions }) { return <div className="order-card"><div className="order-head"><div><b>Đơn #{order.maDonHang}</b><span>{order.banAn?.tenBan}</span></div><Badge>{order.trangThai}</Badge></div><p>{formatDate(order.thoiGianDat)}</p><ul>{order.chiTietDonHang?.map(i => <li key={i.maChiTiet}><span>{i.monAn?.tenMonAn} × {i.soLuong}</span><Badge>{i.trangThaiMon}</Badge></li>)}</ul><div className="order-foot"><strong>{formatMoney(order.tongTien)}</strong><div>{actions}</div></div></div>; }
