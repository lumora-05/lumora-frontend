import axiosClient from './axiosClient';

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
  customerApply: (orderId, maCode) => axiosClient.post(`/customer/orders/${orderId}/promotion`, { maCode }),
  customerRemove: (orderId) => axiosClient.delete(`/customer/orders/${orderId}/promotion`),
};
