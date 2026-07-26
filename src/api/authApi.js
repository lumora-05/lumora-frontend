import axiosClient from './axiosClient';

export const authApi = {
  login: (data) => axiosClient.post('/auth/login', data),
  googleLogin: (credential) => axiosClient.post('/auth/google', { credential }),
  sendPasswordResetCode: (data) => axiosClient.post('/auth/forgot-password/send-code', data),
  verifyPasswordResetCode: (data) => axiosClient.post('/auth/forgot-password/verify-code', data),
  resetPasswordWithCode: (data) => axiosClient.post('/auth/forgot-password/reset', data)
};
