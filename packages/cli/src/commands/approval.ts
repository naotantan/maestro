import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';

interface Approval {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  createdAt: Date;
}

interface ApprovalListResponse {
  approvals: Approval[];
  meta: {
    total: number;
  };
}

export const approvalCommand = new Command('approval')
  .description('承認管理')
  .addCommand(
    new Command('list')
      .description('承認申請一覧')
      .option('--status <status>', 'ステータスでフィルタ (pending)')
      .action(async (options: { status?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let path = '/api/approvals';
        if (options.status) {
          path += `?status=${options.status}`;
        }

        const spinner = ora('承認申請一覧を取得中...').start();

        try {
          const response = await apiRequest<ApprovalListResponse>('GET', path, apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n✅ 承認申請一覧 (${response.meta.total}件)\n`));

          if (response.approvals.length === 0) {
            console.log(chalk.gray('申請がありません'));
          } else {
            const maxTitleLen = Math.max(...response.approvals.map((a) => a.title.length), 5);

            console.log(
              `${'タイトル'.padEnd(maxTitleLen + 2)} ステータス 申請者`,
            );
            console.log('-'.repeat(maxTitleLen + 40));

            for (const approval of response.approvals) {
              const statusColor = approval.status === 'pending'
                ? chalk.yellow
                : approval.status === 'approved'
                  ? chalk.green
                  : chalk.red;
              console.log(
                `${approval.title.padEnd(maxTitleLen + 2)} ${statusColor(approval.status.padEnd(10))} ${approval.requestedBy}`,
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
    new Command('approve <id>')
      .description('承認申請を承認')
      .action(async (id: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('承認中...').start();

        try {
          await apiRequest<void>(
            'POST',
            `/api/approvals/${id}/approve`,
            apiKey,
          );

          spinner.succeed('承認完了');
          console.log(chalk.green('\n✅ 承認しました\n'));
        } catch (error) {
          spinner.fail('承認失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('reject <id>')
      .description('承認申請を却下')
      .option('--reason <reason>', '却下理由')
      .action(async (id: string, options: { reason?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let reason = options.reason;

        if (!reason) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'reason',
              message: '却下理由:',
            },
          ]);
          reason = answers.reason;
        }

        const spinner = ora('却下中...').start();

        try {
          await apiRequest<void>(
            'POST',
            `/api/approvals/${id}/reject`,
            apiKey,
            { reason },
          );

          spinner.succeed('却下完了');
          console.log(chalk.green('\n✅ 却下しました\n'));
        } catch (error) {
          spinner.fail('却下失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  );
