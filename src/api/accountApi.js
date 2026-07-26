import axiosClient from './axiosClient';

export const accountApi = {
  getProfile: () => axiosClient.get('/tai-khoan/ho-so'),
  updateProfile: (data) => axiosClient.put('/tai-khoan/ho-so', data),
  updateAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/tai-khoan/ho-so/anh-dai-dien', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAvatar: () => axiosClient.delete('/tai-khoan/ho-so/anh-dai-dien'),
  changePassword: (data) => axiosClient.put('/tai-khoan/doi-mat-khau', data),
};
