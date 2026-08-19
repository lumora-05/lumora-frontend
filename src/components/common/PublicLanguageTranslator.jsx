import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { translatePublicText } from '../../utils/publicTranslations';

const TEXT_ORIGINAL = new WeakMap();
const TEXT_LAST_APPLIED = new WeakMap();
const ATTR_ORIGINAL = new WeakMap();
const ATTR_LAST_APPLIED = new WeakMap();
const ATTRIBUTES = ['placeholder', 'title', 'aria-label'];

function isPublicPath(pathname) {
  return pathname === '/'
    || pathname.startsWith('/reservations')
    || pathname.startsWith('/menu')
    || pathname.startsWith('/delivery')
    || pathname.startsWith('/table/');
}

function skipElement(element) {
  if (!element) return true;
  return Boolean(element.closest('script,style,noscript,[data-i18n-skip="true"]'));
}

function translateTextNode(node, language, refreshOriginal = false) {
  if (!node?.parentElement || skipElement(node.parentElement)) return;
  const current = node.nodeValue || '';
  const lastApplied = TEXT_LAST_APPLIED.get(node);
  if (!TEXT_ORIGINAL.has(node) || (refreshOriginal && current !== lastApplied)) {
    TEXT_ORIGINAL.set(node, current);
  }
  const original = TEXT_ORIGINAL.get(node) ?? current;
  const next = language === 'en' ? translatePublicText(original, 'en') : original;
  TEXT_LAST_APPLIED.set(node, next);
  if (current !== next) node.nodeValue = next;
}

function translateAttribute(element, name, language, refreshOriginal = false) {
  if (!(element instanceof Element) || skipElement(element) || !element.hasAttribute(name)) return;
  const current = element.getAttribute(name) ?? '';
  let originals = ATTR_ORIGINAL.get(element) || {};
  let lastMap = ATTR_LAST_APPLIED.get(element) || {};
  if (!(name in originals) || (refreshOriginal && current !== lastMap[name])) {
    originals = { ...originals, [name]: current };
    ATTR_ORIGINAL.set(element, originals);
  }
  const original = originals[name] ?? current;
  const next = language === 'en' ? translatePublicText(original, 'en') : original;
  lastMap = { ...lastMap, [name]: next };
  ATTR_LAST_APPLIED.set(element, lastMap);
  if (current !== next) element.setAttribute(name, next);
}

function translateAttributes(element, language) {
  ATTRIBUTES.forEach((name) => translateAttribute(element, name, language));
}

function translateTree(root, language) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;
  if (root instanceof Element) translateAttributes(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current, language);
    else translateAttributes(current, language);
    current = walker.nextNode();
  }
}

export default function PublicLanguageTranslator() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const publicPage = isPublicPath(pathname);

  useEffect(() => {
    const targetLanguage = publicPage ? language : 'vi';
    translateTree(document.body, targetLanguage);
    if (!publicPage) return undefined;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, targetLanguage, true);
          continue;
        }
        if (mutation.type === 'attributes') {
          translateAttribute(mutation.target, mutation.attributeName, targetLanguage, true);
          continue;
        }
        mutation.addedNodes.forEach((node) => translateTree(node, targetLanguage));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [language, pathname, publicPage]);

  return null;
}
