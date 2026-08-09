import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Minus,
  Plus,
  ReceiptText,
  Send,
  ShoppingBag,
  Trash2,
  UtensilsCrossed
} from 'lucide-react';
import CustomerHeader from '../../components/customer/CustomerHeader';
import { orderApi } from '../../api/orderApi';
import { tableApi } from '../../api/tableApi';
import { useCart } from '../../context/CartContext';
import { useToast, errorMessageOf } from '../../context/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';

const foodId = (food) => food?.maMonAn ?? food?.id;
const PAYMENT_PENDING = new Set(['CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN', 'DA_THANH_TOAN']);

function unwrapList(response) {
  const data = response?.data ?? response;
  return Array.isArray(data) ? data : [];
}

function orderIdOf(order) {
  return order?.maDonHang ?? order?.id;
}

function callCount(order) {
  const calls = (order?.chiTietDonHang || [])
    .map((item) => Number(item?.lanGoi || 1))
    .filter((value) => Number.isFinite(value) && value > 0);
  return calls.length ? Math.max(...calls) : 1;
}

export default function Cart() {
  const toast = useToast();
  const { qrToken } = useParams();
  const cart = useCart();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [table, setTable] = useState(null);
  const [checkingOrder, setCheckingOrder] = useState(true);
  const resolvedTableId = table?.maBan ?? table?.id;
  const tableTopic = resolvedTableId ? `/topic/customer/tables/${resolvedTableId}` : '';
  const socketEvent = useWebSocket([tableTopic || '/topic/customer/tables/pending']);

  const loadCurrentOrder = useCallback(async () => {
    try {
      const [tableResponse, orderResponse] = await Promise.all([
        tableApi.customerTableByQrToken(qrToken),
        orderApi.customerOpenOrdersByQrToken(qrToken)
      ]);
      const tableData = tableResponse?.data ?? tableResponse;
      setTable(tableData?.banAn ?? tableData?.table ?? null);
      setCurrentOrder(unwrapList(orderResponse)[0] || null);
    } catch {
      setTable(null);
      setCurrentOrder(null);
    } finally {
      setCheckingOrder(false);
    }
  }, [qrToken]);

  useEffect(() => {
    setCheckingOrder(true);
    loadCurrentOrder();
  }, [loadCurrentOrder]);

  useEffect(() => {
    if (socketEvent?.topic === tableTopic) loadCurrentOrder();
  }, [socketEvent, tableTopic, loadCurrentOrder]);

  const currentStatus = currentOrder?.trangThai;
  const cannotAddMore = PAYMENT_PENDING.has(currentStatus);
  const currentId = orderIdOf(currentOrder);

  async function submit() {
    if (!cart.items.length || submitting || cannotAddMore) return;

    const payload = {
      qrToken,
      ghiChu: note.trim(),
      items: cart.items.map((item) => ({
        maMonAn: foodId(item),
        soLuong: Number(item.soLuong),
        ghiChu: item.ghiChu?.trim() || ''
      }))
    };

    try {
      setSubmitting(true);
      const wasAdditionalCall = Boolean(currentId);
      const response = await orderApi.customerCreate(payload);
      const data = response?.data ?? response;
      const orderId = orderIdOf(data);
      if (!orderId) throw new Error('Backend chưa trả về mã đơn hàng.');

      const nextCall = callCount(data);
      cart.clear();
      toast.success(wasAdditionalCall ? `Đã thêm món vào đơn #${orderId}` : `Đã gửi đơn #${orderId}`);
      navigate(`/table/${qrToken}/orders/${orderId}`, {
        state: { isAdditionalCall: wasAdditionalCall, callNumber: nextCall }
      });
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể gửi món. Vui lòng kiểm tra lại và thử lại.'));
      loadCurrentOrder();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="customer-flow-page customer-menu-bg-page">
      <CustomerHeader />

      <section className="customer-cart-container">
        <div className="customer-page-heading">
          <div>
            <span><ShoppingBag size={17} /> Giỏ hàng</span>
            <h1>{currentId ? 'Món gọi thêm' : 'Món bạn đã chọn'}</h1>
            <p>{currentId ? `Các món mới sẽ được thêm vào đơn #${currentId}.` : 'Kiểm tra lại món ăn trước khi gửi yêu cầu đến nhà hàng.'}</p>
          </div>
          <strong>{cart.count} món</strong>
        </div>

        {!cart.items.length ? (
          <section className="customer-empty-card">
            <span><ShoppingBag size={38} /></span>
            <h2>Giỏ hàng đang trống</h2>
            <p>Hãy quay lại thực đơn và chọn món bạn muốn gọi.</p>
            <Link to={`/table/${qrToken}`}><UtensilsCrossed size={19} /> Xem thực đơn</Link>
          </section>
        ) : (
          <div className="customer-cart-layout">
            <section className="customer-cart-items-card">
              <div className="customer-cart-card-head">
                <div>
                  <span>Danh sách món</span>
                  <h2>{cart.count} món đang chờ gửi</h2>
                </div>
                <button type="button" onClick={cart.clear}><Trash2 size={18} /> Xóa tất cả</button>
              </div>

              <div className="customer-cart-list">
                {cart.items.map((item) => {
                  const id = foodId(item);
                  return (
                    <article className="customer-cart-item" key={id}>
                      <div className="customer-cart-item-image">
                        {item.hinhAnh
                          ? <img src={imageUrl(item.hinhAnh)} alt={item.tenMonAn} />
                          : <UtensilsCrossed size={27} />}
                      </div>

                      <div className="customer-cart-item-main">
                        <div className="customer-cart-item-title">
                          <div>
                            <strong>{item.tenMonAn}</strong>
                            <span>{formatMoney(item.gia)} / phần</span>
                          </div>
                          <button type="button" onClick={() => cart.remove(id)} aria-label={`Xóa ${item.tenMonAn}`}><Trash2 size={17} /></button>
                        </div>

                        <input
                          value={item.ghiChu || ''}
                          onChange={(event) => cart.updateNote(id, event.target.value)}
                          placeholder="Ghi chú cho món, ví dụ: ít cay, không hành..."
                        />

                        <div className="customer-cart-item-bottom">
                          <div className="customer-cart-qty">
                            <button type="button" onClick={() => cart.updateQty(id, item.soLuong - 1)}><Minus size={17} /></button>
                            <strong>{item.soLuong}</strong>
                            <button type="button" onClick={() => cart.updateQty(id, item.soLuong + 1)}><Plus size={17} /></button>
                          </div>
                          <b>{formatMoney(Number(item.gia || 0) * Number(item.soLuong || 0))}</b>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <Link className="customer-continue-button" to={`/table/${qrToken}`}><ArrowLeft size={18} /> Tiếp tục chọn món</Link>
            </section>

            <aside className="customer-cart-summary-card">
              <span className="customer-cart-summary-icon"><ReceiptText size={25} /></span>
              <small>Thông tin đơn hàng</small>
              <h2>{currentId ? `Đơn hiện tại #${currentId}` : table?.tenBan || 'Bàn'}</h2>

              <label>
                <span>Ghi chú chung</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: mang món khai vị ra trước..." />
              </label>

              <div className="customer-cart-price-lines">
                <p><span>Tạm tính</span><b>{formatMoney(cart.total)}</b></p>
                <p><span>Phí phục vụ</span><b>{formatMoney(0)}</b></p>
                <p className="total"><span>Tổng cộng</span><strong>{formatMoney(cart.total)}</strong></p>
              </div>

              <button type="button" disabled={submitting || checkingOrder || cannotAddMore} onClick={submit}>
                {submitting
                  ? 'Đang gửi...'
                  : cannotAddMore
                    ? 'Đơn đang chờ thanh toán'
                    : <><Send size={20} /> {currentId ? 'Gửi món gọi thêm' : 'Gửi đơn hàng'}</>}
              </button>

              <Link className="customer-view-order-link" to={`/table/${qrToken}/orders`}>
                <ClipboardList size={18} /> Xem đơn hàng
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
