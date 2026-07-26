import axiosClient from './axiosClient';
export const employeeApi = {
  getAll: () => axiosClient.get('/employees'),
  getPage: (params = {}) => axiosClient.get('/employees/page', { params }),
  getById: (id) => axiosClient.get(`/employees/${id}`),
  create: (data) => axiosClient.post('/employees', data),
  update: (id, data) => axiosClient.put(`/employees/${id}`, data),
  remove: (id) => axiosClient.delete(`/employees/${id}`)
};
