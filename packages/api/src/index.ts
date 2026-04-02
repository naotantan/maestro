import 'dotenv/config';
import { createApp } from './server';
import { closeDb } from '@company/db';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`🚀 API サーバー起動: http://localhost:${PORT}`);
    console.log(`   環境: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('シャットダウン中...');
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('サーバー起動失敗:', err);
  process.exit(1);
});
