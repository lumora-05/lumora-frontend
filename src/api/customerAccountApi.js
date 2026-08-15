import axiosClient from './axiosClient';
import { getCustomerToken } from '../utils/customerSession';

const publicConfig = { skipAuth: true };

function customerConfig() {
  const token = getCustomerToken();
  return {
    skipAuth: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

export const customerAccountApi = {
  register: (data) => axiosClient.post('/customer/account/register', data, publicConfig),
  login: (data) => axiosClient.post('/customer/account/login', data, publicConfig),
  me: () => axiosClient.get('/customer/account/me', customerConfig()),
  orders: () => axiosClient.get('/customer/account/orders', customerConfig()),
};
