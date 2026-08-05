import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CirclePlus, Minus, Plus, Search, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { categoryApi, menuApi } from '../../api/menuApi';
import { orderApi } from '../../api/orderApi';
import { tableApi } from '../../api/tableApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatMoney } from '../../utils/formatMoney';
import { imageUrl } from '../../utils/imageUrl';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import { fetchReservationHoldMap, reservationHoldMessage, reservationHoldTime } from '../../utils/reservationHolds';

function unwrap(response) {
  return Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
}

function foodId(food) {
  return food?.maMonAn ?? food?.id;
}

function categoryId(category) {
  return category?.maDanhMuc ?? category?.id;
}

function foodCategoryId(food) {
  return food?.danhMuc?.maDanhMuc ?? food?.danhMuc?.id ?? food?.maDanhMuc ?? food?.categoryId;
}

function tableId(table) {
  return table?.maBan ?? table?.id;
}

function orderId(order) {
  return order?.maDonHang ?? order?.id;
}

function orderTableId(order) {
  return order?.banAn?.maBan ?? order?.maBan;
}

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

const OPEN_ORDER_STATUSES = new Set([
  'CHO_XAC_NHAN',
  'DA_XAC_NHAN',
  'DANG_CHUAN_BI',
  'DANG_CHE_BIEN',
  'SAN_SANG',
  'SAN_SANG_PHUC_VU',
  'DA_HOAN_THANH',
  'DA_PHUC_VU',
  'CHO_THANH_TOAN',
  'SAN_SANG_THANH_TOAN',
]);

const PAYMENT_PENDING_STATUSES = new Set(['CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN']);
const DRAFT_KEY = 'lumora-waiter-order-draft';

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}; }
  catch { return {}; }
}

function orderUpdatedAt(order) {
  const value = order?.thoiGianCapNhat || order?.thoiGianDat || order?.updatedAt || order?.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function nextCallNumber(order) {
  const values = (order?.chiTietDonHang || []).map((item) => Number(item?.lanGoi ?? item?.lanGoiMon ?? 1));
  return Math.max(0, ...values.filter(Number.isFinite)) + 1;
}

function statusLabel(status) {
  const labels = {
    CHO_XAC_NHAN: 'Đang chuyển xuống bếp',
    DA_XAC_NHAN: 'Đã chuyển xuống bếp',
    DANG_CHUAN_BI: 'Đang chuẩn bị',
    DANG_CHE_BIEN: 'Đang chế biến',
    SAN_SANG: 'Có món sẵn sàng',
    SAN_SANG_PHUC_VU: 'Có món sẵn sàng',
    DA_HOAN_THANH: 'Đã hoàn thành',
    DA_PHUC_VU: 'Đã phục vụ',
    CHO_THANH_TOAN: 'Chờ thanh toán',
    SAN_SANG_THANH_TOAN: 'Chờ thanh toán',
  };
  return labels[normalizeStatus(status)] || 'Đang phục vụ';
}

export default function WaiterOrderEntry() {
  const toast = useToast();
  const [params] = useSearchParams();
  const initialDraft = useMemo(() => readDraft(), []);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservationHolds, setReservationHolds] = useState(() => new Map());
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTable, setSelectedTable] = useState(params.get('table') || initialDraft.selectedTable || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [cart, setCart] = useState(Array.isArray(initialDraft.cart) ? initialDraft.cart : []);
  const [note, setNote] = useState(initialDraft.note || '');
  const [submitting, setSubmitting] = useState(false);
  const event = useWebSocket(['/topic/orders', '/topic/kitchen', '/topic/reservations']);

  const loadOrderingContext = useCallback(async ({ selectFirstTable = false, showError = true } = {}) => {
    try {
      const [tableResponse, orderResponse, holdMap] = await Promise.all([
        tableApi.getAll(),
        orderApi.getAll(),
        fetchReservationHoldMap().catch(() => new Map()),
      ]);
      const tableRows = unwrap(tableResponse);
      setTables(tableRows);
      setOrders(unwrap(orderResponse));
      setReservationHolds(holdMap);
      if (selectFirstTable) {
        setSelectedTable((current) => current || (tableRows[0] ? String(tableId(tableRows[0])) : ''));
      }
    } catch (error) {
      if (showError) toast.error(errorMessageOf(error, 'Không tải được trạng thái bàn và đơn hàng'));
    }
  }, [toast]);

  useEffect(() => {
    Promise.all([
      loadOrderingContext({ selectFirstTable: true }),
      menuApi.getActive().catch(() => menuApi.getAll()),
      categoryApi.getActive().catch(() => categoryApi.getAll()),
    ]).then(([, menuResponse, categoryResponse]) => {
      setFoods(unwrap(menuResponse));
      setCategories(unwrap(categoryResponse));
    }).catch((error) => toast.error(errorMessageOf(error, 'Không tải được dữ liệu đặt món')));
  }, [loadOrderingContext, toast]);

  useEffect(() => {
    if (['/topic/orders', '/topic/kitchen', '/topic/reservations'].includes(event?.topic)) {
      loadOrderingContext({ showError: false });
    }
  }, [event, loadOrderingContext]);

  const filteredFoods = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return foods.filter((food) => {
      const categoryMatch = selectedCategory === 'all' || String(foodCategoryId(food)) === String(selectedCategory);
      const keywordMatch = !q || String(food.tenMonAn || '').toLowerCase().includes(q);
      return categoryMatch && keywordMatch;
    });
  }, [foods, keyword, selectedCategory]);

  const openOrdersByTable = useMemo(() => {
    const result = new Map();
    [...orders]
      .filter((order) => OPEN_ORDER_STATUSES.has(normalizeStatus(order?.trangThai)))
      .sort((a, b) => orderUpdatedAt(b) - orderUpdatedAt(a) || Number(orderId(b) || 0) - Number(orderId(a) || 0))
      .forEach((order) => {
        const id = orderTableId(order);
        if (id != null && !result.has(String(id))) result.set(String(id), order);
      });
    return result;
  }, [orders]);

  const selectedTableObject = tables.find((table) => String(tableId(table)) === String(selectedTable));
  const selectedTableName = selectedTableObject?.tenBan || (selectedTable ? `Bàn ${selectedTable}` : 'bàn');
  const currentOrder = selectedTable ? openOrdersByTable.get(String(selectedTable)) || null : null;
  const selectedReservationHold = selectedTable ? reservationHolds.get(String(selectedTable)) || null : null;
  const currentStatus = normalizeStatus(currentOrder?.trangThai);
  const tablePaymentStatus = normalizeStatus(selectedTableObject?.trangThai) === 'DANG_THANH_TOAN';
  const paymentPending = PAYMENT_PENDING_STATUSES.has(currentStatus) || tablePaymentStatus;
  const waitingConfirmation = currentStatus === 'CHO_XAC_NHAN';
  const reservationBlocked = Boolean(selectedReservationHold && !currentOrder);
  const orderMode = paymentPending ? 'payment' : reservationBlocked ? 'reserved' : currentOrder ? 'add' : 'new';
  const total = cart.reduce((sum, item) => sum + Number(item.gia || 0) * item.soLuong, 0);

  const modeCopy = useMemo(() => {
    const id = orderId(currentOrder);
    if (!selectedTable) {
      return {
        title: 'Chưa chọn bàn',
        description: 'Chọn một bàn phụ trách để bắt đầu gọi món.',
        button: 'Xác nhận gọi món',
      };
    }
    if (paymentPending) {
      return {
        title: `Đơn #${id || '—'} đang chờ thanh toán`,
        description: 'Không thể gọi thêm món cho đến khi thu ngân hoàn tất thanh toán.',
        button: 'Đang chờ thanh toán',
      };
    }
    if (reservationBlocked) {
      return {
        title: `${selectedTableName} đã có lịch đặt sắp tới`,
        description: `Bàn được giữ lúc ${reservationHoldTime(selectedReservationHold)}. Vui lòng chọn bàn khác để tạo lượt phục vụ mới.`,
        button: 'Bàn đã được giữ',
      };
    }
    if (currentOrder) {
      if (waitingConfirmation) {
        return {
          title: `Bổ sung món cho ${selectedTableName}`,
          description: `Đơn #${id} đang được chuyển xuống bếp · Lượt gọi ${nextCallNumber(currentOrder)}.`,
          button: 'Thêm món vào đơn',
        };
      }
      return {
        title: `Gọi thêm món cho ${selectedTableName}`,
        description: `Đơn #${id} · Lượt gọi ${nextCallNumber(currentOrder)}. Món mới sẽ được thêm vào đơn hiện tại.`,
        button: 'Thêm món vào đơn',
      };
    }
    return {
      title: `Gọi món cho ${selectedTableName}`,
      description: 'Bàn chưa có đơn đang phục vụ. Món sẽ được chuyển trực tiếp xuống bếp.',
      button: 'Gửi đơn xuống bếp',
    };
  }, [currentOrder, paymentPending, reservationBlocked, selectedReservationHold, selectedTable, selectedTableName, waitingConfirmation]);

  function add(food) {
    if (paymentPending) return toast.error('Bàn đang chờ thanh toán, không thể gọi thêm món');
    const id = foodId(food);
    setCart((current) => {
      const found = current.find((item) => String(foodId(item)) === String(id));
      if (found) return current.map((item) => String(foodId(item)) === String(id) ? { ...item, soLuong: item.soLuong + 1 } : item);
      return [...current, { ...food, soLuong: 1, ghiChu: '' }];
    });
  }

  function updateQuantity(id, quantity) {
    if (paymentPending) return;
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => String(foodId(item)) !== String(id)));
      return;
    }
    setCart((current) => current.map((item) => String(foodId(item)) === String(id) ? { ...item, soLuong: quantity } : item));
  }

  function updateItemNote(id, value) {
    if (paymentPending) return;
    setCart((current) => current.map((item) => String(foodId(item)) === String(id) ? { ...item, ghiChu: value } : item));
  }

  async function submitOrder() {
    if (!selectedTable) return toast.error('Vui lòng chọn bàn');
    if (paymentPending) return toast.error('Đơn hàng đang chờ thanh toán, không thể gọi thêm món');
    if (reservationBlocked) return toast.error(reservationHoldMessage(selectedReservationHold, selectedTableName));
    if (!cart.length) return toast.error('Vui lòng chọn ít nhất một món');
    const payload = {
      maBan: Number(selectedTable),
      ghiChu: note,
      items: cart.map((item) => ({ maMonAn: foodId(item), soLuong: item.soLuong, ghiChu: item.ghiChu || '' })),
    };
    try {
      setSubmitting(true);
      const response = await orderApi.create(payload);
      const fallbackMessage = currentOrder
        ? `Đã thêm món vào đơn #${orderId(currentOrder)}`
        : 'Đã gửi đơn xuống bếp';
      toast.success(messageOf(response, fallbackMessage));
      setCart([]);
      setNote('');
      localStorage.removeItem(DRAFT_KEY);
      await loadOrderingContext({ showError: false });
    } catch (error) {
      toast.error(errorMessageOf(error, currentOrder ? 'Thêm món vào đơn thất bại' : 'Gửi đơn xuống bếp thất bại'));
      await loadOrderingContext({ showError: false });
    } finally {
      setSubmitting(false);
    }
  }

  function saveDraft() {
    if (!selectedTable && !cart.length && !note.trim()) {
      toast.info('Chưa có nội dung để lưu tạm');
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedTable, cart, note }));
    toast.success('Đã lưu đơn tạm trên thiết bị này');
  }

  function tableDisplayState(table) {
    const order = openOrdersByTable.get(String(tableId(table)));
    const status = normalizeStatus(order?.trangThai);
    if (PAYMENT_PENDING_STATUSES.has(status) || normalizeStatus(table?.trangThai) === 'DANG_THANH_TOAN') {
      return { label: 'Chờ thanh toán', tone: 'payment' };
    }
    if (order) return { label: statusLabel(status), tone: 'busy' };
    const hold = reservationHolds.get(String(tableId(table)));
    if (hold) return { label: `Đã đặt ${reservationHoldTime(hold)}`, tone: 'reserved' };
    return { label: 'Trống', tone: 'empty' };
  }

  return (
    <section className="waiter-page waiter-order-entry-page">
      <div className="waiter-order-layout">
        <aside className="waiter-card waiter-order-tables">
          <div className="waiter-card-head"><h3>Bàn phụ trách</h3></div>
          <div className="waiter-order-table-list">
            {tables.map((table) => {
              const displayState = tableDisplayState(table);
              return (
                <button key={tableId(table)} className={String(tableId(table)) === String(selectedTable) ? 'active' : ''} onClick={() => setSelectedTable(String(tableId(table)))}>
                  <span><b>{table.tenBan || `Bàn ${tableId(table)}`}</b><small>{table.sucChua || 4} khách</small></span>
                  <em className={displayState.tone}>{displayState.label}</em>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="waiter-card waiter-menu-panel">
          <div className="waiter-card-head waiter-menu-head">
            <h3>Chọn món cho {selectedTableObject?.tenBan || 'bàn'}</h3>
            <label className="waiter-search"><Search size={18} /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món..." /></label>
          </div>
          <div className={`waiter-order-mode-banner ${orderMode}`}>
            <span>{['payment', 'reserved'].includes(orderMode) ? <AlertCircle size={20} /> : <CirclePlus size={20} />}</span>
            <div><strong>{modeCopy.title}</strong><p>{modeCopy.description}</p></div>
            {currentOrder && !paymentPending ? <em>{statusLabel(currentOrder.trangThai)}</em> : null}
          </div>
          <div className="waiter-category-tabs">
            <button className={selectedCategory === 'all' ? 'active' : ''} onClick={() => setSelectedCategory('all')}>Tất cả</button>
            {categories.map((category) => (
              <button key={categoryId(category)} className={String(selectedCategory) === String(categoryId(category)) ? 'active' : ''} onClick={() => setSelectedCategory(String(categoryId(category)))}>{category.tenDanhMuc || category.name}</button>
            ))}
          </div>
          <div className="waiter-food-grid">
            {filteredFoods.map((food) => (
              <article key={foodId(food)}>
                <div className="waiter-food-image">{food.hinhAnh ? <img src={imageUrl(food.hinhAnh)} alt={food.tenMonAn} /> : <span>🍽️</span>}</div>
                <div><b>{food.tenMonAn}</b><strong>{formatMoney(food.gia || 0)}</strong></div>
                <button disabled={paymentPending} onClick={() => add(food)}><Plus size={17} />{paymentPending ? 'Đang chờ thanh toán' : 'Thêm'}</button>
              </article>
            ))}
          </div>
        </main>

        <aside className="waiter-card waiter-cart-panel">
          <div className="waiter-card-head waiter-cart-mode-head">
            <div><h3>{modeCopy.title}</h3><small>{selectedTableObject?.tenBan || 'Chưa chọn bàn'}</small></div>
            <span>{cart.length} món</span>
          </div>
          <div className="waiter-cart-items">
            {cart.length === 0 ? <p className="waiter-empty-note">Chưa có món trong đơn tạm.</p> : cart.map((item) => (
              <div className="waiter-cart-item" key={foodId(item)}>
                <div className="waiter-cart-item-main"><b>{item.tenMonAn}</b><strong>{formatMoney(Number(item.gia || 0) * item.soLuong)}</strong></div>
                <div className="waiter-cart-item-controls">
                  <div><button disabled={paymentPending} onClick={() => updateQuantity(foodId(item), item.soLuong - 1)}><Minus size={14} /></button><span>{item.soLuong}</span><button disabled={paymentPending} onClick={() => updateQuantity(foodId(item), item.soLuong + 1)}><Plus size={14} /></button></div>
                  <input disabled={paymentPending} value={item.ghiChu || ''} onChange={(e) => updateItemNote(foodId(item), e.target.value)} placeholder="Ghi chú món" />
                  <button disabled={paymentPending} className="remove" onClick={() => updateQuantity(foodId(item), 0)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
          <textarea disabled={paymentPending} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú chung cho bếp..." />
          <div className="waiter-cart-summary"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></div>
          <button className="waiter-send-order" disabled={submitting || !cart.length || !selectedTable || paymentPending || reservationBlocked} onClick={submitOrder}><Send size={19} />{submitting ? 'Đang gửi...' : modeCopy.button}</button>
          <button className="waiter-secondary-action" onClick={saveDraft}><ShoppingCart size={18} />Lưu tạm</button>
        </aside>
      </div>
    </section>
  );
}
