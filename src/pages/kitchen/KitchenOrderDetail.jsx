import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock3, Eye, Play, RotateCcw, UtensilsCrossed } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import { useToast, errorMessageOf, messageOf } from '../../context/ToastContext';
import {
  canonicalKitchenStatus,
  formatKitchenTime,
  formatKitchenWait,
  kitchenCallNumber,
  kitchenItemId,
  kitchenItemName,
  kitchenOrderId,
  kitchenOrderedAt,
  kitchenStatusMeta,
  kitchenTableName,
  kitchenUnitPosition,
  unwrapObject,
  HIDDEN_KITCHEN_ITEM_STATUSES,
} from '../../utils/kitchenData';

export default function KitchenOrderDetail() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const selectedCall = Number(searchParams.get('call')) || null;
  const readOnly = searchParams.get('readonly') === '1';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await orderApi.getById(orderId);
      setOrder(unwrapObject(response));
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được chi tiết phiếu bếp'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orderId]);

  const allItems = (order?.chiTietDonHang || []).filter((item) => !HIDDEN_KITCHEN_ITEM_STATUSES.has(String(item?.trangThaiMon || '').toUpperCase()));
  const items = useMemo(() => selectedCall
    ? allItems.filter((item) => kitchenCallNumber(item) === selectedCall)
    : allItems, [allItems, selectedCall]);
  const first = items[0] || order;
  const waitingItems = items.filter((item) => canonicalKitchenStatus(item) === 'CHO_BEP');
  const cookingItems = items.filter((item) => canonicalKitchenStatus(item) === 'DANG_NAU');
  const doneItems = items.filter((item) => canonicalKitchenStatus(item) === 'HOAN_THANH');
  const allDone = items.length > 0 && doneItems.length === items.length;
  const isBatchBusy = items.some((item) => busyIds.has(kitchenItemId(item)));

  async function updateItems(targetItems, nextStatus, successMessage) {
    if (readOnly) return;
    const candidates = targetItems.filter((item) => canonicalKitchenStatus(item) !== nextStatus);
    if (!candidates.length) return;
    const ids = candidates.map(kitchenItemId).filter(Boolean);
    setBusyIds((current) => new Set([...current, ...ids]));
    try {
      const response = candidates.length === 1
        ? await orderApi.updateItemStatus(ids[0], { trangThaiMon: nextStatus })
        : await orderApi.updateItemStatusesBulk({ itemIds: ids, trangThaiMon: nextStatus });
      toast.success(messageOf(response, successMessage));
      await load(false);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Cập nhật trạng thái món thất bại'));
      await load(false);
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

  function canUndoKitchenItem(item) {
    const current = canonicalKitchenStatus(item);
    const rawStatus = String(item?.trangThaiMon || '').toUpperCase();
    if (['DA_PHUC_VU', 'DA_HUY', 'YEU_CAU_HUY'].includes(rawStatus)) return false;
    return current === 'DANG_NAU' || current === 'HOAN_THANH';
  }

  function undoKitchenItem(item) {
    const current = canonicalKitchenStatus(item);
    if (!canUndoKitchenItem(item)) return undefined;

    if (current === 'HOAN_THANH') {
      const confirmed = window.confirm('Đưa món này về trạng thái Đang chế biến? Phục vụ sẽ không còn thấy món này là đã hoàn thành.');
      if (!confirmed) return undefined;
      return updateItems([item], 'DANG_NAU', 'Đã đưa món về trạng thái đang chế biến');
    }

    if (current === 'DANG_NAU') {
      return updateItems([item], 'CHO_BEP', 'Đã đưa món về trạng thái chờ chế biến');
    }

    return undefined;
  }

  if (loading) return <section className="kitchen-page"><div className="kitchen-list-empty">Đang tải chi tiết phiếu bếp...</div></section>;
  if (!order) return <section className="kitchen-page"><div className="kitchen-list-empty">Không tìm thấy đơn hàng.</div></section>;
  if (!items.length) return <section className="kitchen-page"><div className="kitchen-list-empty">Không tìm thấy món thuộc lượt gọi đã chọn.</div></section>;

  return (
    <section className="kitchen-page kitchen-order-detail-modern">
      <div className="kitchen-card kitchen-detail-card-modern">
        <div className="kitchen-detail-titlebar">
          <div>
            <Link to={readOnly ? '/kitchen/history' : '/kitchen'} className="kitchen-modern-back"><ArrowLeft size={17} />{readOnly ? 'Quay lại lịch sử' : 'Quay lại bảng chế biến'}</Link>
            <h2>{kitchenTableName(order)} · {selectedCall && selectedCall > 1 ? `Lượt gọi thêm #${selectedCall}` : selectedCall === 1 ? 'Lượt gọi đầu' : 'Toàn bộ đơn'}</h2>
            <p>Mã đơn: #{kitchenOrderId(order)} · Gửi lúc {formatKitchenTime(kitchenOrderedAt(first))} · {formatKitchenWait(kitchenOrderedAt(first))}</p>
          </div>
          {readOnly ? <span className="kitchen-readonly-banner"><Eye size={18} />Chế độ chỉ xem</span> : allDone ? <span className="kitchen-complete-banner"><CheckCircle2 size={18} />Tất cả món đã hoàn thành</span> : null}
        </div>

        <div className="kitchen-detail-summary-grid">
          <article><span>Tổng món</span><strong>{items.length}</strong></article>
          <article className="waiting"><span>Mới</span><strong>{waitingItems.length}</strong></article>
          <article className="cooking"><span>Đang chế biến</span><strong>{cookingItems.length}</strong></article>
          <article className="done"><span>Hoàn thành</span><strong>{doneItems.length}</strong></article>
        </div>

        <div className="kitchen-table-scroll">
          <table className="kitchen-detail-table-modern kitchen-action-table">
            <thead>
              <tr><th>STT</th><th>Tên món</th><th>Suất</th><th>Trạng thái</th>{!readOnly ? <th>Thao tác</th> : null}</tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const id = kitchenItemId(item);
                const current = canonicalKitchenStatus(item);
                const meta = kitchenStatusMeta(current);
                const busy = busyIds.has(id);
                const unit = kitchenUnitPosition(items, index);
                return (
                  <tr key={id || index}>
                    <td data-label="STT">{index + 1}</td>
                    <td data-label="Tên món">
                      <b>{kitchenItemName(item)}</b>
                      {item?.ghiChu ? <small className="kitchen-item-note">Ghi chú: {item.ghiChu}</small> : null}
                    </td>
                    <td data-label="Suất"><strong className="kitchen-quantity">{unit.total > 1 ? `${unit.position}/${unit.total}` : '1'}</strong></td>
                    <td data-label="Trạng thái"><span className={`kitchen-state-pill ${meta.tone}`}>{meta.label}</span></td>
                    {!readOnly ? (
                      <td data-label="Thao tác">
                        <div className="kitchen-row-actions">
                          {current === 'HOAN_THANH' ? (
                            <span className="kitchen-row-complete"><Check size={16} />Đã hoàn thành</span>
                          ) : (
                            <button type="button" className={current === 'CHO_BEP' ? 'start' : 'finish'} disabled={busy} onClick={() => quickUpdate(item)}>
                              {current === 'CHO_BEP' ? <Play size={16} /> : <Check size={16} />}
                              {busy ? 'Đang cập nhật...' : current === 'CHO_BEP' ? 'Bắt đầu chế biến' : 'Hoàn thành'}
                            </button>
                          )}
                          {canUndoKitchenItem(item) ? (
                            <button type="button" className="undo" disabled={busy} onClick={() => undoKitchenItem(item)}>
                              <RotateCcw size={16} />
                              {current === 'HOAN_THANH' ? 'Đưa về đang chế biến' : 'Đưa về chờ chế biến'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="kitchen-detail-bottom simplified">
          <div className="kitchen-note-box">
            <span>Ghi chú chung cho bếp</span>
            <p>{order?.ghiChu || 'Không có ghi chú chung cho đơn hàng.'}</p>
          </div>
          {!readOnly && !allDone ? (
            <div className="kitchen-detail-batch-actions">
              <span><UtensilsCrossed size={17} />Thao tác toàn bộ phiếu</span>
              {waitingItems.length ? <button type="button" className="start" disabled={isBatchBusy} onClick={() => updateItems(waitingItems, 'DANG_NAU', `Đã bắt đầu ${waitingItems.length} món`)}><Play size={16} />Bắt đầu tất cả món mới</button> : null}
              {cookingItems.length ? <button type="button" className="finish" disabled={isBatchBusy} onClick={() => updateItems(cookingItems, 'HOAN_THANH', `Đã hoàn thành ${cookingItems.length} món`)}><Check size={16} />Hoàn thành món đang nấu</button> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
