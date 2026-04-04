import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.development'), override: true });

export default {
  schema: './src/schema/index.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://maestro:changeme@localhost:5432/maestro',
  },
} satisfies Config;
