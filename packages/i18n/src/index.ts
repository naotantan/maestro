import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './locales/ja.json';
import en from './locales/en.json';
import zh from './locales/zh.json';
import approvalsJa from './locales/features/approvals-ja.json';
import approvalsEn from './locales/features/approvals-en.json';

export const defaultLanguage = 'ja' as const;
export const supportedLanguages = ['ja', 'en', 'zh'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeTranslations(
  base: Record<string, unknown>,
  ...overrides: Record<string, unknown>[]
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const override of overrides) {
    for (const [key, value] of Object.entries(override)) {
      const existing = result[key];
      result[key] =
        isPlainObject(existing) && isPlainObject(value)
          ? mergeTranslations(existing, value)
          : value;
    }
  }

  return result;
}

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
      ja: { translation: mergeTranslations(ja, approvalsJa) },
      en: { translation: mergeTranslations(en, approvalsEn) },
      zh: { translation: zh },
    },
    lng: getInitialLanguage(),
    fallbackLng: defaultLanguage,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
export { useTranslation } from 'react-i18next';
