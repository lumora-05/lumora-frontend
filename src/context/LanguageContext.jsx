import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'lumora_language';
const LanguageContext = createContext(null);

function normalizeLanguage(value) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'vi';
}

function readInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // Giữ ngôn ngữ mặc định nếu trình duyệt chặn localStorage.
  }
  return 'vi';
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readInitialLanguage);

  const setLanguage = (nextLanguage) => {
    const next = normalizeLanguage(nextLanguage);
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Không ảnh hưởng phiên hiện tại nếu localStorage bị chặn.
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'vi';
  }, [language]);

  const value = useMemo(() => ({
    language,
    locale: language === 'en' ? 'en-US' : 'vi-VN',
    isEnglish: language === 'en',
    setLanguage,
    toggleLanguage: () => setLanguage(language === 'en' ? 'vi' : 'en'),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}

export function currentLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'vi';
  }
}
