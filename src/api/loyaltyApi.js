import axiosClient from './axiosClient';

export const loyaltyApi = {
  policy: () => axiosClient.get('/loyalty/policy'),
  customers: (params = {}) => axiosClient.get('/loyalty/customers', { params }),
  customerByPhone: (phone) => axiosClient.get('/loyalty/customers/by-phone', { params: { phone } }),
  customerById: (id) => axiosClient.get(`/loyalty/customers/${id}`),
  createCustomer: (data) => axiosClient.post('/loyalty/customers', data),
  updateCustomer: (id, data) => axiosClient.put(`/loyalty/customers/${id}`, data),
  adjustPoints: (id, data) => axiosClient.post(`/loyalty/customers/${id}/adjust-points`, data),
  transactions: (id, params = {}) => axiosClient.get(`/loyalty/customers/${id}/transactions`, { params }),
};
