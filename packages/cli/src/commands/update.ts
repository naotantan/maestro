import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const updateCommand = new Command('update')
  .description('CLI をアップデート')
  .action(async () => {
    console.log(chalk.bold('\n🔄 .company CLI アップデート\n'));

    const spinner = ora('現在のバージョンを確認中...').start();

    try {
      const { stdout: currentVersion } = await execAsync('npm list -g @company/cli 2>/dev/null | grep @company/cli || echo "0.0.0"');
      const version = currentVersion.trim();

      spinner.succeed(`現在のバージョン: ${chalk.bold(version)}`);

      spinner.start('アップデートを確認中...');
      const { stdout: latestVersion } = await execAsync('npm view @company/cli version');
      const latest = latestVersion.trim();

      if (version === latest) {
        spinner.succeed('確認完了');
        console.log(chalk.green('\n✅ すでに最新版です\n'));
        return;
      }

      spinner.start(`最新版 ${chalk.bold(latest)} にアップデート中...`);

      await execAsync('npm install -g @company/cli@latest');

      spinner.succeed('アップデート完了');

      const { stdout: newVersion } = await execAsync('npm list -g @company/cli 2>/dev/null | grep @company/cli || echo "unknown"');
      const updated = newVersion.trim();

      console.log(chalk.green('\n✅ アップデートが完了しました'));
      console.log(`${version} → ${chalk.bold(updated)}\n`);
    } catch (error) {
      spinner.fail('アップデート失敗');
      if (error instanceof Error) {
        console.error(chalk.red(`エラー: ${error.message}`));
      }
      process.exit(1);
    }
  });
