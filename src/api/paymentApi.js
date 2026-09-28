import axiosClient from './axiosClient';

export const paymentApi = {
  create: (data) => axiosClient.post('/payments', data),
  byOrder: (id) => axiosClient.get(`/payments/order/${id}`),
  loyaltyPreview: (id, params = {}) => axiosClient.get(`/payments/loyalty-preview/order/${id}`, { params }),
  vietQrByOrder: (id, params = {}) => axiosClient.get(`/payments/vietqr/order/${id}`, { params }),
  mixedCash: (data) => axiosClient.post('/payments/mixed/cash', data),
  mixedStatusByOrder: (id, params = {}) => axiosClient.get(`/payments/mixed/order/${id}`, { params }),
  paymentSlipByOrder: (id) => axiosClient.get(`/payments/payment-slip/order/${id}`),
  revenue: (params) => axiosClient.get('/payments/revenue', { params }),
};
