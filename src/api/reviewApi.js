import axiosClient from './axiosClient';

export const reviewApi = {
  create: (data) => axiosClient.post('/customer/reviews', data),
  publicPage: (params = {}) => axiosClient.get('/customer/reviews/page', { params }),
  publicStatistics: () => axiosClient.get('/customer/reviews/statistics'),

  adminPage: (params = {}) => axiosClient.get('/reviews/page', { params }),
  adminDetail: (id) => axiosClient.get(`/reviews/${id}`),
  updateVisibility: (id, visible) => axiosClient.put(`/reviews/${id}/visibility`, { visible }),
  adminStatistics: () => axiosClient.get('/reviews/statistics/summary'),
};
