#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';

// .env を maestro リポジトリルートから読み込む
const repoRoot = process.env.MAESTRO_ROOT ?? path.resolve(__dirname, '../../../');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.development'), override: true });

// MCP SDK は ESM export のため dynamic import で読み込む
async function main() {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { closeDb } = await import('@maestro/db');
  const { resolveCompanyId } = await import('./auth');
  const { registerTools } = await import('./server');

  const log = (msg: string) => process.stderr.write(`[maestro-mcp-memory] ${msg}\n`);

  log('起動中...');

  const companyId = await resolveCompanyId();
  log(`認証成功 (company_id: ${companyId.slice(0, 8)}...)`);

  const server = new McpServer({
    name: 'maestro-memory',
    version: '0.1.0',
  });

  registerTools(server, companyId);
  log('ツール登録完了 (6個: save, recall, list, update, delete, context)');

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP Server 起動完了 (stdio transport)');

  const shutdown = async () => {
    log('シャットダウン中...');
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  process.stderr.write(`[maestro-mcp-memory] 起動失敗: ${err.message}\n`);
  process.exit(1);
});
