import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';

interface Goal {
  id: string;
  title: string;
  description?: string;
  deadline?: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GoalListResponse {
  goals: Goal[];
  meta: {
    total: number;
  };
}

export const goalCommand = new Command('goal')
  .description('目標管理')
  .addCommand(
    new Command('list')
      .description('目標一覧')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('目標一覧を取得中...').start();

        try {
          const response = await apiRequest<GoalListResponse>('GET', '/api/goals', apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n🎯 目標一覧 (${response.meta.total}件)\n`));

          if (response.goals.length === 0) {
            console.log(chalk.gray('目標がありません'));
          } else {
            const maxTitleLen = Math.max(...response.goals.map((g) => g.title.length), 5);

            console.log(
              `${'タイトル'.padEnd(maxTitleLen + 2)} 期限`,
            );
            console.log('-'.repeat(maxTitleLen + 30));

            for (const goal of response.goals) {
              const deadline = goal.deadline
                ? new Date(goal.deadline).toLocaleDateString('ja-JP')
                : chalk.gray('未設定');
              console.log(
                `${goal.title.padEnd(maxTitleLen + 2)} ${deadline}`,
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
    new Command('create')
      .description('新規目標作成')
      .option('--title <title>', 'タイトル')
      .option('--deadline <date>', '期限 (YYYY-MM-DD)')
      .action(async (options: { title?: string; deadline?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let title = options.title;
        let deadline = options.deadline;

        if (!title) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: 'タイトル:',
              validate: (v: string) => v ? true : 'タイトルを入力してください',
            },
            {
              type: 'input',
              name: 'deadline',
              message: '期限 (YYYY-MM-DD、オプション):',
            },
          ]);

          title = answers.title;
          deadline = answers.deadline;
        }

        const spinner = ora('目標作成中...').start();

        try {
          const goal = await apiRequest<Goal>(
            'POST',
            '/api/goals',
            apiKey,
            { title, deadline: deadline ? new Date(deadline).toISOString() : undefined },
          );

          spinner.succeed('作成完了');
          console.log(chalk.green(`\n✅ 目標「${title}」を作成しました`));
          console.log(`ID: ${chalk.gray(goal.id)}\n`);
        } catch (error) {
          spinner.fail('作成失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('show <id>')
      .description('目標詳細')
      .action(async (id: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('目標情報を取得中...').start();

        try {
          const goal = await apiRequest<Goal>('GET', `/api/goals/${id}`, apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n🎯 目標詳細\n'));
          console.log(`タイトル: ${chalk.bold(goal.title)}`);
          console.log(`ID: ${chalk.gray(goal.id)}`);
          if (goal.description) {
            console.log(`説明: ${goal.description}`);
          }
          if (goal.deadline) {
            console.log(
              `期限: ${new Date(goal.deadline).toLocaleDateString('ja-JP')}`,
            );
          }
          console.log(`ステータス: ${goal.status}`);
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
