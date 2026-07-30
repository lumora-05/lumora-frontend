import axiosClient from './axiosClient';

export const foodSafetyApi = {
  traceOrderItem: (itemId) => axiosClient.get(`/food-safety/order-items/${itemId}/trace`),
  getBatchImpact: (batchId) => axiosClient.get(`/food-safety/batches/${batchId}/impact`),
  reportIncident: (batchId, data) => axiosClient.post(`/food-safety/batches/${batchId}/incidents`, data),
  getIncidents: (params = {}) => axiosClient.get('/food-safety/incidents', { params }),
  resolveIncident: (incidentId, data) => axiosClient.put(`/food-safety/incidents/${incidentId}/resolve`, data),
};
