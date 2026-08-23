import { useEffect, useState } from 'react';
import { translationApi } from '../api/translationApi';
import {
  clearRuntimeTranslationIfSourceChanged,
  setRuntimeTranslation,
} from '../utils/localizedContent';

const CACHE_PREFIX = 'lumora_public_menu_translation_v4:';
let menuTranslationPromise = null;

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function foodId(food) {
  return food?.maMonAn ?? food?.id ?? food?.monAn?.maMonAn ?? food?.monAn?.id;
}

function categoryId(category) {
  return category?.maDanhMuc ?? category?.id;
}

function originalValue(source, keys) {
  for (const key of keys) {
    if (present(source?.[key])) return String(source[key]).trim();
  }
  return '';
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(type, id, field, sourceText) {
  return `${CACHE_PREFIX}${type}:${id}:${field}:${hashText(sourceText)}:${sourceText.length}`;
}

function readCached(type, id, field, sourceText) {
  try {
    const raw = localStorage.getItem(cacheKey(type, id, field, sourceText));
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.source === sourceText && present(parsed?.value) ? String(parsed.value) : '';
  } catch {
    return '';
  }
}

function writeCached(type, id, field, sourceText, value) {
  try {
    localStorage.setItem(
      cacheKey(type, id, field, sourceText),
      JSON.stringify({ source: sourceText, value }),
    );
  } catch {
    // Cache chỉ là tối ưu; trang vẫn hoạt động nếu localStorage bị chặn.
  }
}

function responseData(response) {
  return response?.data ?? response ?? {};
}

function getMenuTranslations() {
  if (menuTranslationPromise) return menuTranslationPromise;

  menuTranslationPromise = translationApi.getMenu('en')
    .then((response) => {
      const data = responseData(response);
      return {
        foods: Array.isArray(data?.foods) ? data.foods : [],
        categories: Array.isArray(data?.categories) ? data.categories : [],
      };
    })
    .finally(() => {
      menuTranslationPromise = null;
    });

  return menuTranslationPromise;
}

function applyField({ source, type, id, field, keys, sourceText, translatedText }) {
  if (!source || id == null || !sourceText || !present(translatedText)) return false;
  const value = String(translatedText).trim();
  writeCached(type, id, field, sourceText, value);
  return setRuntimeTranslation(source, keys, value, sourceText);
}

function collectFoods(value) {
  const result = [];
  asArray(value).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.monAn && typeof item.monAn === 'object') result.push(item.monAn);
    else result.push(item);
  });
  return result;
}

export function usePublicContentTranslations({ language, foods, categories }) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (language !== 'en') return undefined;

    const foodSources = collectFoods(foods);
    const categorySources = [...asArray(categories)];
    if (!foodSources.length && !categorySources.length) return undefined;

    let changed = false;
    let needsServer = false;

    foodSources.forEach((food) => {
      const id = foodId(food);
      if (id == null) return;

      const nameSource = originalValue(food, ['tenMonAn', 'name', 'tenMon']);
      if (nameSource) {
        if (clearRuntimeTranslationIfSourceChanged(food, ['tenMonAn', 'name', 'tenMon'], nameSource)) changed = true;
        const cached = readCached('food', id, 'name', nameSource);
        if (cached) {
          if (setRuntimeTranslation(food, ['tenMonAn', 'name', 'tenMon'], cached, nameSource)) changed = true;
        } else needsServer = true;
      }

      const descriptionSource = originalValue(food, ['moTaNgan', 'moTa', 'description']);
      if (descriptionSource) {
        if (clearRuntimeTranslationIfSourceChanged(food, ['moTaNgan', 'moTa', 'description'], descriptionSource)) changed = true;
        const cached = readCached('food', id, 'description', descriptionSource);
        if (cached) {
          if (setRuntimeTranslation(food, ['moTaNgan', 'moTa', 'description'], cached, descriptionSource)) changed = true;
        } else needsServer = true;
      }

      const nestedCategory = food?.danhMuc ?? food?.category;
      if (nestedCategory && typeof nestedCategory === 'object') categorySources.push(nestedCategory);
    });

    categorySources.forEach((category) => {
      const id = categoryId(category);
      if (id == null) return;
      const nameSource = originalValue(category, ['tenDanhMuc', 'name', 'categoryName']);
      if (nameSource) {
        if (clearRuntimeTranslationIfSourceChanged(category, ['tenDanhMuc', 'name', 'categoryName'], nameSource)) changed = true;
        const cached = readCached('category', id, 'name', nameSource);
        if (cached) {
          if (setRuntimeTranslation(category, ['tenDanhMuc', 'name', 'categoryName'], cached, nameSource)) changed = true;
        } else needsServer = true;
      }
    });

    if (changed) setRevision((value) => value + 1);
    if (!needsServer) return undefined;

    let cancelled = false;
    getMenuTranslations().then((data) => {
      if (cancelled) return;
      const foodMap = new Map(data.foods.map((item) => [String(item.maMonAn), item]));
      const categoryMap = new Map(data.categories.map((item) => [String(item.maDanhMuc), item]));
      let applied = false;

      foodSources.forEach((food) => {
        const id = foodId(food);
        if (id == null) return;
        const translated = foodMap.get(String(id));
        if (!translated) return;

        const nameSource = originalValue(food, ['tenMonAn', 'name', 'tenMon']);
        if (nameSource && applyField({
          source: food,
          type: 'food',
          id,
          field: 'name',
          keys: ['tenMonAn', 'name', 'tenMon'],
          sourceText: nameSource,
          translatedText: translated.tenMonAn,
        })) applied = true;

        const descriptionSource = originalValue(food, ['moTaNgan', 'moTa', 'description']);
        if (descriptionSource && applyField({
          source: food,
          type: 'food',
          id,
          field: 'description',
          keys: ['moTaNgan', 'moTa', 'description'],
          sourceText: descriptionSource,
          translatedText: translated.moTa,
        })) applied = true;
      });

      categorySources.forEach((category) => {
        const id = categoryId(category);
        if (id == null) return;
        const translated = categoryMap.get(String(id));
        if (!translated) return;
        const nameSource = originalValue(category, ['tenDanhMuc', 'name', 'categoryName']);
        if (nameSource && applyField({
          source: category,
          type: 'category',
          id,
          field: 'name',
          keys: ['tenDanhMuc', 'name', 'categoryName'],
          sourceText: nameSource,
          translatedText: translated.tenDanhMuc,
        })) applied = true;
      });

      if (applied) setRevision((value) => value + 1);
    }).catch(() => {
      // AI hoặc mạng lỗi: giữ nội dung hiện tại, không làm hỏng trang.
    });

    return () => {
      cancelled = true;
    };
  }, [language, foods, categories]);

  return revision;
}
