import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// .env または .env.development を読み込む
dotenv.config({ path: '../../.env' });
dotenv.config({ path: '../../.env.development' });

export default {
  schema: './src/schema/index.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://company:changeme@localhost:5432/company',
  },
} satisfies Config;
