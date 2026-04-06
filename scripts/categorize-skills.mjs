#!/usr/bin/env node
/**
 * スキルを claude -p でカテゴリ分類し、DBに書き込む。
 * usage: node scripts/categorize-skills.mjs
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pg = require('../packages/db/node_modules/pg');
const execFileAsync = promisify(execFile);

const { Pool } = pg;
const DB_URL = process.env.DATABASE_URL || 'postgresql://maestro:changeme@localhost:5432/maestro';
const pool = new Pool({ connectionString: DB_URL });

// ANTHROPIC_API_KEY が設定されていると API クレジットで動作してしまうため削除
delete process.env.ANTHROPIC_API_KEY;

const SKILL_CATEGORIES = [
  'AI・エージェント',
  'フロントエンド',
  'バックエンド・API',
  'データベース',
  'テスト・品質',
  'DevOps・インフラ',
  '言語・フレームワーク',
  'コンテンツ・マーケティング',
  'セキュリティ',
  'ワークフロー・ツール',
  'その他',
];

const BATCH_SIZE = 30;

async function categorizeBatch(skills) {
  const categories = SKILL_CATEGORIES.join(', ');
  const input = JSON.stringify(
    skills.map((s) => ({ name: s.name, description: (s.description || '').slice(0, 200) }))
  );
  const prompt =
    `以下のスキル一覧を、次のカテゴリのいずれかに分類してください: ${categories}\n` +
    `入力と同じ順番で、カテゴリ名だけのJSON配列を返してください。他のテキストは不要です。\n\n${input}`;

  const { stdout } = await execFileAsync(
    'claude',
    ['-p', prompt, '--no-session-persistence'],
    {
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
      input: '',
    }
  );

  const match = stdout.trim().match(/\[[\s\S]*\]/);
  if (!match) return skills.map(() => 'その他');

  const parsed = JSON.parse(match[0]);
  if (Array.isArray(parsed) && parsed.length === skills.length) {
    return parsed.map((v) =>
      typeof v === 'string' && SKILL_CATEGORIES.includes(v) ? v : 'その他'
    );
  }
  return skills.map(() => 'その他');
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, description
     FROM plugins
     WHERE category IS NULL OR category = 'その他'
     ORDER BY name`
  );

  if (rows.length === 0) {
    console.log('✅ 分類が必要なスキルはありません。');
    await pool.end();
    return;
  }

  console.log(`📋 分類対象: ${rows.length} 件\n`);

  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    process.stdout.write(`[バッチ ${batchNum}/${totalBatches}] ${batch.length}件 ... `);

    try {
      const categories = await categorizeBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        await pool.query(
          `UPDATE plugins SET category = $1, updated_at = now() WHERE id = $2`,
          [categories[j], batch[j].id]
        );
      }

      const counts = {};
      categories.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
      const summary = Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(', ');
      console.log(`✅ ${summary}`);
      total += batch.length;
    } catch (err) {
      console.log(`❌ ${err.message.split('\n')[0]}`);
    }
  }

  console.log(`\n🎉 完了: ${total}件分類済み`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
