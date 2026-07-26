import axiosClient from './axiosClient';

const encodeToken = (token) => encodeURIComponent(String(token ?? '').trim());

export const serviceRequestApi = {
  customerCreate: (qrToken, data) => axiosClient.post(`/customer/qr/${encodeToken(qrToken)}/service-requests`, data),
  customerRecent: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/service-requests`),
  customerActive: (qrToken) => axiosClient.get(`/customer/qr/${encodeToken(qrToken)}/service-requests/active`),
  customerCancel: (qrToken, requestId, data = {}) => axiosClient.put(`/customer/qr/${encodeToken(qrToken)}/service-requests/${requestId}/cancel`, data),
  list: (status = 'ACTIVE') => axiosClient.get('/service-requests', { params: { status } }),
  accept: (requestId) => axiosClient.put(`/service-requests/${requestId}/accept`),
  complete: (requestId) => axiosClient.put(`/service-requests/${requestId}/complete`),
  adminCancel: (requestId, data = {}) => axiosClient.put(`/service-requests/${requestId}/cancel`, data),
};
