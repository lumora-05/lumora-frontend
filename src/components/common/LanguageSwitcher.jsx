import { Check, ChevronDown, Globe2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

const LANGUAGE_OPTIONS = [
  { value: 'vi', shortLabel: 'VI', label: 'TIẾNG VIỆT', flag: '🇻🇳' },
  { value: 'en', shortLabel: 'EN', label: 'ENGLISH', flag: '🇺🇸' },
];

export default function LanguageSwitcher({ compact = false, className = '' }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = LANGUAGE_OPTIONS.find((option) => option.value === language) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`lumora-language-switcher ${compact ? 'compact' : ''} ${open ? 'open' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="lumora-language-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={language === 'en' ? 'Choose language' : 'Chọn ngôn ngữ'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe2 className="lumora-language-globe" size={compact ? 15 : 16} aria-hidden="true" />
        <span className="lumora-language-current">{current.shortLabel}</span>
        <ChevronDown className="lumora-language-chevron" size={compact ? 14 : 15} aria-hidden="true" />
      </button>

      {open ? (
        <div className="lumora-language-menu" role="menu" aria-label={language === 'en' ? 'Languages' : 'Ngôn ngữ'}>
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.value === language;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`lumora-language-option ${active ? 'active' : ''}`}
                onClick={() => selectLanguage(option.value)}
              >
                <span className="lumora-language-flag" aria-hidden="true">{option.flag}</span>
                <span>{option.label}</span>
                {active ? <Check className="lumora-language-check" size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
