import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './locales/ja.json';
import en from './locales/en.json';

export const defaultLanguage = 'ja' as const;
export const supportedLanguages = ['ja', 'en'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

// 初期言語はブラウザのlocalStorageまたはデフォルト言語
function getInitialLanguage(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('language') || defaultLanguage;
  }
  return defaultLanguage;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: defaultLanguage,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
export { useTranslation } from 'react-i18next';
