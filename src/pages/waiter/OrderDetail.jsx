import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Ban, Check, CheckCircle2, Clock3, ClipboardCheck, CreditCard, Loader2, UtensilsCrossed, XCircle } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { orderApi } from '../../api/orderApi';
import OrderItemCancellationModal from '../../components/order/OrderItemCancellationModal';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast, messageOf, errorMessageOf } from '../../context/ToastContext';
import {
  canStaffCancelItem,
  cancellationReasonLabel,
  isCancelledItem,
  isPendingCancellation,
} from '../../utils/orderCancellation';
import {
  READY_ITEM_STATUSES,
  callTime,
  formatClock,
  groupItemsByCall,
  itemId,
  itemName,
  itemStatus,
  orderCreatedAt,
  orderId as readOrderId,
  statusMeta,
  tableNameOfOrder,
  waitLabel,
} from '../../utils/waiterData';

const ITEM_STATUS_LABELS = {
  CHO_BEP: 'Chờ bếp',
  DANG_NAU: 'Đang chế biến',
  DANG_CHE_BIEN: 'Đang chế biến',
  YEU_CAU_HUY: 'Chờ duyệt hủy',
  DA_HUY: 'Đã hủy',
  HOAN_THANH: 'Sẵn sàng phục vụ',
  DA_HOAN_THANH: 'Sẵn sàng phục vụ',
  SAN_SANG: 'Sẵn sàng phục vụ',
  SAN_SANG_PHUC_VU: 'Sẵn sàng phục vụ',
  DA_PHUC_VU: 'Đã phục vụ',
};

const STEPS = [
  { label: 'Mới', icon: ClipboardCheck },
  { label: 'Đã xác nhận', icon: Check },
  { label: 'Sẵn sàng phục vụ', icon: UtensilsCrossed },
  { label: 'Đã phục vụ', icon: CheckCircle2 },
];

function orderStep(status) {
  if (status === 'CHO_XAC_NHAN') return 0;
  if (['DA_XAC_NHAN', 'DANG_CHUAN_BI', 'DANG_CHE_BIEN'].includes(status)) return 1;
  if (['SAN_SANG', 'SAN_SANG_PHUC_VU'].includes(status)) return 2;
  if (['DA_PHUC_VU', 'CHO_THANH_TOAN', 'SAN_SANG_THANH_TOAN', 'DA_THANH_TOAN'].includes(status)) return 3;
  return 0;
}

function itemStatusLabel(status) {
  return ITEM_STATUS_LABELS[status] || status || 'Không xác định';
}

function roleOf(user) {
  return String(user?.role || user?.tenVaiTro || user?.vaiTro?.tenVaiTro || '').replace('ROLE_', '').toUpperCase();
}

export default function OrderDetail() {
  const toast = useToast();
  const location = useLocation();
  const { orderId } = useParams();
  const readOnly = new URLSearchParams(location.search).get('readonly') === '1';
  const [order, setOrder] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [servingIds, setServingIds] = useState(new Set());
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [decisionId, setDecisionId] = useState(null);
  const { user } = useAuth();
  const isAdmin = roleOf(user) === 'ADMIN';
  const orderTopic = `/topic/customer/orders/${orderId}`;
  const event = useWebSocket(['/topic/orders', '/topic/kitchen', '/topic/admin/cancellations', orderTopic]);

  const load = useCallback(async () => {
    try {
      const response = await orderApi.getById(orderId);
      setOrder(response?.data || response);
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không tải được chi tiết đơn'));
    }
  }, [orderId, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (['/topic/orders', '/topic/kitchen', '/topic/admin/cancellations', orderTopic].includes(event?.topic)) load();
  }, [event, orderTopic, load]);

  const currentStep = useMemo(() => orderStep(order?.trangThai), [order?.trangThai]);
  const callGroups = useMemo(() => order ? groupItemsByCall(order) : [], [order]);

  async function confirmOrder() {
    try {
      setSavingOrder(true);
      const response = await orderApi.updateStatus(orderId, {
        trangThai: 'DA_XAC_NHAN',
        maNhanVien: user?.maNhanVien || user?.id || null,
      });
      toast.success(messageOf(response, 'Đã xác nhận đơn hàng'));
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Xác nhận đơn thất bại'));
    } finally {
      setSavingOrder(false);
    }
  }

  async function requestPayment() {
    if (order?.trangThai !== 'DA_PHUC_VU') {
      toast.info('Chỉ có thể gửi yêu cầu sau khi đơn đã được phục vụ');
      return;
    }

    try {
      setRequestingPayment(true);
      const response = await orderApi.waiterRequestPayment(orderId);
      toast.success(messageOf(response, 'Đã chuyển yêu cầu thanh toán đến thu ngân'));
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không gửi được yêu cầu thanh toán'));
    } finally {
      setRequestingPayment(false);
    }
  }

  async function markItemsServed(items) {
    const ready = items.filter((item) => READY_ITEM_STATUSES.has(itemStatus(item)) && !servingIds.has(String(itemId(item))));
    if (!ready.length) {
      toast.info('Không có món sẵn sàng để xác nhận');
      return;
    }

    const ids = ready.map((item) => String(itemId(item)));
    setServingIds((current) => new Set([...current, ...ids]));
    try {
      await Promise.all(ready.map((item) => orderApi.markItemServed(itemId(item))));
      toast.success(ready.length === 1 ? 'Đã xác nhận món được phục vụ' : `Đã xác nhận ${ready.length} món được phục vụ`);
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Xác nhận đã phục vụ thất bại'));
    } finally {
      setServingIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  async function submitCancellation(payload) {
    if (!cancelTarget || cancelLoading) return;
    try {
      setCancelLoading(true);
      const response = await orderApi.cancelItem(itemId(cancelTarget), payload);
      toast.success(messageOf(response, 'Đã xử lý yêu cầu hủy món'));
      setCancelTarget(null);
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể hủy món'));
    } finally {
      setCancelLoading(false);
    }
  }

  async function decideCancellation(item, action) {
    const id = itemId(item);
    if (!id || decisionId) return;
    try {
      setDecisionId(id);
      const response = action === 'approve'
        ? await orderApi.approveCancellation(id, {})
        : await orderApi.rejectCancellation(id, {});
      toast.success(messageOf(response, action === 'approve' ? 'Đã duyệt hủy món' : 'Đã từ chối yêu cầu hủy'));
      await load();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Không thể xử lý yêu cầu hủy'));
    } finally {
      setDecisionId(null);
    }
  }

  if (!order) return <section className="waiter-page"><div className="waiter-card waiter-loading">Đang tải đơn...</div></section>;

  const items = order.chiTietDonHang || [];
  const isNew = order.trangThai === 'CHO_XAC_NHAN';
  const meta = statusMeta(order.trangThai);
  const allReady = items.filter((item) => READY_ITEM_STATUSES.has(itemStatus(item)));
  const createdAt = orderCreatedAt(order);

  return (
    <section className="waiter-page waiter-service-detail-page">
      <div className="waiter-card waiter-service-card">
        <div className="waiter-service-head">
          <div>
            <Link to={readOnly ? '/waiter/history' : '/waiter/orders'} className="waiter-back-link"><ArrowLeft size={17} />Quay lại</Link>
            <h2>{readOnly ? 'Chi tiết đơn đã xử lý' : isNew ? 'Chi tiết đơn hàng' : 'Cập nhật trạng thái phục vụ'}</h2>
            <div className="waiter-order-identifiers">
              <span><small>Bàn</small><strong>{tableNameOfOrder(order)}</strong></span>
              <span><small>Mã đơn</small><strong>#{readOrderId(order)}</strong></span>
              <span><small>Thời gian gửi</small><strong>{formatClock(createdAt)}</strong></span>
              <span><small>Đã chờ</small><strong>{waitLabel(createdAt)}</strong></span>
            </div>
          </div>
          <span className={`waiter-status-badge ${meta.tone}`}>{meta.label}</span>
        </div>

        {!isNew ? (
          <div className="waiter-service-stepper">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className={`${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'complete' : ''}`}>
                  <span><Icon size={18} /></span>
                  <b>{step.label}</b>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="waiter-call-groups">
          {callGroups.map((group) => {
            const readyInGroup = group.items.filter((item) => READY_ITEM_STATUSES.has(itemStatus(item)));
            return (
              <section className="waiter-call-section" key={group.number}>
                <header className="waiter-call-section-head">
                  <div>
                    <span>{group.number === 1 ? 'Lượt gọi ban đầu' : `Lượt gọi thêm #${group.number}`}</span>
                    <small><Clock3 size={14} /> {formatClock(group.time || callTime(group.items[0], createdAt))} · {group.items.length} dòng món</small>
                  </div>
                  {!readOnly && !isNew && readyInGroup.length > 1 ? (
                    <button type="button" onClick={() => markItemsServed(readyInGroup)} disabled={readyInGroup.some((item) => servingIds.has(String(itemId(item))))}>
                      <CheckCircle2 size={17} /> Phục vụ cả lượt
                    </button>
                  ) : null}
                </header>

                <div className="waiter-service-table-wrap">
                  <table className="waiter-service-table waiter-service-action-table">
                    <thead><tr><th>STT</th><th>Món ăn</th><th>Số lượng</th><th>Ghi chú</th><th>Trạng thái</th>{!readOnly ? <th>Thao tác</th> : null}</tr></thead>
                    <tbody>
                      {group.items.map((item, index) => {
                        const status = itemStatus(item);
                        const id = String(itemId(item));
                        const canServe = READY_ITEM_STATUSES.has(status);
                        const serving = servingIds.has(id);
                        const pendingCancellation = isPendingCancellation(item);
                        const cancelled = isCancelledItem(item);
                        const canApproveAsWaiter = String(item?.trangThaiTruocHuy || '').toUpperCase() === 'CHO_BEP';
                        const deciding = String(decisionId) === id;
                        const statusTone = cancelled ? 'cancelled' : pendingCancellation ? 'cancellation' : canServe ? 'ready' : status === 'DA_PHUC_VU' ? 'served' : 'neutral';
                        return (
                          <tr key={id || index} className={cancelled ? 'waiter-cancelled-row' : ''}>
                            <td>{index + 1}</td>
                            <td>
                              <strong>{itemName(item)}</strong>
                              {(pendingCancellation || cancelled) ? (
                                <small className="waiter-cancel-reason">{item?.lyDoHuy || cancellationReasonLabel(item?.maLyDoHuy)}{item?.ghiChuHuy ? ` · ${item.ghiChuHuy}` : ''}</small>
                              ) : null}
                            </td>
                            <td>{item.soLuong || 0}</td>
                            <td>{item.ghiChu || '—'}</td>
                            <td><span className={`waiter-item-status ${statusTone}`}>{itemStatusLabel(status)}</span></td>
                            {!readOnly ? (
                              <td>
                                <div className="waiter-item-actions-inline">
                                  {pendingCancellation ? (
                                    <>
                                      {isAdmin || canApproveAsWaiter ? (
                                        <button type="button" className="waiter-item-approve" onClick={() => decideCancellation(item, 'approve')} disabled={Boolean(decisionId)}>
                                          {deciding ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Duyệt hủy
                                        </button>
                                      ) : <span className="waiter-item-managed">Chờ admin duyệt</span>}
                                      {isAdmin || canApproveAsWaiter ? (
                                        <button type="button" className="waiter-item-reject" onClick={() => decideCancellation(item, 'reject')} disabled={Boolean(decisionId)}>
                                          <XCircle size={15} /> Từ chối
                                        </button>
                                      ) : null}
                                    </>
                                  ) : canServe ? (
                                    <button type="button" className="waiter-item-serve" onClick={() => markItemsServed([item])} disabled={serving}>
                                      {serving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                                      {serving ? 'Đang cập nhật...' : 'Đã phục vụ'}
                                    </button>
                                  ) : canStaffCancelItem(item) ? (
                                    <button type="button" className="waiter-item-cancel" onClick={() => setCancelTarget(item)}>
                                      <Ban size={15} />{['DANG_NAU', 'DANG_CHE_BIEN'].includes(status) && !isAdmin ? 'Yêu cầu hủy' : 'Hủy món'}
                                    </button>
                                  ) : cancelled ? (
                                    <span className="waiter-item-managed cancelled">Đã hủy</span>
                                  ) : <span className="waiter-item-managed">{status === 'DA_PHUC_VU' ? 'Đã hoàn tất' : 'Bếp đang xử lý'}</span>}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          {!callGroups.length ? <div className="waiter-empty-cell">Đơn hàng chưa có món.</div> : null}
        </div>

        <div className="waiter-service-footer">
          <label>
            <span>Ghi chú của đơn</span>
            <textarea value={order.ghiChu || ''} readOnly placeholder="Không có ghi chú" />
          </label>
          {!readOnly && isNew ? (
            <button className="waiter-service-primary" disabled={savingOrder} onClick={confirmOrder}><Check size={18} />{savingOrder ? 'Đang xác nhận...' : 'Xác nhận đơn hàng'}</button>
          ) : !readOnly && order.trangThai === 'DA_PHUC_VU' ? (
            <button className="waiter-service-primary waiter-payment-request" disabled={requestingPayment} onClick={requestPayment}>
              {requestingPayment ? <Loader2 size={18} className="spin" /> : <CreditCard size={18} />}
              {requestingPayment ? 'Đang gửi yêu cầu...' : 'Khách yêu cầu thanh toán'}
            </button>
          ) : !readOnly && allReady.length > 1 ? (
            <button className="waiter-service-primary" disabled={allReady.some((item) => servingIds.has(String(itemId(item))))} onClick={() => markItemsServed(allReady)}>
              <CheckCircle2 size={18} />Đã phục vụ tất cả món sẵn sàng
            </button>
          ) : null}
        </div>
      </div>

      <OrderItemCancellationModal
        open={Boolean(cancelTarget)}
        item={cancelTarget}
        loading={cancelLoading}
        actor={isAdmin ? 'admin' : 'waiter'}
        onClose={() => !cancelLoading && setCancelTarget(null)}
        onSubmit={submitCancellation}
      />
    </section>
  );
}
