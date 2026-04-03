import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';
import type { Company } from '@company/shared';

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
}

export const orgCommand = new Command('org')
  .description('企業管理：企業情報と組織を管理します')
  .addCommand(
    new Command('show')
      .description('企業情報を表示')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('企業情報を取得中...').start();

        try {
          const company = await apiRequest<Company>('GET', '/api/org', apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n🏢 企業情報\n'));
          console.log(`名前: ${chalk.bold(company.name)}`);
          console.log(`ID: ${chalk.gray(company.id)}`);
          if (company.description) {
            console.log(`説明: ${company.description}`);
          }
          console.log(`作成日: ${new Date(company.createdAt).toLocaleDateString('ja-JP')}`);
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
    new Command('members')
      .description('メンバー一覧を表示')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('メンバー一覧を取得中...').start();

        try {
          const response = await apiRequest<{ data: Member[] }>(
            'GET',
            '/api/org/members',
            apiKey,
          );

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n👥 メンバー一覧\n'));

          if (response.data.length === 0) {
            console.log(chalk.gray('メンバーがいません'));
          } else {
            const maxNameLen = Math.max(...response.data.map((m) => m.name.length), 4);
            const maxEmailLen = Math.max(...response.data.map((m) => m.email.length), 5);

            console.log(
              `${'名前'.padEnd(maxNameLen + 2)} ${'メール'.padEnd(maxEmailLen + 2)} ロール`,
            );
            console.log('-'.repeat(maxNameLen + maxEmailLen + 20));

            for (const member of response.data) {
              console.log(
                `${member.name.padEnd(maxNameLen + 2)} ${member.email.padEnd(maxEmailLen + 2)} ${member.role}`,
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
    new Command('invite <email>')
      .description('メンバーを招待')
      .option('--role <role>', 'ロール (admin/member/viewer)', 'member')
      .action(async (email: string, options: { role: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora(`${email} を招待中...`).start();

        try {
          await apiRequest<void>(
            'POST',
            '/api/org/invite',
            apiKey,
            { email, role: options.role },
          );

          spinner.succeed('招待送信完了');
          console.log(chalk.green(`\n✅ ${email} に招待を送信しました\n`));
        } catch (error) {
          spinner.fail('招待送信失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  );
