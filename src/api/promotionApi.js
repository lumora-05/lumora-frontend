import axiosClient from './axiosClient';

const encodeToken = (token) => encodeURIComponent(String(token ?? '').trim());

export const promotionApi = {
  getAll: () => axiosClient.get('/promotions'),
  getPage: (params = {}) => axiosClient.get('/promotions/page', { params }),
  getActive: () => axiosClient.get('/promotions/active'),
  create: (data) => axiosClient.post('/promotions', data),
  update: (id, data) => axiosClient.put(`/promotions/${id}`, data),
  remove: (id) => axiosClient.delete(`/promotions/${id}`),

  // Admin / phục vụ / thu ngân áp dụng hoặc gỡ mã cho một đơn.
  apply: (data) => axiosClient.post('/promotions/apply', data),
  removeFromOrder: (orderId) => axiosClient.delete(`/promotions/orders/${orderId}`),

  // Luồng công khai dành cho khách tại bàn.
  customerApply: (qrToken, orderId, maCode) => axiosClient.post(`/customer/qr/${encodeToken(qrToken)}/orders/${orderId}/promotion`, { maCode }),
  customerRemove: (qrToken, orderId) => axiosClient.delete(`/customer/qr/${encodeToken(qrToken)}/orders/${orderId}/promotion`),
};
