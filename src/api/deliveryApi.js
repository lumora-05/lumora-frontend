import axiosClient from './axiosClient';

const publicConfig = { skipAuth: true };

export const deliveryApi = {
  addressSuggestions: ({ query, tinhThanh, phuongXa }) => axiosClient.get(
    '/customer/delivery/address-suggestions',
    {
      ...publicConfig,
      params: {
        query,
        tinhThanh,
        ...(phuongXa ? { phuongXa } : {}),
      },
    },
  ),
  quote: (data) => axiosClient.post('/customer/delivery/quote', data, publicConfig),
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
  confirm: (orderId) => axiosClient.post(`/delivery-orders/${orderId}/confirm`),
  reject: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/reject`, data),
  confirmRefund: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/confirm-refund`, data),
  handover: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/handover`, data),
  complete: (orderId) => axiosClient.post(`/delivery-orders/${orderId}/complete`),
  fail: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/fail`, data),
  simulateProviderResult: (orderId, data) => axiosClient.post(`/delivery-orders/${orderId}/simulate-provider-result`, data),
  retry: (orderId) => axiosClient.post(`/delivery-orders/${orderId}/retry`),
};
