import axiosClient from './axiosClient';

export const uploadApi = {
  foodImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/uploads/foods', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};
