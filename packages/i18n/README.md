# @company/i18n

インターナショナライゼーション（i18n）パッケージ。React アプリケーションにマルチ言語対応を提供します。

## Features

- React 18 対応
- 日本語（デフォルト）と英語に対応
- localStorage による言語設定の永続化
- TypeScript完全サポート
- react-i18next による React Hook サポート

## Installation

このパッケージはモノレポの一部です。

```bash
pnpm install
```

## Usage

### 1. 初期化（main.tsx で自動実行）

```typescript
import '@company/i18n'; // 副作用インポート
```

### 2. コンポーネントで使用

```typescript
import { useTranslation } from '@company/i18n';

export function MyComponent() {
  const { t } = useTranslation();
  
  return <h1>{t('nav.dashboard')}</h1>;
}
```

### 3. 言語変更

```typescript
import i18n from '@company/i18n';

const handleLanguageChange = (lang: string) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('language', lang);
};
```

## Supported Languages

- `ja` - 日本語（デフォルト）
- `en` - English

## Translation Structure

翻訳キーはネストされたオブジェクトで管理されています：

```json
{
  "common": { ... },
  "nav": { ... },
  "auth": { ... },
  "dashboard": { ... },
  "agents": { ... },
  "issues": { ... },
  "goals": { ... },
  "projects": { ... },
  "routines": { ... },
  "approvals": { ... },
  "costs": { ... },
  "settings": { ... },
  "org": { ... },
  "plugins": { ... },
  "errors": { ... }
}
```

## Adding New Translations

1. `src/locales/ja.json` に日本語翻訳を追加
2. `src/locales/en.json` に英語翻訳を追加
3. パッケージを rebuild：`pnpm --filter @company/i18n build`

## Interpolation

動的なテキストを挿入する場合：

```json
{
  "dashboard": {
    "welcome": "ようこそ、{{name}}さん"
  }
}
```

```typescript
const { t } = useTranslation();
t('dashboard.welcome', { name: 'Taro' });
// => "ようこそ、Taroさん"
```

## Building

```bash
pnpm --filter @company/i18n build
```

## Type Checking

```bash
pnpm --filter @company/i18n typecheck
```
