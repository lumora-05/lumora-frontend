import Badge from '../common/Badge';
export default function OrderItem({ item, onNext }) { return <div className="kitchen-item"><div><b>{item.monAn?.tenMonAn}</b><span>Số lượng: {item.soLuong}</span><small>{item.ghiChu}</small></div><Badge>{item.trangThaiMon}</Badge>{onNext && <button className="btn" onClick={() => onNext(item)}>Cập nhật</button>}</div>; }
