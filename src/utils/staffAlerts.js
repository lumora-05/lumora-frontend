const ENABLED_KEY = 'lumora_staff_operational_alerts_enabled';
const SW_PATH = '/staff-alert-sw.js';

let audioContext = null;

function hasWindow() {
  return typeof window !== 'undefined';
}

export function isStaffAlertsEnabled() {
  if (!hasWindow()) return false;
  return window.localStorage.getItem(ENABLED_KEY) === '1';
}

export function staffNotificationPermission() {
  if (!hasWindow() || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

async function registerAlertServiceWorker() {
  if (!hasWindow() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  } catch {
    return null;
  }
}

function ensureAudioContext() {
  if (!hasWindow()) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

async function unlockAudio() {
  const context = ensureAudioContext();
  if (!context) return;
  try {
    if (context.state === 'suspended') await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.01);
  } catch {
    // Audio is only a supplementary channel.
  }
}

export async function prepareStaffAlerts() {
  if (!isStaffAlertsEnabled()) return;
  await unlockAudio();
  await registerAlertServiceWorker();
}

export async function enableStaffAlerts() {
  if (!hasWindow()) return { enabled: false, permission: 'unsupported' };
  window.localStorage.setItem(ENABLED_KEY, '1');
  await unlockAudio();
  await registerAlertServiceWorker();

  let permission = staffNotificationPermission();
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = staffNotificationPermission();
    }
  }

  return { enabled: true, permission };
}

export function disableStaffAlerts() {
  if (!hasWindow()) return;
  window.localStorage.setItem(ENABLED_KEY, '0');
}

function playTone(urgent = false) {
  const context = ensureAudioContext();
  if (!context || context.state !== 'running') return;

  const tones = urgent
    ? [{ frequency: 880, delay: 0, duration: 0.16 }, { frequency: 1040, delay: 0.22, duration: 0.2 }]
    : [{ frequency: 760, delay: 0, duration: 0.14 }, { frequency: 900, delay: 0.19, duration: 0.16 }];

  tones.forEach(({ frequency, delay, duration }) => {
    const startAt = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  });
}

function vibrate(urgent = false) {
  if (!hasWindow() || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(urgent ? [350, 120, 350, 120, 500] : [250, 120, 300]);
  } catch {
    // Vibration is supplementary.
  }
}

async function showSystemNotification({ title, body, tag, url }) {
  if (!hasWindow() || staffNotificationPermission() !== 'granted') return;
  const options = {
    body,
    tag: tag || 'lumora-staff-alert',
    renotify: true,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: url || window.location.pathname },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to Notification constructor where available.
  }

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      if (url) window.location.assign(url);
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow service-worker notifications.
  }
}

export function triggerStaffAlert({
  title,
  body,
  tag,
  url,
  urgent = false,
} = {}) {
  if (!isStaffAlertsEnabled()) return;
  playTone(urgent);
  vibrate(urgent);
  void showSystemNotification({
    title: title || 'Lumora có việc mới',
    body: body || 'Có công việc đang chờ nhân viên xử lý.',
    tag,
    url,
  });
}
