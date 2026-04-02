// 翻訳キーの型定義
export interface TranslationKeys {
  common: Record<string, string>;
  nav: Record<string, string>;
  auth: Record<string, string>;
  dashboard: Record<string, string>;
  agents: Record<string, string | Record<string, string>>;
  issues: Record<string, string | Record<string, string>>;
  goals: Record<string, string>;
  projects: Record<string, string>;
  routines: Record<string, string>;
  approvals: Record<string, string>;
  costs: Record<string, string>;
  settings: Record<string, string>;
  org: Record<string, string | Record<string, string>>;
  plugins: Record<string, string>;
  errors: Record<string, string>;
}
