import axiosClient from './axiosClient';

export const paymentApi = {
  create: (data) => axiosClient.post('/payments', data),
  byOrder: (id) => axiosClient.get(`/payments/order/${id}`),
  vietQrByOrder: (id) => axiosClient.get(`/payments/vietqr/order/${id}`),
  paymentSlipByOrder: (id) => axiosClient.get(`/payments/payment-slip/order/${id}`),
  revenue: (params) => axiosClient.get('/payments/revenue', { params }),
};
