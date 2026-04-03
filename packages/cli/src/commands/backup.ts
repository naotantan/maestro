import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = join(homedir(), '.company-cli', 'backups');

export const backupCommand = new Command('backup')
  .description('バックアップ管理')
  .addCommand(
    new Command('create')
      .description('バックアップを作成')
      .option('--output <path>', 'バックアップ出力先')
      .action(async (options: { output?: string }) => {
        const outputDir = options.output || BACKUP_DIR;

        // ディレクトリ作成
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = join(outputDir, `backup-${timestamp}.sql`);

        const spinner = ora('バックアップを作成中...').start();

        try {
          // Docker を使用して pg_dump を実行
          // 実装例（実際の接続情報は環境に応じて調整が必要）
          await execAsync(
            `docker exec company-postgres pg_dump -U postgres company > "${backupFile}"`,
          );

          spinner.succeed('バックアップ作成完了');
          console.log(chalk.green('\n✅ バックアップを作成しました'));
          console.log(`ファイル: ${chalk.gray(backupFile)}\n`);
        } catch (error) {
          spinner.fail('バックアップ作成失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
            console.error(chalk.yellow('\n注意: Docker が起動していることを確認してください'));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('list')
      .description('バックアップ一覧')
      .action(async () => {
        const spinner = ora('バックアップ一覧を取得中...').start();

        try {
          if (!existsSync(BACKUP_DIR)) {
            spinner.succeed('確認完了');
            console.log(chalk.bold('\n📦 バックアップ一覧\n'));
            console.log(chalk.gray('バックアップがありません'));
            console.log('');
            return;
          }

          const files = readdirSync(BACKUP_DIR)
            .filter((f) => f.startsWith('backup-') && f.endsWith('.sql'))
            .map((f) => {
              const filePath = join(BACKUP_DIR, f);
              const stats = statSync(filePath);
              return { name: f, size: stats.size, mtime: stats.mtime };
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

          spinner.succeed('確認完了');

          console.log(chalk.bold(`\n📦 バックアップ一覧 (${files.length}件)\n`));

          if (files.length === 0) {
            console.log(chalk.gray('バックアップがありません'));
          } else {
            const maxNameLen = Math.max(...files.map((f) => f.name.length), 4);

            console.log(
              `${'ファイル名'.padEnd(maxNameLen + 2)} サイズ 作成日時`,
            );
            console.log('-'.repeat(maxNameLen + 50));

            for (const file of files) {
              const sizeMB = (file.size / 1024 / 1024).toFixed(2);
              console.log(
                `${file.name.padEnd(maxNameLen + 2)} ${sizeMB.padStart(8)} MB ${file.mtime.toLocaleString('ja-JP')}`,
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
  );
