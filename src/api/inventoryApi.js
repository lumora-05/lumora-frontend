import axiosClient from './axiosClient';

export const inventoryApi = {
  getAll: () => axiosClient.get('/ingredients'),
  getActive: () => axiosClient.get('/ingredients/active'),
  getPage: (params = {}) => axiosClient.get('/ingredients/page', { params }),
  getLowStock: () => axiosClient.get('/ingredients/low-stock'),
  getStatistics: () => axiosClient.get('/ingredients/statistics'),
  getById: (id) => axiosClient.get(`/ingredients/${id}`),
  create: (data) => axiosClient.post('/ingredients', data),
  update: (id, data) => axiosClient.put(`/ingredients/${id}`, data),
  adjustStock: (id, data) => axiosClient.patch(`/ingredients/${id}/stock`, data),
  remove: (id) => axiosClient.delete(`/ingredients/${id}`),
  getTransactions: (params = {}) => axiosClient.get('/ingredients/transactions/page', { params }),
  getWasteReasons: () => axiosClient.get('/ingredients/waste/reasons'),
  getWasteStatistics: (params = {}) => axiosClient.get('/ingredients/waste/statistics', { params }),
  recordWaste: (ingredientId, data, params = {}) => axiosClient.post(`/ingredients/${ingredientId}/waste`, data, { params }),
  disposeBatch: (batchId, data, params = {}) => axiosClient.post(`/ingredients/batches/${batchId}/dispose`, data, { params }),

  getBatchPage: (params = {}) => axiosClient.get('/ingredients/batches/page', { params }),
  getBatchStatistics: (params = {}) => axiosClient.get('/ingredients/batches/statistics', { params }),
  getBatchById: (batchId, params = {}) => axiosClient.get(`/ingredients/batches/${batchId}`, { params }),
  getBatchesByIngredient: (ingredientId, params = {}) => axiosClient.get(`/ingredients/${ingredientId}/batches`, { params }),
  createBatch: (ingredientId, data, params = {}) => axiosClient.post(`/ingredients/${ingredientId}/batches`, data, { params }),
  updateBatch: (batchId, data, params = {}) => axiosClient.put(`/ingredients/batches/${batchId}`, data, { params }),
  removeBatch: (batchId, params = {}) => axiosClient.delete(`/ingredients/batches/${batchId}`, { params }),
};
