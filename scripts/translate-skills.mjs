#!/usr/bin/env node
/**
 * スキル説明を claude -p で1件ずつ日本語翻訳し、DBに直接書き込む。
 * usage: node scripts/translate-skills.mjs [target_lang]
 *        target_lang デフォルト: ja
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pg = require('../packages/db/node_modules/pg');
const execFileAsync = promisify(execFile);

const { Pool } = pg;
const TARGET_LANG = process.argv[2] || 'ja';
const LANG_NAME = { ja: '日本語', en: 'English', zh: '中文', ko: '한국어' }[TARGET_LANG] ?? TARGET_LANG;

const DB_URL = process.env.DATABASE_URL || 'postgresql://maestro:changeme@localhost:5432/maestro';
const pool = new Pool({ connectionString: DB_URL });

// ANTHROPIC_API_KEY が設定されていると API クレジットで動作してしまうため削除
delete process.env.ANTHROPIC_API_KEY;

async function translateOne(text) {
  const prompt = `Translate the following text to ${LANG_NAME}. Output only the translation, nothing else.\n\n${text}`;

  const { stdout } = await execFileAsync(
    'claude',
    ['-p', prompt, '--no-session-persistence'],
    {
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024,
      input: '',   // stdin を明示的に閉じる
    }
  );

  return stdout.trim();
}

async function main() {
  console.log(`🌏 翻訳対象言語: ${LANG_NAME}`);

  const { rows } = await pool.query(
    `SELECT id, name, description
     FROM plugins
     WHERE description IS NOT NULL
       AND trim(description) != ''
       AND trim(description) != '|'
       AND (translation_lang IS NULL OR translation_lang != $1)
     ORDER BY name`,
    [TARGET_LANG]
  );

  if (rows.length === 0) {
    console.log('✅ 翻訳が必要なスキルはありません。');
    await pool.end();
    return;
  }

  console.log(`📋 翻訳対象: ${rows.length} 件\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    process.stdout.write(`[${success + failed + skipped + 1}/${rows.length}] ${row.name} ... `);

    try {
      const translated = await translateOne(row.description);

      if (!translated || translated === row.description) {
        // 翻訳結果が空 or 変化なし → translation_lang だけ記録して次へ
        await pool.query(
          `UPDATE plugins SET translation_lang = $1, updated_at = now() WHERE id = $2`,
          [TARGET_LANG, row.id]
        );
        skipped++;
        console.log(`スキップ（変化なし）`);
      } else {
        await pool.query(
          `UPDATE plugins
           SET description_translated = $1,
               translation_lang = $2,
               updated_at = now()
           WHERE id = $3`,
          [translated, TARGET_LANG, row.id]
        );
        success++;
        console.log(`✅`);
      }
    } catch (err) {
      failed++;
      console.log(`❌ ${err.message.split('\n')[0]}`);
    }
  }

  console.log(`\n🎉 完了: 翻訳 ${success}件, 変化なし ${skipped}件, 失敗 ${failed}件`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
