import axiosClient from './axiosClient';

export const adminNotificationApi = {
  getPage: (params = {}) => axiosClient.get('/admin/notifications', { params }),
  getUnreadCount: () => axiosClient.get('/admin/notifications/unread-count'),
  markAsRead: (id) => axiosClient.patch(`/admin/notifications/${id}/read`),
  markAllAsRead: () => axiosClient.patch('/admin/notifications/read-all'),
  syncLowStock: () => axiosClient.post('/admin/notifications/sync-low-stock'),
};
