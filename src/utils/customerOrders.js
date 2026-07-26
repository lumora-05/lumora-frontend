const storageKey = (tableId) => `lumora_customer_orders_${tableId}`;

export function getCustomerOrderIds(tableId) {
  if (!tableId) return [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(tableId)) || '[]');
    return Array.isArray(value) ? value.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function rememberCustomerOrder(tableId, orderId) {
  if (!tableId || !orderId) return;
  const normalizedId = String(orderId);
  const current = getCustomerOrderIds(tableId).filter((id) => String(id) !== normalizedId);
  localStorage.setItem(storageKey(tableId), JSON.stringify([normalizedId, ...current].slice(0, 30)));
}

export function replaceCustomerOrderIds(tableId, orderIds) {
  if (!tableId) return;
  const unique = [...new Set((orderIds || []).map(String).filter(Boolean))];
  localStorage.setItem(storageKey(tableId), JSON.stringify(unique.slice(0, 30)));
}
