self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});

const query = new URL(self.location.href).searchParams;
const firebaseEnabled = query.get('firebase') === '1';

if (firebaseEnabled) {
  const version = query.get('firebaseVersion') || '12.16.0';
  try {
    importScripts(`https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js`);
    importScripts(`https://www.gstatic.com/firebasejs/${version}/firebase-messaging-compat.js`);

    const firebaseConfig = {
      apiKey: query.get('apiKey') || '',
      authDomain: query.get('authDomain') || '',
      projectId: query.get('projectId') || '',
      messagingSenderId: query.get('messagingSenderId') || '',
      appId: query.get('appId') || '',
    };

    self.firebase.initializeApp(firebaseConfig);
    const messaging = self.firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const data = payload?.data || {};
      const title = data.title || 'LUMORA';
      const urgent = String(data.urgent || '').toLowerCase() === 'true';
      const options = {
        body: data.body || 'Có công việc mới đang chờ xử lý.',
        tag: data.tag || 'lumora-staff-push',
        renotify: true,
        requireInteraction: urgent,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: data.url || '/' },
        vibrate: urgent ? [350, 120, 350, 120, 500] : [250, 120, 300],
      };
      return self.registration.showNotification(title, options);
    });
  } catch (error) {
    // WebSocket/cảnh báo tại chỗ vẫn hoạt động nếu CDN Firebase tạm thời lỗi.
    console.error('Không thể khởi tạo Firebase Messaging service worker', error);
  }
}
