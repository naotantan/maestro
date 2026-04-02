import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';

interface Plugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
  createdAt: Date;
}

interface PluginListResponse {
  plugins: Plugin[];
  meta: {
    total: number;
  };
}

export const pluginCommand = new Command('plugin')
  .description('プラグイン管理')
  .addCommand(
    new Command('list')
      .description('プラグイン一覧')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('プラグイン一覧を取得中...').start();

        try {
          const response = await apiRequest<PluginListResponse>('GET', '/api/plugins', apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n🔌 プラグイン一覧 (${response.meta.total}件)\n`));

          if (response.plugins.length === 0) {
            console.log(chalk.gray('プラグインがありません'));
          } else {
            const maxNameLen = Math.max(...response.plugins.map((p) => p.name.length), 4);

            console.log(
              `${'名前'.padEnd(maxNameLen + 2)} バージョン 状態`,
            );
            console.log('-'.repeat(maxNameLen + 30));

            for (const plugin of response.plugins) {
              const status = plugin.enabled ? chalk.green('✅ 有効') : chalk.red('❌ 無効');
              console.log(
                `${plugin.name.padEnd(maxNameLen + 2)} ${plugin.version.padEnd(10)} ${status}`,
              );
            }
          }

          console.log('');
        } catch (error) {
          spinner.fail('取得失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('install <name>')
      .description('プラグインをインストール')
      .action(async (name: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora(`プラグイン「${name}」をインストール中...`).start();

        try {
          await apiRequest<Plugin>(
            'POST',
            '/api/plugins',
            apiKey,
            { name },
          );

          spinner.succeed('インストール完了');
          console.log(chalk.green(`\n✅ プラグイン「${name}」をインストールしました\n`));
        } catch (error) {
          spinner.fail('インストール失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('uninstall <id>')
      .description('プラグインをアンインストール')
      .option('--force', '確認なしでアンインストール')
      .action(async (id: string, options: { force?: boolean }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        if (!options.force) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'このプラグインをアンインストールしますか？',
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
          await apiRequest<void>(
            'DELETE',
            `/api/plugins/${id}`,
            apiKey,
          );

          spinner.succeed('アンインストール完了');
          console.log(chalk.green('\n✅ プラグインをアンインストールしました\n'));
        } catch (error) {
          spinner.fail('アンインストール失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  );
