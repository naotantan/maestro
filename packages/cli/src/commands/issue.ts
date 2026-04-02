import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';
import { ISSUE_STATUSES, ISSUE_PRIORITIES } from '@company/shared';

interface Issue {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IssueListResponse {
  issues: Issue[];
  meta: {
    total: number;
  };
}

export const issueCommand = new Command('issue')
  .description('タスク/課題管理')
  .addCommand(
    new Command('list')
      .description('タスク一覧')
      .option('--status <status>', 'ステータスでフィルタ')
      .option('--assignee <id>', '担当者でフィルタ')
      .action(async (options: { status?: string; assignee?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let path = '/api/issues';
        const params = new URLSearchParams();
        if (options.status) params.append('status', options.status);
        if (options.assignee) params.append('assigneeId', options.assignee);
        if (params.toString()) path += `?${params.toString()}`;

        const spinner = ora('タスク一覧を取得中...').start();

        try {
          const response = await apiRequest<IssueListResponse>('GET', path, apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n📋 タスク一覧 (${response.meta.total}件)\n`));

          if (response.issues.length === 0) {
            console.log(chalk.gray('タスクがありません'));
          } else {
            const maxTitleLen = Math.max(...response.issues.map((i) => i.title.length), 5);

            console.log(
              `${'タイトル'.padEnd(maxTitleLen + 2)} ステータス 優先度`,
            );
            console.log('-'.repeat(maxTitleLen + 40));

            for (const issue of response.issues) {
              const statusColor = {
                done: chalk.green,
                in_progress: chalk.blue,
                in_review: chalk.cyan,
                todo: chalk.yellow,
                backlog: chalk.gray,
                cancelled: chalk.red,
              }[issue.status] || chalk.white;

              console.log(
                `${issue.title.padEnd(maxTitleLen + 2)} ${statusColor(issue.status.padEnd(12))} ${issue.priority}`,
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
      .description('新規タスク作成')
      .option('--title <title>', 'タイトル')
      .option('--description <desc>', '説明')
      .option('--priority <priority>', '優先度')
      .action(async (options: {
        title?: string;
        description?: string;
        priority?: string;
      }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let title = options.title;
        let description = options.description;
        let priority = options.priority;

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
              name: 'description',
              message: '説明 (オプション):',
            },
            {
              type: 'list',
              name: 'priority',
              message: '優先度:',
              default: 'medium',
              choices: Object.values(ISSUE_PRIORITIES),
            },
          ]);

          title = answers.title;
          description = answers.description;
          priority = answers.priority;
        }

        const spinner = ora('タスク作成中...').start();

        try {
          const issue = await apiRequest<Issue>(
            'POST',
            '/api/issues',
            apiKey,
            { title, description, priority: priority || 'medium' },
          );

          spinner.succeed('作成完了');
          console.log(chalk.green(`\n✅ タスク「${title}」を作成しました`));
          console.log(`ID: ${chalk.gray(issue.id)}\n`);
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
    new Command('show <identifier>')
      .description('タスク詳細')
      .action(async (identifier: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('タスク情報を取得中...').start();

        try {
          const issue = await apiRequest<Issue>('GET', `/api/issues/${identifier}`, apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n📋 タスク詳細\n'));
          console.log(`タイトル: ${chalk.bold(issue.title)}`);
          console.log(`ID: ${chalk.gray(issue.id)}`);
          console.log(`ステータス: ${issue.status}`);
          console.log(`優先度: ${issue.priority}`);
          if (issue.description) {
            console.log(`説明: ${issue.description}`);
          }
          console.log(`作成日: ${new Date(issue.createdAt).toLocaleDateString('ja-JP')}`);
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
    new Command('update <identifier>')
      .description('タスク更新')
      .option('--status <status>', '新しいステータス')
      .action(async (identifier: string, options: { status?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        if (!options.status) {
          console.error(chalk.red('エラー: --status を指定してください'));
          process.exit(1);
        }

        const spinner = ora('タスク更新中...').start();

        try {
          await apiRequest<void>(
            'PATCH',
            `/api/issues/${identifier}`,
            apiKey,
            { status: options.status },
          );

          spinner.succeed('更新完了');
          console.log(chalk.green(`\n✅ タスクを更新しました\n`));
        } catch (error) {
          spinner.fail('更新失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('close <identifier>')
      .description('タスク完了')
      .action(async (identifier: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('タスク完了中...').start();

        try {
          await apiRequest<void>(
            'PATCH',
            `/api/issues/${identifier}`,
            apiKey,
            { status: 'done' },
          );

          spinner.succeed('完了');
          console.log(chalk.green(`\n✅ タスクを完了しました\n`));
        } catch (error) {
          spinner.fail('失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  );
