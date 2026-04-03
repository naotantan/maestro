import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';
import * as dotenv from 'dotenv';

const repoRoot = path.resolve(__dirname, '../../../');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.development'), override: true });

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL 環境変数が設定されていません');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log('マイグレーションを実行中...');
  await migrate(db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
  });
  console.log('マイグレーション完了');

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('マイグレーション失敗:', err);
  process.exit(1);
});
