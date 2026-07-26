import axiosClient from './axiosClient';

const CHATBOT_REQUEST_CONFIG = {
  skipAuth: true,
  timeout: 25000,
};

export const chatbotApi = {
  sendMessage: (payload) => axiosClient.post('/chatbot/messages', payload, CHATBOT_REQUEST_CONFIG),
  getQuickReplies: () => axiosClient.get('/chatbot/quick-replies', CHATBOT_REQUEST_CONFIG),
};
