import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';

interface Routine {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  enabled: boolean;
  createdAt: Date;
}

interface RoutineListResponse {
  routines: Routine[];
  meta: {
    total: number;
  };
}

interface RoutineRunResponse {
  executionId: string;
  status: string;
}

export const routineCommand = new Command('routine')
  .description('ルーチン管理')
  .addCommand(
    new Command('list')
      .description('ルーチン一覧')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('ルーチン一覧を取得中...').start();

        try {
          const response = await apiRequest<RoutineListResponse>('GET', '/api/routines', apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n🔄 ルーチン一覧 (${response.meta.total}件)\n`));

          if (response.routines.length === 0) {
            console.log(chalk.gray('ルーチンがありません'));
          } else {
            const maxNameLen = Math.max(...response.routines.map((r) => r.name.length), 4);

            console.log(
              `${'名前'.padEnd(maxNameLen + 2)} スケジュール 状態`,
            );
            console.log('-'.repeat(maxNameLen + 40));

            for (const routine of response.routines) {
              const status = routine.enabled ? chalk.green('✅ 有効') : chalk.red('❌ 無効');
              console.log(
                `${routine.name.padEnd(maxNameLen + 2)} ${routine.schedule.padEnd(16)} ${status}`,
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
    new Command('run <id>')
      .description('ルーチン実行')
      .action(async (id: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('ルーチン実行中...').start();

        try {
          const result = await apiRequest<RoutineRunResponse>(
            'POST',
            `/api/routines/${id}/run`,
            apiKey,
          );

          spinner.succeed('実行開始');
          console.log(chalk.green('\n✅ ルーチンを実行しました'));
          console.log(`実行ID: ${chalk.gray(result.executionId)}`);
          console.log(`ステータス: ${result.status}\n`);
        } catch (error) {
          spinner.fail('実行失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  );
