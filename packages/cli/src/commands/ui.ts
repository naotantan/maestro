import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { getApiUrl } from '../config.js';

const execAsync = promisify(exec);

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function getOpenCommand(): string {
  const platform = process.platform;
  if (platform === 'darwin') return 'open';
  if (platform === 'linux') return 'xdg-open';
  if (platform === 'win32') return 'start';
  return 'open';
}

export const uiCommand = new Command('ui')
  .description('Web UIをブラウザで開く')
  .option('--port <port>', 'UIのポート (デフォルト 5173)', '5173')
  .action(async (options: { port: string }) => {
    const port = options.port;
    const uiUrl = `http://localhost:${port}`;

    console.log(chalk.bold('\n🌐 Web UI を開いています...\n'));

    const spinner = ora('API の状態を確認中...').start();

    try {
      const isHealthy = await checkHealth();

      if (!isHealthy) {
        spinner.warn('API が応答していません');
        console.log(chalk.yellow('⚠️  API サーバーが起動していない可能性があります'));
        console.log(`API URL: ${getApiUrl()}`);
        console.log('');
      } else {
        spinner.succeed('API は正常です');
      }

      spinner.start('UI を開いています...');

      const openCommand = getOpenCommand();
      await execAsync(`${openCommand} "${uiUrl}"`);

      spinner.succeed('UI を開きました');
      console.log(chalk.green(`\n✅ ブラウザで ${uiUrl} を開いてください\n`));
    } catch (error) {
      spinner.fail('UI を開く失敗');
      if (error instanceof Error) {
        console.error(chalk.red(`エラー: ${error.message}`));
      }
      console.log(chalk.gray(`\n手動で開く: ${uiUrl}\n`));
    }
  });
