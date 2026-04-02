import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { clearConfig } from '../config.js';

const execAsync = promisify(exec);

export const uninstallCommand = new Command('uninstall')
  .description('CLI をアンインストール')
  .option('--force', '確認なしでアンインストール')
  .action(async (options: { force?: boolean }) => {
    console.log(chalk.bold('\n🗑️  .company CLI アンインストール\n'));

    if (!options.force) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'CLI をアンインストール し、設定を削除してもよろしいですか？',
          default: false,
        },
      ]);

      if (!answer.confirm) {
        console.log(chalk.gray('キャンセルしました\n'));
        return;
      }
    }

    const spinner = ora('アンインストール中...').start();

    try {
      // 設定をクリア
      clearConfig();

      spinner.succeed('アンインストール完了');

      console.log(chalk.green('\n✅ 設定をクリアしました'));
      console.log(chalk.gray('\nCLI をアンインストールするには、以下を実行してください:'));
      console.log(chalk.cyan('  npm uninstall -g @company/cli'));
      console.log('');
    } catch (error) {
      spinner.fail('アンインストール失敗');
      if (error instanceof Error) {
        console.error(chalk.red(`エラー: ${error.message}`));
      }
      process.exit(1);
    }
  });
