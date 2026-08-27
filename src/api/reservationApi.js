import axiosClient from './axiosClient';

const encode = (value) => encodeURIComponent(String(value ?? '').trim());

export const reservationApi = {
  publicAreas: () => axiosClient.get('/customer/reservations/areas'),
  customerCreate: (data) => axiosClient.post('/customer/reservations', data),
  customerLookup: (query) => axiosClient.get('/customer/reservations/lookup', { params: { query }, skipAuth: true }),
  customerDetail: (code, phone) => axiosClient.get(`/customer/reservations/${encode(code)}`, { params: { phone } }),
  customerUpdate: (code, phone, data) => axiosClient.put(`/customer/reservations/${encode(code)}`, data, { params: { phone } }),
  customerCancel: (code, phone, reason) => axiosClient.post(`/customer/reservations/${encode(code)}/cancel`, { reason }, { params: { phone } }),
  customerPreorderDetail: (code, phone) => axiosClient.get(`/customer/reservations/${encode(code)}/preorder`, { params: { phone }, skipAuth: true }),
  customerSavePreorder: (code, phone, data) => axiosClient.put(`/customer/reservations/${encode(code)}/preorder`, data, { params: { phone }, skipAuth: true }),
  customerCancelPreorder: (code, phone, reason) => axiosClient.post(`/customer/reservations/${encode(code)}/preorder/cancel`, { reason }, { params: { phone }, skipAuth: true }),

  list: (params = {}) => axiosClient.get('/reservations', { params }),
  detail: (id) => axiosClient.get(`/reservations/${id}`),
  availableTables: (params = {}) => axiosClient.get('/reservations/availability/tables', { params }),
  confirm: (id, data) => axiosClient.post(`/reservations/${id}/confirm`, data),
  reject: (id, reason) => axiosClient.post(`/reservations/${id}/reject`, { reason }),
  checkIn: (id) => axiosClient.post(`/reservations/${id}/check-in`),
  assignTable: (id, maBan) => axiosClient.post(`/reservations/${id}/assign-table`, { maBan }),
  noShow: (id) => axiosClient.post(`/reservations/${id}/no-show`),
  staffCancel: (id, reason) => axiosClient.post(`/reservations/${id}/cancel`, { reason }),
  preorderDetail: (id) => axiosClient.get(`/reservations/${id}/preorder`),
  preorderConfirm: (id, data) => axiosClient.post(`/reservations/${id}/preorder/confirm`, data),
  preorderReject: (id, reason) => axiosClient.post(`/reservations/${id}/preorder/reject`, { reason }),
  preorderSendToKitchen: (id) => axiosClient.post(`/reservations/${id}/preorder/send-to-kitchen`),
};
