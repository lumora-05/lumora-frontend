import { Link, useParams } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import Button from '../common/Button';
export default function FoodCard({ food, onAdd }) { const {qrToken}=useParams(); return <div className="food-card"><Link to={`/table/${qrToken}/foods/${food.maMonAn}`} className="food-img">{food.hinhAnh ? <img src={imageUrl(food.hinhAnh)} /> : <span>🍽️</span>}</Link><div className="food-content"><small>{food.danhMuc?.tenDanhMuc || 'Món ăn'}</small><h3>{food.tenMonAn}</h3><p>{food.moTa || 'Món ăn được chế biến tươi ngon tại nhà hàng.'}</p><div className="food-bottom"><b>{formatMoney(food.gia)}</b><div className="row-actions"><Link className="btn" to={`/table/${qrToken}/foods/${food.maMonAn}`}><Eye size={16}/> Xem</Link>{onAdd && <Button onClick={() => onAdd(food)}><Plus size={16}/> Thêm</Button>}</div></div></div></div>; }
