export const formatMoney = (value = 0) => Number(value || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
