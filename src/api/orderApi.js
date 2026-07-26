import axiosClient from './axiosClient';

const encodeToken = (token) => encodeURIComponent(String(token ?? '').trim());

export const orderApi = {
  create: (data) => axiosClient.post('/orders', data),
  customerCreate: (data) => axiosClient.post('/customer/orders', data),
  customerTracking: (id) => axiosClient.get(`/customer/orders/${id}`),
  customerCurrentOrder: (tableId) => axiosClient.get(`/customer/tables/${tableId}/orders/current`),
  customerOpenOrders: (tableId) => axiosClient.get(`/customer/tables/${tableId}/orders`),
  customerCurrentOrderByQrToken: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/orders/current`),
  customerOpenOrdersByQrToken: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/orders`),
  customerRequestPayment: (id) => axiosClient.post(`/customer/orders/${id}/request-payment`),
  waiterRequestPayment: (id) => axiosClient.post(`/orders/${id}/request-payment`),
  getAll: () => axiosClient.get('/orders'),
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
