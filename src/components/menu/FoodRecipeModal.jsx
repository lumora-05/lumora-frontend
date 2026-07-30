import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { inventoryApi } from '../../api/inventoryApi';
import Modal from '../common/Modal';
import { errorMessageOf, messageOf, useToast } from '../../context/ToastContext';

function unwrapData(response, fallback = null) {
  return response?.data ?? response ?? fallback;
}

function unwrapList(response) {
  const value = unwrapData(response, []);
  return Array.isArray(value) ? value : [];
}

function emptyLine(ingredients, usedIds = new Set()) {
  const first = ingredients.find((item) => !usedIds.has(String(item.maNguyenLieu)));
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    maNguyenLieu: first ? String(first.maNguyenLieu) : '',
    dinhLuong: '',
  };
}

export default function FoodRecipeModal({ open, food, onClose }) {
  const toast = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !food?.maMonAn) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [ingredientResponse, recipeResponse] = await Promise.all([
          inventoryApi.getActive(),
          menuApi.getRecipe(food.maMonAn),
        ]);
        if (cancelled) return;
        const nextIngredients = unwrapList(ingredientResponse);
        const recipe = unwrapData(recipeResponse, {});
        setIngredients(nextIngredients);
        setLines((recipe?.nguyenLieu || []).map((item) => ({
          key: String(item.maCongThuc || `${item.maNguyenLieu}-${Math.random()}`),
          maNguyenLieu: String(item.maNguyenLieu),
          dinhLuong: String(item.dinhLuong ?? ''),
        })));
      } catch (error) {
        if (!cancelled) toast.error(errorMessageOf(error, 'Không thể tải công thức món ăn'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, food?.maMonAn]);

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((item) => [String(item.maNguyenLieu), item])),
    [ingredients],
  );

  function addLine() {
    const usedIds = new Set(lines.map((line) => String(line.maNguyenLieu)).filter(Boolean));
    const next = emptyLine(ingredients, usedIds);
    if (!next.maNguyenLieu && ingredients.length) {
      toast.info('Tất cả nguyên liệu đang hoạt động đã có trong công thức');
      return;
    }
    setLines((current) => [...current, next]);
  }

  function updateLine(key, field, value) {
    setLines((current) => current.map((line) => (
      line.key === key ? { ...line, [field]: value } : line
    )));
  }

  function removeLine(key) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  async function save(event) {
    event.preventDefault();
    const selectedIds = lines.map((line) => line.maNguyenLieu).filter(Boolean);
    if (selectedIds.length !== new Set(selectedIds).size) {
      toast.error('Một nguyên liệu chỉ được xuất hiện một lần trong công thức');
      return;
    }
    if (lines.some((line) => !line.maNguyenLieu || Number(line.dinhLuong) <= 0)) {
      toast.error('Vui lòng chọn nguyên liệu và nhập định lượng lớn hơn 0');
      return;
    }

    setSaving(true);
    try {
      const response = await menuApi.updateRecipe(food.maMonAn, {
        nguyenLieu: lines.map((line) => ({
          maNguyenLieu: Number(line.maNguyenLieu),
          dinhLuong: Number(line.dinhLuong),
        })),
      });
      toast.success(messageOf(response, 'Cập nhật công thức món ăn thành công'));
      onClose();
    } catch (error) {
      toast.error(errorMessageOf(error, 'Cập nhật công thức món ăn thất bại'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={`Công thức · ${food?.tenMonAn || ''}`} onClose={saving ? undefined : onClose}>
      <form className="food-recipe-form" onSubmit={save}>
        <div className="food-recipe-guide">
          <span><UtensilsCrossed size={19} /></span>
          <div>
            <strong>Định lượng cho một phần món</strong>
            <p>Khi bếp bắt đầu chế biến, hệ thống nhân định lượng với số phần và tự cấp phát lô còn hạn, an toàn theo FEFO.</p>
          </div>
        </div>

        {loading ? (
          <div className="food-recipe-empty">Đang tải công thức...</div>
        ) : (
          <div className="food-recipe-lines">
            {lines.map((line, index) => {
              const selected = ingredientMap.get(String(line.maNguyenLieu));
              return (
                <div className="food-recipe-line" key={line.key}>
                  <span className="food-recipe-index">{index + 1}</span>
                  <label>
                    <span>Nguyên liệu</span>
                    <select value={line.maNguyenLieu} onChange={(event) => updateLine(line.key, 'maNguyenLieu', event.target.value)}>
                      <option value="">Chọn nguyên liệu</option>
                      {ingredients.map((item) => {
                        const usedByOther = lines.some((other) => other.key !== line.key && String(other.maNguyenLieu) === String(item.maNguyenLieu));
                        return (
                          <option key={item.maNguyenLieu} value={item.maNguyenLieu} disabled={usedByOther}>
                            {item.tenNguyenLieu} ({item.donViTinh})
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label>
                    <span>Định lượng</span>
                    <div className="food-recipe-quantity">
                      <input type="number" min="0.001" step="0.001" value={line.dinhLuong} onChange={(event) => updateLine(line.key, 'dinhLuong', event.target.value)} placeholder="0" />
                      <b>{selected?.donViTinh || 'đơn vị'}</b>
                    </div>
                  </label>
                  <button type="button" className="food-recipe-remove" title="Xóa nguyên liệu" onClick={() => removeLine(line.key)}><Trash2 size={17} /></button>
                </div>
              );
            })}
            {!lines.length && (
              <div className="food-recipe-empty">
                <CircleAlert size={22} />
                <strong>Món chưa có công thức nguyên liệu</strong>
                <span>Món vẫn hoạt động theo quy trình cũ cho đến khi công thức được thiết lập.</span>
              </div>
            )}
          </div>
        )}

        <button type="button" className="food-recipe-add" onClick={addLine} disabled={loading || !ingredients.length}>
          <Plus size={17} /> Thêm nguyên liệu
        </button>

        <div className="food-recipe-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Hủy</button>
          <button type="submit" className="primary" disabled={loading || saving}>{saving ? 'Đang lưu...' : 'Lưu công thức'}</button>
        </div>
      </form>
    </Modal>
  );
}
