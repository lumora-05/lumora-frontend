import axiosClient from './axiosClient';

const encodeToken = (token) => encodeURIComponent(String(token ?? '').trim());

let waiterActiveRequest = null;
let kitchenActiveRequest = null;

function getWaiterActive() {
  if (waiterActiveRequest) return waiterActiveRequest;
  const request = axiosClient.get('/orders/waiter/active');
  const sharedRequest = request.finally(() => {
    if (waiterActiveRequest === sharedRequest) waiterActiveRequest = null;
  });
  waiterActiveRequest = sharedRequest;
  return sharedRequest;
}

function getKitchenActive() {
  if (kitchenActiveRequest) return kitchenActiveRequest;
  const request = axiosClient.get('/orders/kitchen/active');
  const sharedRequest = request.finally(() => {
    if (kitchenActiveRequest === sharedRequest) kitchenActiveRequest = null;
  });
  kitchenActiveRequest = sharedRequest;
  return sharedRequest;
}

export const orderApi = {
  create: (data) => axiosClient.post('/orders', data),
  customerCreate: (data) => axiosClient.post('/customer/orders', data),
  customerTracking: (qrToken, id) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/orders/${id}`),
  customerCurrentOrder: (tableId) => axiosClient.get(`/customer/tables/${tableId}/orders/current`),
  customerOpenOrders: (tableId) => axiosClient.get(`/customer/tables/${tableId}/orders`),
  customerCurrentOrderByQrToken: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/orders/current`),
  customerOpenOrdersByQrToken: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/orders`),
  customerRequestPayment: (qrToken, id) => axiosClient.post(`/customer/qr/${encodeToken(qrToken)}/orders/${id}/request-payment`),
  waiterRequestPayment: (id) => axiosClient.post(`/orders/${id}/request-payment`),
  getAll: () => axiosClient.get('/orders'),
  getPaymentRequests: () => axiosClient.get('/orders/payment-requests'),
  getPaymentRequestCount: () => axiosClient.get('/orders/payment-requests/count'),
  getWaiterActive,
  getWaiterAttentionCount: () => axiosClient.get('/orders/waiter/attention-count'),
  getKitchenActive,
  getKitchenAttentionCount: () => axiosClient.get('/orders/kitchen/attention-count'),
  getPage: (params = {}) => axiosClient.get('/orders/page', { params }),
  getById: (id) => axiosClient.get(`/orders/${id}`),
  byStatus: (status) => axiosClient.get(`/orders/status/${status}`),
  kitchenItems: (status = 'CHO_BEP') => axiosClient.get(`/orders/kitchen/items/${status}`),
  updateStatus: (id, data) => axiosClient.put(`/orders/${id}/status`, data),
  updateItemStatus: (itemId, data) => axiosClient.put(`/orders/items/${itemId}/status`, data),
  markItemServed: (itemId) => axiosClient.put(`/orders/items/${itemId}/served`),
  cancelItem: (itemId, data) => axiosClient.post(`/orders/items/${itemId}/cancel`, data),
  customerRequestItemCancellation: (qrToken, orderId, itemId, data) => axiosClient.post(`/customer/qr/${encodeToken(qrToken)}/orders/${orderId}/items/${itemId}/cancel-request`, data),
  cancellationRequests: (status = 'CHO_DUYET') => axiosClient.get('/orders/items/cancel-requests', { params: { status } }),
  approveCancellation: (itemId, data = {}) => axiosClient.put(`/orders/items/${itemId}/cancel-request/approve`, data),
  rejectCancellation: (itemId, data = {}) => axiosClient.put(`/orders/items/${itemId}/cancel-request/reject`, data)
};
