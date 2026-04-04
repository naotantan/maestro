import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { uploadToDrive } from '../lib/gdrive.js';

const execAsync = promisify(exec);

const BACKUP_DIR = join(homedir(), '.maestro', 'backups');

// バックアップ保存先の種類
type DestType = 'local' | 'gdrive';

export const backupCommand = new Command('backup')
  .description('バックアップ管理')
  .addCommand(
    new Command('create')
      .description('バックアップを作成')
      .option('--output <path>', 'バックアップ出力先（ローカルのみ）')
      .option('--dest <type>', '保存先タイプ: local（デフォルト）または gdrive', 'local')
      .option('--folder-id <id>', 'Google Drive フォルダID（--dest gdrive 時に必須）')
      .action(async (options: { output?: string; dest: DestType; folderId?: string }) => {
        const dest = options.dest;

        // --dest gdrive 時のバリデーション
        if (dest === 'gdrive' && !options.folderId) {
          console.error(chalk.red('エラー: --dest gdrive には --folder-id <フォルダID> が必要です'));
          console.error(chalk.yellow('Google Drive のフォルダ URL から ID を確認してください'));
          console.error(chalk.gray('例: https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs'));
          process.exit(1);
        }

        if (dest !== 'local' && dest !== 'gdrive') {
          console.error(chalk.red(`エラー: --dest には local または gdrive を指定してください`));
          process.exit(1);
        }

        // ローカルに一時保存してから転送する（gdrive でも一時的にローカルに生成）
        const outputDir = options.output || BACKUP_DIR;
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = join(outputDir, `backup-${timestamp}.sql`);

        const spinner = ora('バックアップを作成中...').start();

        try {
          // Docker を使用して pg_dump を実行
          await execAsync(
            `docker exec maestro-postgres pg_dump -U maestro maestro > "${backupFile}"`,
          );
          spinner.succeed('SQLダンプ作成完了');

          if (dest === 'gdrive') {
            // Google Drive へアップロード
            const uploadSpinner = ora('Google Drive にアップロード中...').start();
            try {
              const driveUrl = await uploadToDrive(backupFile, options.folderId!);
              uploadSpinner.succeed('Google Drive へのアップロード完了');
              console.log(chalk.green('\n✅ バックアップを Google Drive に保存しました'));
              console.log(`Drive URL: ${chalk.cyan(driveUrl)}`);
              // ローカルの一時ファイルを削除
              unlinkSync(backupFile);
              console.log(chalk.gray(`（ローカル一時ファイルを削除しました: ${backupFile}）\n`));
            } catch (uploadError) {
              uploadSpinner.fail('Google Drive へのアップロード失敗');
              if (uploadError instanceof Error) {
                console.error(chalk.red(`エラー: ${uploadError.message}`));
              }
              console.log(chalk.yellow(`\nローカルには保存されています: ${backupFile}`));
              process.exit(1);
            }
          } else {
            // ローカル保存
            console.log(chalk.green('\n✅ バックアップを作成しました'));
            console.log(`ファイル: ${chalk.gray(backupFile)}\n`);
          }
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
