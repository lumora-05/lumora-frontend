function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (present(value)) return value;
  }
  return undefined;
}

function englishValue(source, baseKeys) {
  const keys = [];
  baseKeys.forEach((base) => {
    keys.push(`${base}En`, `${base}EN`, `${base}_en`, `${base}English`);
  });
  const direct = firstValue(source, keys);
  if (present(direct)) return direct;

  const translations = source?.translations ?? source?.banDich ?? source?.i18n;
  const english = translations?.en ?? translations?.EN ?? translations?.english;
  if (english && typeof english === 'object') {
    const nested = firstValue(english, baseKeys);
    if (present(nested)) return nested;
  }
  return undefined;
}

export function localizedField(source, baseKeys, language = 'vi', fallback = '') {
  const keys = Array.isArray(baseKeys) ? baseKeys : [baseKeys];
  if (language === 'en') {
    const english = englishValue(source, keys);
    if (present(english)) return english;
  }
  const original = firstValue(source, keys);
  return present(original) ? original : fallback;
}

export function localizedFoodName(food, language = 'vi', fallback = 'Món ăn') {
  return localizedField(food, ['tenMonAn', 'name', 'tenMon'], language, fallback);
}

export function localizedFoodDescription(food, language = 'vi', fallback = '') {
  return localizedField(food, ['moTaNgan', 'moTa', 'description'], language, fallback);
}

export function localizedCategoryName(category, language = 'vi', fallback = 'Danh mục') {
  return localizedField(category, ['tenDanhMuc', 'name', 'categoryName'], language, fallback);
}

export function localizedFoodCategory(food, language = 'vi', fallback = 'Món ăn') {
  const category = food?.danhMuc ?? food?.category;
  const fromCategory = localizedCategoryName(category, language, '');
  if (fromCategory) return fromCategory;
  return localizedField(food, ['tenDanhMuc', 'categoryName'], language, fallback);
}

export function localizedPromotionName(promotion, language = 'vi', fallback = '') {
  return localizedField(promotion, ['tenKhuyenMai', 'name'], language, fallback);
}
