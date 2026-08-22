import { useEffect, useRef } from 'react';
import { orderApi } from '../api/orderApi';
import { serviceRequestApi } from '../api/serviceRequestApi';
import { triggerStaffAlert } from '../utils/staffAlerts';
import {
  canonicalKitchenStatus,
  flattenKitchenOrders,
  kitchenCallNumber,
  kitchenOrderId,
  unwrapList as unwrapKitchenList,
} from '../utils/kitchenData';
import {
  isActiveOrder,
  orderGroup,
  pendingReadyCount,
  tableNameOfOrder,
  unwrapList as unwrapWaiterList,
} from '../utils/waiterData';
import {
  serviceRequestId,
  serviceRequestStatus,
  serviceRequestTableLabel,
  serviceRequestTypeLabel,
  unwrapServiceRequestList,
} from '../utils/serviceRequests';

const REMINDER_INTERVAL_MS = 60_000;
const POLL_INTERVAL_MS = 30_000;

function eventType(event) {
  return String(event?.body?.type || '').toUpperCase();
}

function eventData(event) {
  return event?.body?.data || event?.body || {};
}

function kitchenWaitingGroups(items) {
  const keys = new Set();
  items
    .filter((item) => canonicalKitchenStatus(item) === 'CHO_BEP')
    .forEach((item) => keys.add(`${kitchenOrderId(item)}-${kitchenCallNumber(item)}`));
  return keys.size;
}

export function useStaffOperationalAlerts(role, event) {
  const lastReminderAt = useRef(0);
  const checking = useRef(false);
  const roleKey = String(role || '').toUpperCase();

  useEffect(() => {
    const type = eventType(event);
    if (!type) return;
    const data = eventData(event);

    if (roleKey === 'KITCHEN' && ['NEW_KITCHEN_ORDER', 'NEW_KITCHEN_ITEMS'].includes(type)) {
      lastReminderAt.current = Date.now();
      triggerStaffAlert({
        title: type === 'NEW_KITCHEN_ITEMS' ? 'Bếp có món gọi thêm' : 'Bếp có đơn mới',
        body: type === 'NEW_KITCHEN_ITEMS'
          ? 'Có món mới đang chờ bếp bắt đầu chế biến.'
          : 'Có đơn hàng mới đang chờ bếp tiếp nhận.',
        tag: type === 'NEW_KITCHEN_ITEMS' ? 'kitchen-new-items' : 'kitchen-new-order',
        url: '/kitchen/orders',
        urgent: true,
      });
      return;
    }

    if (roleKey === 'CASHIER' && ['DELIVERY_ORDER_WAITING_PAYMENT', 'DELIVERY_ORDER_PENDING_CONFIRMATION', 'DELIVERY_PAYMENT_CONFIRMED'].includes(type)) {
      const id = data?.maDonHang ?? data?.id;
      const waitingPayment = type === 'DELIVERY_ORDER_WAITING_PAYMENT';
      lastReminderAt.current = Date.now();
      triggerStaffAlert({
        title: waitingPayment ? 'Có đơn online chờ thanh toán' : 'Có đơn online chờ xác nhận',
        body: waitingPayment
          ? `Đơn ${id ? `#DH${id}` : 'mới'} đang chờ khách hoàn tất VietQR.`
          : `Đơn ${id ? `#DH${id}` : 'mới'} đang chờ nhà hàng kiểm tra và xác nhận trước khi xuống bếp.`,
        tag: `cashier-delivery-${id || 'latest'}-${type}`,
        url: '/cashier/delivery-orders',
      });
      return;
    }

    if (roleKey !== 'WAITER') return;

    if (type === 'NEW_ORDER' || type === 'ORDER_ITEMS_ADDED') {
      const id = data?.maDonHang ?? data?.id;
      const table = data?.tenBan || (data?.maBan ? `Bàn ${data.maBan}` : 'Một bàn');
      triggerStaffAlert({
        title: type === 'ORDER_ITEMS_ADDED' ? 'Khách vừa gọi thêm món' : 'Có đơn hàng mới',
        body: `${table}${id ? ` · Đơn #${id}` : ''}. Món đã được chuyển xuống bếp.`,
        tag: `waiter-order-${id || 'latest'}-${type}`,
        url: id ? `/waiter/orders/${id}` : '/waiter/orders',
      });
      return;
    }

    if (type === 'SERVICE_REQUEST_CREATED') {
      const requestedId = data?.maYeuCau ?? data?.id;
      void serviceRequestApi.list('ACTIVE').then((response) => {
        const visibleRequests = unwrapServiceRequestList(response);
        const request = visibleRequests.find((item) => (
          serviceRequestStatus(item) === 'MOI'
          && (!requestedId || String(serviceRequestId(item)) === String(requestedId))
        ));
        if (!request) return;
        lastReminderAt.current = Date.now();
        triggerStaffAlert({
          title: 'Có yêu cầu phục vụ mới',
          body: `${serviceRequestTableLabel(request)} · ${serviceRequestTypeLabel(request)} đang chờ tiếp nhận.`,
          tag: `waiter-service-request-${serviceRequestId(request) || 'latest'}`,
          url: '/waiter/requests',
          urgent: true,
        });
      }).catch(() => {});
      return;
    }

    if (type === 'KITCHEN_ITEM_STATUS_CHANGED') {
      const status = String(data?.trangThaiMon || data?.trangThai || '').toUpperCase();
      if (['HOAN_THANH', 'DA_HOAN_THANH', 'SAN_SANG', 'SAN_SANG_PHUC_VU'].includes(status)) {
        lastReminderAt.current = Date.now();
        triggerStaffAlert({
          title: 'Món đã sẵn sàng phục vụ',
          body: `${data?.tenMonAn || 'Có món'} đã hoàn thành, cần mang ra bàn.`,
          tag: `waiter-ready-item-${data?.maChiTiet || 'latest'}`,
          url: data?.maDonHang ? `/waiter/orders/${data.maDonHang}` : '/waiter/orders',
          urgent: true,
        });
      }
    }
  }, [event, roleKey]);

  useEffect(() => {
    if (!['KITCHEN', 'WAITER'].includes(roleKey)) return undefined;
    let cancelled = false;

    async function checkPending({ reminder = false } = {}) {
      if (checking.current || cancelled) return;
      checking.current = true;
      try {
        if (roleKey === 'KITCHEN') {
          const response = await orderApi.getAll();
          if (cancelled) return;
          const pending = kitchenWaitingGroups(flattenKitchenOrders(unwrapKitchenList(response)));
          if (pending > 0 && reminder && Date.now() - lastReminderAt.current >= REMINDER_INTERVAL_MS) {
            lastReminderAt.current = Date.now();
            triggerStaffAlert({
              title: 'Bếp còn phiếu chưa tiếp nhận',
              body: `${pending} phiếu vẫn đang chờ bắt đầu chế biến.`,
              tag: 'kitchen-pending-reminder',
              url: '/kitchen/orders',
              urgent: true,
            });
          }
          return;
        }

        const [orderResponse, serviceResponse] = await Promise.all([
          orderApi.getAll(),
          serviceRequestApi.list('ACTIVE'),
        ]);
        if (cancelled) return;
        const orders = unwrapWaiterList(orderResponse);
        const requests = unwrapServiceRequestList(serviceResponse);
        const newRequests = requests.filter((item) => serviceRequestStatus(item) === 'MOI');
        const readyOrders = orders
          .filter((order) => isActiveOrder(order) && ['READY', 'PREPARING'].includes(orderGroup(order)))
          .map((order) => ({ order, readyCount: pendingReadyCount(order) }))
          .filter((item) => item.readyCount > 0);

        if (!reminder || Date.now() - lastReminderAt.current < REMINDER_INTERVAL_MS) return;

        if (newRequests.length > 0) {
          lastReminderAt.current = Date.now();
          triggerStaffAlert({
            title: 'Có yêu cầu tại bàn chưa tiếp nhận',
            body: `${newRequests.length} yêu cầu vẫn đang chờ nhân viên phục vụ tiếp nhận.`,
            tag: 'waiter-service-request-reminder',
            url: '/waiter/requests',
            urgent: true,
          });
          return;
        }

        if (readyOrders.length > 0) {
          lastReminderAt.current = Date.now();
          const first = readyOrders[0];
          const totalReady = readyOrders.reduce((sum, item) => sum + item.readyCount, 0);
          const body = readyOrders.length === 1
            ? `${first.readyCount} phần đã sẵn sàng · ${tableNameOfOrder(first.order)}.`
            : `${totalReady} phần đã sẵn sàng tại ${readyOrders.length} bàn.`;
          triggerStaffAlert({
            title: 'Còn món đang chờ phục vụ',
            body,
            tag: 'waiter-ready-reminder',
            url: '/waiter/orders',
            urgent: true,
          });
        }
      } catch {
        // Reminder is supplementary and must never interrupt normal page operation.
      } finally {
        checking.current = false;
      }
    }

    const firstTimer = window.setTimeout(() => void checkPending({ reminder: true }), REMINDER_INTERVAL_MS);
    const pollTimer = window.setInterval(() => void checkPending({ reminder: true }), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(firstTimer);
      window.clearInterval(pollTimer);
    };
  }, [roleKey]);
}
