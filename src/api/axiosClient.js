import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8080';

const axiosClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  const isPublicRequest =
    config.skipAuth === true ||
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/google') ||
    config.url?.includes('/auth/forgot-password') ||
    config.url?.includes('/chatbot/');

  if (
    !isPublicRequest &&
    token &&
    token !== 'undefined' &&
    token !== 'null'
  ) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && err.config?.skipAuth !== true) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    return Promise.reject(err.response?.data || err);
  }
);

export default axiosClient;