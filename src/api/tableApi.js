import axiosClient from './axiosClient';

const encodeToken = (token) => encodeURIComponent(String(token ?? '').trim());

export const tableApi = {
  getAll: () => axiosClient.get('/tables'),
  getById: (id) => axiosClient.get(`/tables/${id}`),
  create: (data) => axiosClient.post('/tables', data),
  update: (id, data) => axiosClient.put(`/tables/${id}`, data),
  remove: (id) => axiosClient.delete(`/tables/${id}`),
  generateQr: (id) => axiosClient.post(`/tables/${id}/qr`),
  transfer: (sourceId, targetId) => axiosClient.post(`/tables/${sourceId}/transfer`, { maBanDich: targetId }),
  merge: (primaryId, mergedIds) => axiosClient.post('/tables/merge', { maBanChinh: primaryId, maBanGhep: mergedIds }),
  unmerge: (groupId) => axiosClient.delete(`/tables/groups/${encodeURIComponent(String(groupId))}`),
  customerTable: (id) => axiosClient.get(`/customer/tables/${id}`),
  customerMenu: (id, params = {}) => axiosClient.get(`/customer/tables/${id}/menu`, { params }),
  customerTableByQrToken: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}`),
  customerMenuByQrToken: (qrToken, params = {}) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/menu`, { params })
};
