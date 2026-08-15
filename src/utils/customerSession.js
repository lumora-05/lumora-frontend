const TOKEN_KEY = 'lumora_customer_token';
const USER_KEY = 'lumora_customer_user';
const GUEST_CONTINUE_KEY = 'lumora_customer_guest_continue';
const EVENT_NAME = 'lumora:customer-auth-changed';

export function getCustomerToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token !== 'undefined' && token !== 'null' ? token : '';
}

export function getCustomerUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasContinuedAsGuest() {
  return sessionStorage.getItem(GUEST_CONTINUE_KEY) === '1';
}

export function continueAsGuest() {
  sessionStorage.setItem(GUEST_CONTINUE_KEY, '1');
}

export function saveCustomerSession(auth) {
  if (!auth?.token) return;

  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify({
    maKhachHang: auth.maKhachHang,
    hoTen: auth.hoTen || '',
    soDienThoai: auth.soDienThoai || '',
    diemTichLuy: Number(auth.diemTichLuy || 0),
  }));

  sessionStorage.removeItem(GUEST_CONTINUE_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(GUEST_CONTINUE_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function onCustomerSessionChange(callback) {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', callback);

  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}