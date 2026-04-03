import 'dotenv/config';
import { createApp } from './server';
import { closeDb } from '@company/db';
import { startHeartbeatEngine, stopHeartbeatEngine } from './engine/heartbeat-engine';
import { startCrashRecovery, stopCrashRecovery } from './engine/crash-recovery';
import { startBudgetMonitor, stopBudgetMonitor } from './engine/budget-monitor';

const PORT = parseInt(process.env.PORT || '3000', 10);
// 本番環境またはHEARTBEAT=trueの場合にエンジンを起動
const ENABLE_ENGINE = process.env.ENABLE_ENGINE === 'true' || process.env.NODE_ENV === 'production';

async function main() {
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`🚀 API サーバー起動: http://localhost:${PORT}`);
    console.log(`   環境: ${process.env.NODE_ENV || 'development'}`);

    // ハートビートエンジン・クラッシュ回復を起動
    if (ENABLE_ENGINE) {
      startHeartbeatEngine();
      startCrashRecovery();
      startBudgetMonitor();
      console.log('   エンジン: HeartbeatEngine + CrashRecovery + BudgetMonitor 起動');
    } else {
      console.log('   エンジン: 無効（ENABLE_ENGINE=true で有効化）');
    }
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('シャットダウン中...');
    stopHeartbeatEngine();
    stopCrashRecovery();
    stopBudgetMonitor();
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
