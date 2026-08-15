import { Globe2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSwitcher({ compact = false, className = '' }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={`lumora-language-switcher ${compact ? 'compact' : ''} ${className}`.trim()} aria-label={language === 'en' ? 'Language' : 'Ngôn ngữ'}>
      <Globe2 size={compact ? 15 : 16} aria-hidden="true" />
      <button type="button" className={language === 'vi' ? 'active' : ''} onClick={() => setLanguage('vi')} aria-pressed={language === 'vi'}>VI</button>
      <span aria-hidden="true">/</span>
      <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
    </div>
  );
}
