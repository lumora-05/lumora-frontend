import axiosClient from './axiosClient';
export const menuApi = {
  getActive: (config = {}) => axiosClient.get('/menu', config),
  getTopSelling: (limit = 4, config = {}) => axiosClient.get('/menu/top-selling', { ...config, params: { ...(config.params || {}), limit } }),
  getAll: () => axiosClient.get('/menu/all'),
  getPage: (params = {}) => axiosClient.get('/menu/page', { params }),
  getById: (id) => axiosClient.get(`/menu/${id}`),
  byCategory: (id) => axiosClient.get(`/menu/category/${id}`),
  create: (data) => axiosClient.post('/menu', data),
  update: (id, data) => axiosClient.put(`/menu/${id}`, data),
  getRecipe: (id) => axiosClient.get(`/menu/${id}/recipe`),
  updateRecipe: (id, data) => axiosClient.put(`/menu/${id}/recipe`, data),
  remove: (id) => axiosClient.delete(`/menu/${id}`)
};
export const categoryApi = {
  getActive: () => axiosClient.get('/categories/active'),
  getAll: () => axiosClient.get('/categories'),
  getPage: (params = {}) => axiosClient.get('/categories/page', { params }),
  create: (data) => axiosClient.post('/categories', data),
  update: (id, data) => axiosClient.put(`/categories/${id}`, data),
  remove: (id) => axiosClient.delete(`/categories/${id}`)
};
