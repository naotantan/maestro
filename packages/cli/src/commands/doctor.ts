import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { getConfig } from '../config.js';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  hint?: string;
}

export const doctorCommand = new Command('doctor')
  .description('環境診断: .maestro CLI の動作に必要な環境を確認します')
  .action(async () => {
    console.log(chalk.bold('\n🩺 .maestro CLI 環境診断\n'));
    const results: CheckResult[] = [];

    // 1. Node.js バージョン確認
    results.push(checkNodeVersion());

    // 2. Docker 確認
    results.push(checkDocker());

    // 3. Docker Desktop 起動確認
    results.push(checkDockerRunning());

    // 4. 設定ファイル確認
    results.push(checkConfig());

    // 5. PostgreSQL 接続確認
    results.push(await checkDatabase());

    // 結果表示
    let hasError = false;
    for (const result of results) {
      const icon =
        result.status === 'ok' ? chalk.green('✅') :
        result.status === 'warn' ? chalk.yellow('⚠️') :
        chalk.red('❌');

      console.log(`${icon} ${result.name}: ${result.message}`);
      if (result.hint) {
        console.log(`   ${chalk.gray('→ ' + result.hint)}`);
      }

      if (result.status === 'error') hasError = true;
    }

    console.log('');
    if (hasError) {
      console.log(chalk.red('❌ 問題が検出されました。上記の対応策を実施してください。'));
    } else {
      console.log(chalk.green('✅ 全ての診断が通過しました！'));
    }
    console.log('');
  });

function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1), 10);
  if (major >= 20) {
    return { name: 'Node.js', status: 'ok', message: version };
  }
  return {
    name: 'Node.js',
    status: 'error',
    message: `${version}（Node.js 20 以上が必要）`,
    hint: 'https://nodejs.org からインストールしてください',
  };
}

function checkDocker(): CheckResult {
  try {
    const version = execSync('docker --version', { encoding: 'utf8' }).trim();
    return { name: 'Docker', status: 'ok', message: version };
  } catch {
    return {
      name: 'Docker',
      status: 'error',
      message: '未インストール',
      hint: 'Docker Desktop を https://www.docker.com からインストールしてください',
    };
  }
}

function checkDockerRunning(): CheckResult {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return { name: 'Docker Desktop', status: 'ok', message: '起動中' };
  } catch {
    return {
      name: 'Docker Desktop',
      status: 'warn',
      message: '停止中',
      hint: 'Docker Desktop を起動してください（maestro init --docker に必要）',
    };
  }
}

function checkConfig(): CheckResult {
  const config = getConfig();
  if (!config) {
    return {
      name: '設定ファイル',
      status: 'warn',
      message: '未設定',
      hint: 'maestro init を実行してください',
    };
  }
  return {
    name: '設定ファイル',
    status: 'ok',
    message: `インストール方式: ${config.installMode} | API: ${config.apiUrl}`,
  };
}

async function checkDatabase(): Promise<CheckResult> {
  const config = getConfig();
  if (!config) {
    return {
      name: 'データベース',
      status: 'warn',
      message: '設定未完了',
      hint: 'maestro init を先に実行してください',
    };
  }

  try {
    const response = await fetch(`${config.apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      return { name: 'データベース', status: 'ok', message: '接続確認済み' };
    }
    return {
      name: 'データベース',
      status: 'error',
      message: `API ヘルスチェック失敗（HTTP ${response.status}）`,
      hint: 'docker compose up -d を実行してください',
    };
  } catch {
    return {
      name: 'データベース',
      status: 'error',
      message: 'API サーバーに接続できません',
      hint: config.installMode === 'docker'
        ? 'docker compose up -d を実行してください'
        : 'maestro api start を実行してください',
    };
  }
}
