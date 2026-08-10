const DELIVERY_ADDRESS_KEY = 'lumora_delivery_address';

export function readDeliveryAddress() {
  try {
    return JSON.parse(sessionStorage.getItem(DELIVERY_ADDRESS_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveDeliveryAddress(value) {
  if (!value) {
    sessionStorage.removeItem(DELIVERY_ADDRESS_KEY);
    return;
  }
  sessionStorage.setItem(DELIVERY_ADDRESS_KEY, JSON.stringify(value));
}
