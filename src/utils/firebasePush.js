import { pushDeviceApi } from '../api/pushDeviceApi';

const FIREBASE_VERSION = '12.16.0';
const APP_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const MESSAGING_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging.js`;
const CHANNELS_KEY = 'lumora_firebase_push_channels';
const LAST_FID_KEY = 'lumora_firebase_installation_id';

let modulesPromise = null;
let messagingInstance = null;
let listenersReady = false;

function hasWindow() {
  return typeof window !== 'undefined';
}

function envValue(name) {
  return String(import.meta.env[name] || '').trim();
}

export function firebaseWebConfig() {
  return {
    apiKey: envValue('VITE_FIREBASE_API_KEY'),
    authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: envValue('VITE_FIREBASE_PROJECT_ID'),
    messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: envValue('VITE_FIREBASE_APP_ID'),
  };
}

export function isFirebasePushConfigured() {
  if (!hasWindow()) return false;
  const explicitlyDisabled = envValue('VITE_FIREBASE_PUSH_ENABLED').toLowerCase() === 'false';
  if (explicitlyDisabled) return false;
  const config = firebaseWebConfig();
  return Boolean(
    config.apiKey
      && config.projectId
      && config.messagingSenderId
      && config.appId
      && envValue('VITE_FIREBASE_VAPID_KEY')
  );
}

function normalizeChannel(channel) {
  const value = String(channel || '').trim().toUpperCase();
  return ['KITCHEN', 'WAITER'].includes(value) ? value : '';
}

function storedChannels() {
  if (!hasWindow()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHANNELS_KEY) || '[]');
    return Array.isArray(parsed)
      ? [...new Set(parsed.map(normalizeChannel).filter(Boolean))]
      : [];
  } catch {
    return [];
  }
}

function saveChannels(channels) {
  if (!hasWindow()) return;
  window.localStorage.setItem(CHANNELS_KEY, JSON.stringify([...new Set(channels)]));
}

function addChannel(channel) {
  const normalized = normalizeChannel(channel);
  if (!normalized) return;
  saveChannels([...storedChannels(), normalized]);
}

function removeChannel(channel) {
  const normalized = normalizeChannel(channel);
  if (!normalized) return;
  saveChannels(storedChannels().filter((item) => item !== normalized));
}

async function loadFirebaseModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import(/* @vite-ignore */ APP_CDN),
      import(/* @vite-ignore */ MESSAGING_CDN),
    ]).then(([appModule, messagingModule]) => ({ appModule, messagingModule }));
  }
  return modulesPromise;
}

function serviceWorkerUrl() {
  const config = firebaseWebConfig();
  const params = new URLSearchParams({
    firebase: '1',
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    firebaseVersion: FIREBASE_VERSION,
  });
  return `/staff-alert-sw.js?${params.toString()}`;
}

export async function registerStaffServiceWorker() {
  if (!hasWindow() || !('serviceWorker' in navigator)) return null;
  const url = isFirebasePushConfigured() ? serviceWorkerUrl() : '/staff-alert-sw.js';
  try {
    return await navigator.serviceWorker.register(url, { scope: '/' });
  } catch {
    return null;
  }
}

async function syncFidToBackend(fid) {
  if (!fid) return;
  window.localStorage.setItem(LAST_FID_KEY, fid);
  const userAgent = navigator.userAgent || '';
  await Promise.allSettled(storedChannels().map((channel) => pushDeviceApi.register({
    installationId: fid,
    channel,
    userAgent,
  })));
}

async function removeFidFromBackend(fid, channels = storedChannels()) {
  if (!fid) return;
  await Promise.allSettled(channels.map((channel) => pushDeviceApi.unregister({
    installationId: fid,
    channel,
  })));
}

async function messagingContext() {
  if (!isFirebasePushConfigured()) return null;
  const { appModule, messagingModule } = await loadFirebaseModules();
  const supported = await messagingModule.isSupported();
  if (!supported) return null;

  const config = firebaseWebConfig();
  const app = appModule.getApps().length > 0
    ? appModule.getApp()
    : appModule.initializeApp(config);
  if (!messagingInstance) messagingInstance = messagingModule.getMessaging(app);
  return { messaging: messagingInstance, messagingModule };
}

function ensureRegistrationListeners(messaging, messagingModule) {
  if (listenersReady) return;
  listenersReady = true;

  messagingModule.onRegistered(messaging, (fid) => {
    void syncFidToBackend(fid);
  });

  messagingModule.onUnregistered(messaging, (fid) => {
    void removeFidFromBackend(fid).finally(() => {
      if (window.localStorage.getItem(LAST_FID_KEY) === fid) {
        window.localStorage.removeItem(LAST_FID_KEY);
      }
    });
  });
}

export async function enableFirebasePush(channel) {
  const normalized = normalizeChannel(channel);
  if (!normalized || !isFirebasePushConfigured() || Notification.permission !== 'granted') {
    return { configured: isFirebasePushConfigured(), registered: false };
  }

  addChannel(normalized);
  const context = await messagingContext();
  if (!context) return { configured: true, registered: false };

  const serviceWorkerRegistration = await registerStaffServiceWorker();
  if (!serviceWorkerRegistration) return { configured: true, registered: false };

  const { messaging, messagingModule } = context;
  ensureRegistrationListeners(messaging, messagingModule);
  await messagingModule.register(messaging, {
    vapidKey: envValue('VITE_FIREBASE_VAPID_KEY'),
    serviceWorkerRegistration,
  });

  // onRegistered luôn được gọi sau manual register; đồng thời thử đồng bộ FID đã biết
  // để nút bật cảnh báo không phụ thuộc vào timing của callback.
  const knownFid = window.localStorage.getItem(LAST_FID_KEY);
  if (knownFid) await syncFidToBackend(knownFid);
  return { configured: true, registered: true };
}

export async function prepareFirebasePush(channel) {
  if (!isFirebasePushConfigured() || Notification.permission !== 'granted') return;
  const normalized = normalizeChannel(channel);
  if (!normalized) return;
  addChannel(normalized);
  try {
    await enableFirebasePush(normalized);
  } catch {
    // Push là kênh bổ trợ; không làm hỏng giao diện nếu Firebase tạm lỗi.
  }
}

export async function disableFirebasePush(channel) {
  const normalized = normalizeChannel(channel);
  if (!normalized) return;
  const fid = hasWindow() ? window.localStorage.getItem(LAST_FID_KEY) : null;
  if (fid) {
    try {
      await pushDeviceApi.unregister({ installationId: fid, channel: normalized });
    } catch {
      // Không chặn thao tác tắt cảnh báo ở giao diện.
    }
  }
  removeChannel(normalized);
}
