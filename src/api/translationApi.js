import axiosClient from './axiosClient';

export const translationApi = {
  getMenu: (targetLanguage = 'en') => axiosClient.get('/public-translations/menu', {
    skipAuth: true,
    params: { lang: targetLanguage },
  }),
};
