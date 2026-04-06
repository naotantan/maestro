#!/usr/bin/env node
/**
 * ~/.claude/skills/ のスキルを maestro に一括インポートするスクリプト
 *
 * 使い方:
 *   node scripts/import-skills.js
 *   SKILLS_DIR=/path/to/skills node scripts/import-skills.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.env.HOME, '.claude', 'skills');

// APIキー取得
function getApiKey() {
  const envKey = process.env.API_KEY;
  if (envKey) return envKey;
  const keyFile = path.join(process.env.HOME, '.maestro', 'api-key');
  if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf-8').trim();
  throw new Error(
    'APIキーが見つかりません。~/.maestro/api-key を確認するか API_KEY を設定してください',
  );
}

// HTTP リクエスト
function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, API_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// SKILL.md からフロントマターを解析
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      fm[key] = val;
    }
  }
  return fm;
}

// スキルディレクトリをスキャン
function scanSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    throw new Error(`スキルディレクトリが見つかりません: ${SKILLS_DIR}`);
  }

  const skills = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf-8');
    const fm = parseFrontmatter(content);

    skills.push({
      name: fm.name || entry.name,
      description: fm.description || `Imported from ${entry.name}`,
      source_path: skillFile,
    });
  }
  return skills;
}

async function main() {
  console.log(`スキルディレクトリ: ${SKILLS_DIR}`);

  // ヘルスチェック
  try {
    const health = await request('GET', '/health');
    if (health.status !== 200) throw new Error();
  } catch {
    console.error(`エラー: APIサーバー (${API_URL}) に接続できません`);
    process.exit(1);
  }

  // スキルをスキャン
  const skills = scanSkills();
  console.log(`検出されたスキル: ${skills.length}件`);

  // 既存スキルを取得
  const existingRes = await request('GET', '/api/plugins?limit=1000');
  const existingNames = new Set((existingRes.data?.data || []).map((p) => p.name.toLowerCase()));
  console.log(`既存スキル: ${existingNames.size}件`);
  console.log('---');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const skill of skills) {
    if (existingNames.has(skill.name.toLowerCase())) {
      skipped++;
      continue;
    }

    try {
      const res = await request('POST', '/api/plugins', {
        name: skill.name,
        description: skill.description,
      });

      if (res.status === 201) {
        imported++;
        console.log(`  ✓ ${skill.name}`);
      } else {
        errors++;
        console.log(`  ✗ ${skill.name} (HTTP ${res.status}: ${res.data?.message || ''})`);
      }
    } catch (err) {
      errors++;
      console.log(`  ✗ ${skill.name} (${err.message})`);
    }
  }

  console.log('---');
  console.log(`完了: インポート=${imported}, スキップ(既存)=${skipped}, エラー=${errors}`);
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
