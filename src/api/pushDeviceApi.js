import axiosClient from './axiosClient';

export const pushDeviceApi = {
  register: ({ installationId, channel, userAgent }) => axiosClient.post('/push-devices', {
    installationId,
    channel,
    userAgent,
  }),
  unregister: ({ installationId, channel }) => axiosClient.delete('/push-devices', {
    params: { installationId, channel },
  }),
};
