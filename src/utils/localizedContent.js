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

function runtimeEnglishValue(source, baseKeys) {
  const runtime = source?.__runtimeTranslations?.en;
  if (!runtime || typeof runtime !== 'object') return undefined;
  for (const key of baseKeys) {
    const entry = runtime[key];
    const value = entry && typeof entry === 'object' ? entry.value : entry;
    if (present(value)) return value;
  }
  return undefined;
}


function storedEnglishValue(source, baseKeys) {
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

function ensureRuntimeTranslations(source) {
  if (!source || typeof source !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(source, '__runtimeTranslations')) {
    Object.defineProperty(source, '__runtimeTranslations', {
      value: { en: {} },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!source.__runtimeTranslations.en) source.__runtimeTranslations.en = {};
  return source.__runtimeTranslations.en;
}

export function setRuntimeTranslation(source, baseKeys, value, sourceText = '') {
  if (!source || !present(value)) return false;
  const keys = Array.isArray(baseKeys) ? baseKeys : [baseKeys];
  const runtime = ensureRuntimeTranslations(source);
  if (!runtime) return false;

  let changed = false;
  keys.forEach((key) => {
    const current = runtime[key];
    const currentValue = current && typeof current === 'object' ? current.value : current;
    const currentSource = current && typeof current === 'object' ? current.sourceText : '';
    if (currentValue !== value || currentSource !== sourceText) changed = true;
    runtime[key] = { value, sourceText };
  });
  return changed;
}

export function clearRuntimeTranslationIfSourceChanged(source, baseKeys, sourceText = '') {
  const runtime = source?.__runtimeTranslations?.en;
  if (!runtime) return false;
  const keys = Array.isArray(baseKeys) ? baseKeys : [baseKeys];
  let changed = false;
  keys.forEach((key) => {
    const current = runtime[key];
    if (current && typeof current === 'object' && current.sourceText !== sourceText) {
      delete runtime[key];
      changed = true;
    }
  });
  return changed;
}

export function localizedField(source, baseKeys, language = 'vi', fallback = '') {
  const keys = Array.isArray(baseKeys) ? baseKeys : [baseKeys];
  if (language === 'en') {
    const runtime = runtimeEnglishValue(source, keys);
    if (present(runtime)) return runtime;
    const stored = storedEnglishValue(source, keys);
    if (present(stored)) return stored;
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
