import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const foodId = (food) => food?.maMonAn ?? food?.id;
const storageKey = (qrToken) => `lumora_cart_qr_${qrToken || 'unknown'}`;

function readCart(qrToken) {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(qrToken)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children, qrToken }) {
  const [items, setItems] = useState(() => readCart(qrToken));

  useEffect(() => {
    setItems(readCart(qrToken));
  }, [qrToken]);

  useEffect(() => {
    sessionStorage.setItem(storageKey(qrToken), JSON.stringify(items));
  }, [items, qrToken]);

  const add = (food, quantity = 1) => setItems((old) => {
    const id = foodId(food);
    const amount = Math.max(1, Number(quantity) || 1);
    const found = old.find((item) => String(foodId(item)) === String(id));
    if (found) {
      return old.map((item) => String(foodId(item)) === String(id)
        ? {
            ...item,
            soLuong: Number(item.soLuong || 0) + amount,
            ghiChu: String(food?.ghiChu || '').trim() || item.ghiChu || ''
          }
        : item);
    }
    return [...old, { ...food, maMonAn: id, soLuong: amount, ghiChu: food?.ghiChu || '' }];
  });

  const updateQty = (id, soLuong) => setItems((old) => old.map((item) =>
    String(foodId(item)) === String(id)
      ? { ...item, soLuong: Math.max(1, Number(soLuong) || 1) }
      : item));

  const updateNote = (id, ghiChu) => setItems((old) => old.map((item) =>
    String(foodId(item)) === String(id) ? { ...item, ghiChu } : item));

  const remove = (id) => setItems((old) => old.filter((item) => String(foodId(item)) !== String(id)));
  const clear = () => setItems([]);
  const total = items.reduce((sum, item) => sum + Number(item.gia || 0) * Number(item.soLuong || 0), 0);
  const count = items.reduce((sum, item) => sum + Number(item.soLuong || 0), 0);
  const value = useMemo(
    () => ({ items, add, updateQty, updateNote, remove, clear, total, count }),
    [items, total, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
