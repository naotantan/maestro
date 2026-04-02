import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { saveConfig, getConfig } from '../config.js';
import { apiRequest } from '../api.js';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  companies: Array<{
    id: string;
    name: string;
  }>;
}

interface ApiKeyResponse {
  apiKey: string;
}

export const loginCommand = new Command('login')
  .description('ログイン：既存のアカウントでログインします')
  .option('--email <email>', 'メールアドレス')
  .option('--quiet', '非対話モード')
  .action(async (options: {
    email?: string;
    quiet?: boolean;
  }) => {
    console.log(chalk.bold('\n🔑 .company ログイン\n'));

    let email = options.email;
    let password: string;

    if (!options.quiet) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'メールアドレス:',
          default: email,
          validate: (v: string) => v && v.includes('@') ? true : 'メールアドレスを入力してください',
        },
        {
          type: 'password',
          name: 'password',
          message: 'パスワード:',
          mask: '*',
          validate: (v: string) => v ? true : 'パスワードを入力してください',
        },
      ]);

      email = answers.email;
      password = answers.password;
    } else if (!email) {
      console.error(chalk.red('エラー: --quiet モード時は --email が必須です'));
      process.exit(1);
    } else {
      console.error(chalk.red('エラー: --quiet モード時はパスワード入力不可です'));
      process.exit(1);
    }

    let spinner = ora('ログイン中...').start();

    try {
      const loginResult = await apiRequest<LoginResponse>(
        'POST',
        '/api/auth/login',
        'temp',
        { email, password },
      );

      spinner.stop();

      // 企業選択
      if (loginResult.companies.length === 1) {
        console.log(`企業: ${chalk.bold(loginResult.companies[0].name)}`);
      } else {
        const companyAnswers = await inquirer.prompt([
          {
            type: 'list',
            name: 'companyId',
            message: '企業を選択してください:',
            choices: loginResult.companies.map((c) => ({
              name: c.name,
              value: c.id,
            })),
          },
        ]);

        spinner = ora('API キーを作成中...').start();

        try {
          const apiKeyResult = await apiRequest<ApiKeyResponse>(
            'POST',
            `/api/companies/${companyAnswers.companyId}/api-keys`,
            'temp',
            { name: 'CLI key' },
          );

          spinner.succeed('ログイン完了');

          const config = getConfig();
          saveConfig({
            ...(config || {}),
            installMode: config?.installMode ?? 'docker',
            apiUrl: config?.apiUrl ?? 'http://localhost:3000',
            apiKey: apiKeyResult.apiKey,
            language: config?.language ?? 'ja',
            version: config?.version ?? '0.1.0',
            createdAt: config?.createdAt ?? new Date().toISOString(),
          } as any);

          console.log(chalk.green(`\n✅ ログインしました`));
          console.log(`ユーザー: ${chalk.bold(loginResult.user.name)}`);
          console.log(chalk.gray('\n認証情報を保存しました。\n'));
        } catch (error) {
          spinner.fail('API キー作成失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }
    } catch (error) {
      spinner.fail('ログイン失敗');
      if (error instanceof Error) {
        console.error(chalk.red(`エラー: ${error.message}`));
      }
      process.exit(1);
    }
  });
