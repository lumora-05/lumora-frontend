import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Clock3, Flame, Play, Search, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import {
  canonicalKitchenStatus,
  flattenKitchenOrders,
  formatKitchenTime,
  formatKitchenWait,
  kitchenCallNumber,
  kitchenItemId,
  kitchenItemName,
  kitchenOrderId,
  kitchenOrderedAt,
  kitchenStatusMeta,
  kitchenTableName,
  kitchenWaitMinutes,
  unwrapList,
} from '../../utils/kitchenData';

const TABS = [
  ['ACTIVE', 'Cần làm'],
  ['CHO_BEP', 'Mới'],
  ['DANG_NAU', 'Đang chế biến'],
  ['HOAN_THANH', 'Hoàn thành'],
];

function groupStatus(list) {
  if (list.every((item) => canonicalKitchenStatus(item) === 'HOAN_THANH')) return 'HOAN_THANH';
  if (list.some((item) => canonicalKitchenStatus(item) === 'DANG_NAU')) return 'DANG_NAU';
  return 'CHO_BEP';
}

function groupKey(item) {
  return `${kitchenOrderId(item)}-${kitchenCallNumber(item)}`;
}

export default function KitchenBoard() {
  const toast = useToast();
  const event = useWebSocket(['/topic/kitchen', '/topic/orders']);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('ACTIVE');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const [now, setNow] = useState(Date.now());
  const previousWaiting = useRef(new Set());

  async function load(showNotice = false, silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await orderApi.getAll();
      const next = flattenKitchenOrders(unwrapList(response));
      setItems(next);

      const waiting = new Set(next
        .filter((item) => canonicalKitchenStatus(item) === 'CHO_BEP')
        .map((item) => `${groupKey(item)}-${kitchenItemId(item)}`));
      if (showNotice && [...waiting].some((key) => !previousWaiting.current.has(key))) {
        toast.info('Có món mới được gửi vào bếp');
      }
      previousWaiting.current = waiting;
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được danh sách món cần chế biến'));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { load(false); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (event?.topic === '/topic/kitchen' || event?.topic === '/topic/orders') load(true, true);
  }, [event]);

  const allGroups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = groupKey(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map.entries()].map(([key, list]) => ({ key, list, status: groupStatus(list) }));
  }, [items]);

  const counts = useMemo(() => allGroups.reduce((result, group) => {
    if (group.status !== 'HOAN_THANH') result.ACTIVE += 1;
    result[group.status] += 1;
    return result;
  }, { ACTIVE: 0, CHO_BEP: 0, DANG_NAU: 0, HOAN_THANH: 0 }), [allGroups]);

  const overdueCount = useMemo(() => allGroups.filter(({ list, status }) => (
    status !== 'HOAN_THANH' && kitchenWaitMinutes(kitchenOrderedAt(list[0]), now) >= 15
  )).length, [allGroups, now]);

  const groups = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return allGroups
      .filter(({ status }) => tab === 'ACTIVE' ? status !== 'HOAN_THANH' : status === tab)
      .filter(({ list }) => {
        if (!q) return true;
        const first = list[0];
        const haystack = [
          kitchenOrderId(first),
          kitchenTableName(first),
          kitchenCallNumber(first),
          first?.ghiChuDon,
          ...list.flatMap((item) => [kitchenItemName(item), item?.ghiChu]),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aTime = new Date(kitchenOrderedAt(a.list[0]) || 0).getTime();
        const bTime = new Date(kitchenOrderedAt(b.list[0]) || 0).getTime();
        return tab === 'HOAN_THANH' ? bTime - aTime : aTime - bTime;
      });
  }, [allGroups, keyword, tab]);

  async function updateItems(targetItems, nextStatus, successMessage) {
    const candidates = targetItems.filter((item) => canonicalKitchenStatus(item) !== nextStatus);
    if (!candidates.length) return;
    const ids = candidates.map(kitchenItemId).filter(Boolean);
    setBusyIds((current) => new Set([...current, ...ids]));
    try {
      const results = await Promise.allSettled(candidates.map((item) => (
        orderApi.updateItemStatus(kitchenItemId(item), { trangThaiMon: nextStatus })
      )));
      const successful = results.filter((result) => result.status === 'fulfilled');
      const failed = results.filter((result) => result.status === 'rejected');

      if (successful.length) {
        const fallback = failed.length
          ? `Đã cập nhật ${successful.length}/${candidates.length} món`
          : successMessage;
        toast.success(messageOf(successful.at(-1).value, fallback));
      }
      if (failed.length) {
        const messages = [...new Set(failed.map((result) => (
          errorMessageOf(result.reason, 'Không thể bắt đầu chế biến do nguyên liệu không đủ hoặc lô không an toàn')
        )))];
        toast.error(messages.length > 1 ? `${messages[0]} (và ${messages.length - 1} lỗi khác)` : messages[0]);
      }
      await load(false, true);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Cập nhật trạng thái món thất bại'));
      await load(false, true);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  function quickUpdate(item) {
    const current = canonicalKitchenStatus(item);
    if (current === 'CHO_BEP') return updateItems([item], 'DANG_NAU', 'Đã bắt đầu chế biến món');
    if (current === 'DANG_NAU') return updateItems([item], 'HOAN_THANH', 'Đã xác nhận món hoàn thành');
    return undefined;
  }

  return (
    <section className="kitchen-page kitchen-queue-page">
      <div className="kitchen-live-summary">
        <article><span className="waiting"><UtensilsCrossed size={20} /></span><div><small>Phiếu mới</small><strong>{counts.CHO_BEP}</strong><p>Đang chờ bắt đầu</p></div></article>
        <article><span className="cooking"><Flame size={20} /></span><div><small>Đang chế biến</small><strong>{counts.DANG_NAU}</strong><p>Đang được bếp xử lý</p></div></article>
        <article className={overdueCount ? 'attention' : ''}><span className="overdue"><AlertTriangle size={20} /></span><div><small>Chờ trên 15 phút</small><strong>{overdueCount}</strong><p>Cần ưu tiên xử lý</p></div></article>
      </div>

      <div className="kitchen-card kitchen-queue-card">
        <div className="kitchen-queue-toolbar">
          <div className="kitchen-queue-tabs">
            {TABS.map(([value, label]) => (
              <button type="button" key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
                {label}<span>{counts[value]}</span><small>phiếu</small>
              </button>
            ))}
          </div>
          <label className="kitchen-modern-search">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm bàn, mã đơn hoặc món ăn..." />
          </label>
        </div>

        <div className="kitchen-batch-list">
          {loading ? <div className="kitchen-list-empty">Đang tải bảng chế biến...</div> : null}
          {!loading && groups.map(({ key, list, status }) => {
            const first = list[0];
            const orderId = kitchenOrderId(first);
            const call = kitchenCallNumber(first);
            const batchMeta = kitchenStatusMeta(status);
            const waitMinutes = kitchenWaitMinutes(kitchenOrderedAt(first), now);
            const overdue = status !== 'HOAN_THANH' && waitMinutes >= 15;
            const waitingItems = list.filter((item) => canonicalKitchenStatus(item) === 'CHO_BEP');
            const cookingItems = list.filter((item) => canonicalKitchenStatus(item) === 'DANG_NAU');
            const isBatchBusy = list.some((item) => busyIds.has(kitchenItemId(item)));
            return (
              <article className={`kitchen-batch-card ${batchMeta.tone} ${overdue ? 'overdue' : ''}`} key={key}>
                <header>
                  <div className="kitchen-ticket-identity">
                    <strong>{kitchenTableName(first)}</strong>
                    <span>Mã đơn: #{orderId}</span>
                    <em className={call > 1 ? 'additional' : ''}>{call > 1 ? `Lượt gọi thêm #${call}` : 'Lượt gọi đầu'}</em>
                  </div>
                  <div className="kitchen-ticket-time">
                    <time><Clock3 size={15} />{formatKitchenTime(kitchenOrderedAt(first))}</time>
                    <b className={overdue ? 'overdue' : ''}>{formatKitchenWait(kitchenOrderedAt(first), now)}</b>
                    <span className={`kitchen-state-pill ${batchMeta.tone}`}>{batchMeta.label}</span>
                  </div>
                </header>

                {first?.ghiChuDon ? <div className="kitchen-order-note"><AlertTriangle size={16} /><span><b>Ghi chú đơn:</b> {first.ghiChuDon}</span></div> : null}

                <div className="kitchen-table-scroll">
                  <table className="kitchen-compact-table kitchen-action-table">
                    <thead>
                      <tr><th>STT</th><th>Tên món</th><th>Số lượng</th><th>Trạng thái</th><th>Thao tác</th></tr>
                    </thead>
                    <tbody>
                      {list.map((item, index) => {
                        const id = kitchenItemId(item);
                        const current = canonicalKitchenStatus(item);
                        const meta = kitchenStatusMeta(current);
                        const busy = busyIds.has(id);
                        return (
                          <tr key={id || `${key}-${index}`}>
                            <td data-label="STT">{index + 1}</td>
                            <td data-label="Tên món">
                              <b>{kitchenItemName(item)}</b>
                              {item?.ghiChu ? <small className="kitchen-item-note">Ghi chú: {item.ghiChu}</small> : null}
                            </td>
                            <td data-label="Số lượng"><strong className="kitchen-quantity">×{item?.soLuong || 1}</strong></td>
                            <td data-label="Trạng thái"><span className={`kitchen-state-pill ${meta.tone}`}>{meta.label}</span></td>
                            <td data-label="Thao tác">
                              {current === 'HOAN_THANH' ? (
                                <span className="kitchen-row-complete"><Check size={16} />Đã xong</span>
                              ) : (
                                <button type="button" className={`kitchen-item-action ${current === 'CHO_BEP' ? 'start' : 'finish'}`} disabled={busy} onClick={() => quickUpdate(item)}>
                                  {current === 'CHO_BEP' ? <Play size={15} /> : <Check size={15} />}
                                  {busy ? 'Đang cập nhật...' : current === 'CHO_BEP' ? 'Bắt đầu' : 'Hoàn thành'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <footer>
                  <span><UtensilsCrossed size={16} />{list.reduce((sum, item) => sum + Number(item?.soLuong || 1), 0)} phần món</span>
                  <div className="kitchen-batch-actions">
                    {waitingItems.length ? <button type="button" className="start" disabled={isBatchBusy} onClick={() => updateItems(waitingItems, 'DANG_NAU', `Đã bắt đầu ${waitingItems.length} món`)}><Play size={15} />Bắt đầu tất cả món mới</button> : null}
                    {cookingItems.length ? <button type="button" className="finish" disabled={isBatchBusy} onClick={() => updateItems(cookingItems, 'HOAN_THANH', `Đã hoàn thành ${cookingItems.length} món`)}><Check size={15} />Hoàn thành món đang nấu</button> : null}
                    <Link to={`/kitchen/orders/${orderId}?call=${call}`}>Chi tiết <ChevronRight size={17} /></Link>
                  </div>
                </footer>
              </article>
            );
          })}
          {!loading && !groups.length ? <div className="kitchen-list-empty">Không có phiếu bếp phù hợp với bộ lọc.</div> : null}
        </div>
      </div>
    </section>
  );
}
