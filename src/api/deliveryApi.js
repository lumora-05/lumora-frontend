import axiosClient from './axiosClient';

const publicConfig = { skipAuth: true };

export const deliveryApi = {
  create: (data) => axiosClient.post('/customer/delivery/orders', data, publicConfig),
  track: (trackingToken) => axiosClient.get(
    `/customer/delivery/orders/${encodeURIComponent(trackingToken)}`,
    publicConfig,
  ),
  createVietQr: (trackingToken) => axiosClient.get(
    `/customer/delivery/orders/${encodeURIComponent(trackingToken)}/vietqr`,
    publicConfig,
  ),
  cancelByCustomer: (trackingToken, data) => axiosClient.post(
    `/customer/delivery/orders/${encodeURIComponent(trackingToken)}/cancel`,
    data,
    publicConfig,
  ),

  list: (deliveryStatus = 'ALL') => axiosClient.get('/delivery-orders', {
    params: deliveryStatus && deliveryStatus !== 'ALL' ? { deliveryStatus } : {},
  }),
  detail: (orderId) => axiosClient.get(`/delivery-orders/${orderId}`),
  confirmVietQr: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/confirm-vietqr`, data),
  confirmOrder: (orderId) => axiosClient.post(`/delivery-orders/${orderId}/confirm`),
  rejectOrder: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/reject`, data),
  handover: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/handover`, data),
  complete: (orderId) => axiosClient.post(`/delivery-orders/${orderId}/complete`),
  fail: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/fail`, data),
  retry: (orderId) => axiosClient.post(`/delivery-orders/${orderId}/retry`),
};
