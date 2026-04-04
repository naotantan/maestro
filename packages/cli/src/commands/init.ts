import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { saveConfig } from '../config.js';

const execAsync = promisify(exec);

export const initCommand = new Command('init')
  .description('初期化: Docker または ネイティブ方式で .maestro CLI をセットアップします')
  .option('--docker', 'Docker Compose 方式（推奨）')
  .option('--native', 'ネイティブ方式（既存 PostgreSQL を使用）')
  .option('--db-url <url>', 'PostgreSQL 接続 URL（--native 使用時必須）')
  .option('--quiet', '非対話モード（CI/CD 用）')
  .action(async (options: {
    docker?: boolean;
    native?: boolean;
    dbUrl?: string;
    quiet?: boolean;
  }) => {
    console.log(chalk.bold('\n🏢 .maestro CLI 初期化\n'));

    // 方式の決定
    const mode = options.native ? 'native' : 'docker';

    if (mode === 'native' && !options.dbUrl) {
      console.error(chalk.red('エラー: --native 使用時は --db-url が必要です。'));
      console.error('例: maestro init --native --db-url postgresql://user:pass@localhost:5432/maestro');
      process.exit(1);
    }

    if (mode === 'docker') {
      await initDocker(options.quiet ?? false);
    } else {
      await initNative(options.dbUrl!, options.quiet ?? false);
    }
  });

async function initDocker(_quiet: boolean): Promise<void> {
  const spinner = ora('Docker 環境を確認しています...').start();

  try {
    // Docker インストール確認
    try {
      execSync('docker --version', { stdio: 'ignore' });
    } catch {
      spinner.fail('Docker がインストールされていません。');
      console.error(chalk.red('\n対応:'));
      console.error('  1. Docker Desktop をインストールしてください: https://www.docker.com/products/docker-desktop');
      console.error('  2. 再度 maestro init を実行してください');
      console.error('\n詳しくは: maestro doctor');
      process.exit(1);
    }

    // Docker Desktop 起動確認
    spinner.text = 'Docker Desktop の起動を確認しています...';
    try {
      execSync('docker info', { stdio: 'ignore' });
    } catch {
      spinner.fail('Docker Desktop が起動していません。');
      console.error(chalk.red('\n対応:'));
      console.error('  1. Docker Desktop を起動してください');
      console.error('  2. 再度 maestro init を実行してください');
      process.exit(1);
    }

    spinner.succeed('Docker 環境を確認しました');

    // PostgreSQL 起動
    const spinner2 = ora('PostgreSQL を起動しています...').start();
    try {
      await execAsync('docker compose up -d postgres');
      spinner2.succeed('PostgreSQL 起動完了');
    } catch (err) {
      spinner2.fail('PostgreSQL の起動に失敗しました。');
      console.error(err);
      process.exit(1);
    }

    // DB ヘルスチェック待機（最大30秒）
    const spinner3 = ora('データベースの準備を待っています...').start();
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        await execAsync('docker exec maestro-postgres pg_isready -U maestro -d maestro');
        ready = true;
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (!ready) {
      spinner3.fail('データベースの起動タイムアウト。');
      process.exit(1);
    }
    spinner3.succeed('データベース準備完了');

    // 設定保存
    saveConfig({
      installMode: 'docker',
      apiUrl: 'http://localhost:3000',
      language: 'ja',
      version: '0.1.0',
      createdAt: new Date().toISOString(),
    });

    // 完了メッセージ
    console.log(chalk.green('\n✅ .maestro CLI が初期化されました\n'));
    console.log(chalk.bold('📋 設定情報:'));
    console.log('  インストール方式: Docker');
    console.log('  データベース: PostgreSQL 17 (localhost:5432)');
    console.log('  API URL: http://localhost:3000');
    console.log('  言語: 日本語\n');
    console.log(chalk.bold('📖 次のステップ:'));
    console.log('  1. maestro doctor    # 環境診断を実行');
    console.log('  2. maestro ui        # Web UI をブラウザで開く（実装予定）');
    console.log('\n💡 ヘルプ: maestro --help\n');

  } catch (err) {
    spinner.fail('初期化中にエラーが発生しました。');
    console.error(err);
    process.exit(1);
  }
}

async function initNative(dbUrl: string, _quiet: boolean): Promise<void> {
  const spinner = ora('PostgreSQL 接続を確認しています...').start();

  try {
    // 接続確認（pg_isready 相当）
    process.env.DATABASE_URL = dbUrl;

    // 簡易接続テスト（psql が使えない環境でも動くように node-pg で確認）
    const { Pool } = await import('pg').then(m => m.default || m);
    const pool = new Pool({ connectionString: dbUrl });
    await pool.query('SELECT 1');
    await pool.end();

    spinner.succeed('PostgreSQL 接続確認');

    // 設定保存
    saveConfig({
      installMode: 'native',
      apiUrl: 'http://localhost:3000',
      language: 'ja',
      version: '0.1.0',
      createdAt: new Date().toISOString(),
    });

    console.log(chalk.green('\n✅ .maestro CLI（ネイティブ方式）が初期化されました\n'));
    console.log(chalk.bold('📋 設定情報:'));
    console.log('  インストール方式: ネイティブ');
    console.log(`  データベース: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
    console.log('  API URL: http://localhost:3000\n');
    console.log(chalk.bold('📖 次のステップ:'));
    console.log('  1. maestro doctor    # 環境診断を実行');
    console.log('\n💡 ヘルプ: maestro --help\n');

  } catch (err) {
    spinner.fail('PostgreSQL 接続に失敗しました。');
    console.error(chalk.red('\nエラー詳細:'), err instanceof Error ? err.message : err);
    console.error('\n対応:');
    console.error('  1. --db-url の接続文字列を確認してください');
    console.error('  2. PostgreSQL が起動しているか確認してください');
    console.error('\n詳しくは: maestro doctor');
    process.exit(1);
  }
}
