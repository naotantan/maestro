import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.ts';

export default function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-th-surface-0 rounded-th border border-th-border p-5 space-y-3">
      <h2 className="text-lg font-bold">テーマ</h2>
      <p className="text-xs text-th-text-3">クリックで即時切り替え・自動保存されます</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-th-md border px-4 py-3 text-sm font-medium transition-all ${
            theme === 'light'
              ? 'border-th-border-accent bg-th-accent-dim text-th-accent'
              : 'border-th-border text-th-text-3 hover:bg-th-surface-2'
          }`}
        >
          <Sun className="h-4 w-4" />
          ライト
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-th-md border px-4 py-3 text-sm font-medium transition-all ${
            theme === 'dark'
              ? 'border-th-border-accent bg-th-accent-dim text-th-accent'
              : 'border-th-border text-th-text-3 hover:bg-th-surface-2'
          }`}
        >
          <Moon className="h-4 w-4" />
          ダーク
        </button>
      </div>
    </div>
  );
}
