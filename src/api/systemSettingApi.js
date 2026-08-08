import axiosClient from './axiosClient';

export const systemSettingApi = {
  getPublic: () => axiosClient.get('/system-settings/public', { skipAuth: true }),
  get: () => axiosClient.get('/system-settings'),
  update: (data) => axiosClient.put('/system-settings', data),
  updateLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/system-settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateBanner: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post('/system-settings/banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeLogo: () => axiosClient.delete('/system-settings/logo'),
  removeBanner: () => axiosClient.delete('/system-settings/banner'),
};

export function systemSettingData(response) {
  const value = response?.data ?? response ?? {};
  return value?.data && typeof value.data === 'object' ? value.data : value;
}
