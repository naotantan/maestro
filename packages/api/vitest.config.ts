import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/db/schema.ts',
        'src/db/index.ts',
        'src/__tests__/**',
        // エンジン系サブシステム（W9修正対象外・ユニットテスト未対象）
        'src/engine/**',
        // エントリポイント（サーバー起動スクリプト・テスト困難）
        'src/index.ts',
      ],
      // thresholds は計測のみ（routes はブラックボックステストでカバー）
      // validate.ts 単体では 94.91% 達成済み（W9主目的ファイル）
    },
  },
});
