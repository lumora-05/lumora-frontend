import axiosClient from './axiosClient';

export const dashboardApi = {
  summary: () => axiosClient.get('/dashboard'),
  revenue7Days: () => axiosClient.get('/dashboard/revenue/last-7-days'),
  revenueChart: (params) => axiosClient.get('/dashboard/charts/revenue', { params }),
  orderStatusChart: (params) => axiosClient.get('/dashboard/charts/order-status', { params }),
  topFoods: (limit = 10, params = {}) => axiosClient.get('/dashboard/charts/top-foods', { params: { ...params, limit } }),
  recentOrders: (limit = 5) => axiosClient.get('/dashboard/recent-orders', { params: { limit } }),
  recentActivities: (limit = 5) => axiosClient.get('/dashboard/recent-activities', { params: { limit } }),
};
