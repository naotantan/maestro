#!/usr/bin/env node
// pnpm install 後に .env.example を必要な場所へ自動コピーする
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const example = path.join(root, '.env.example');

const targets = [
  path.join(root, '.env'),
  path.join(root, 'packages', 'api', '.env'),
];

for (const target of targets) {
  if (!fs.existsSync(target)) {
    fs.copyFileSync(example, target);
    console.log(`✅ Created ${path.relative(root, target)}`);
  } else {
    console.log(`⏭  Skipped ${path.relative(root, target)} (already exists)`);
  }
}
