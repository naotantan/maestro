import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { saveConfig, getConfig } from '../config.js';
import { apiRequest } from '../api.js';

interface RegisterResponse {
  apiKey: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  company: {
    id: string;
    name: string;
  };
}

export const registerCommand = new Command('register')
  .description('アカウント登録：新しいアカウントを作成します')
  .option('--email <email>', 'メールアドレス')
  .option('--name <name>', '名前')
  .option('--company <company>', '企業名')
  .option('--quiet', '非対話モード')
  .action(async (options: {
    email?: string;
    name?: string;
    company?: string;
    quiet?: boolean;
  }) => {
    console.log(chalk.bold('\n📝 .company アカウント登録\n'));

    let email = options.email;
    let name = options.name;
    let company = options.company;
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
          validate: (v: string) => v && v.length >= 8 ? true : 'パスワードは8文字以上にしてください',
        },
        {
          type: 'input',
          name: 'name',
          message: '名前:',
          default: name,
          validate: (v: string) => v ? true : '名前を入力してください',
        },
        {
          type: 'input',
          name: 'company',
          message: '企業名:',
          default: company,
          validate: (v: string) => v ? true : '企業名を入力してください',
        },
      ]);

      email = answers.email;
      password = answers.password;
      name = answers.name;
      company = answers.company;
    } else if (!email || !name || !company) {
      console.error(chalk.red('エラー: --quiet モード時は --email, --name, --company が必須です'));
      process.exit(1);
    } else {
      // quiet で password を求める場合は stdin から読み込む必要があるため、ここではエラー
      console.error(chalk.red('エラー: --quiet モード時はパスワード入力不可です'));
      process.exit(1);
    }

    const spinner = ora('アカウント登録中...').start();

    try {
      const result = await apiRequest<RegisterResponse>(
        'POST',
        '/api/auth/register',
        '', // no API key for registration
        { email, password, name, companyName: company },
      );

      spinner.succeed('登録完了');

      const config = getConfig();
      saveConfig({
        ...(config || {}),
        installMode: config?.installMode ?? 'docker',
        apiUrl: config?.apiUrl ?? 'http://localhost:3000',
        apiKey: result.apiKey,
        language: config?.language ?? 'ja',
        version: config?.version ?? '0.1.0',
        createdAt: config?.createdAt ?? new Date().toISOString(),
      } as any);

      console.log(chalk.green(`\n✅ ようこそ、${result.user.name}さん！`));
      console.log(`企業: ${chalk.bold(result.company.name)}`);
      console.log(`メール: ${chalk.gray(result.user.email)}`);
      console.log(chalk.gray('\n認証情報をセットアップしました。\n'));
    } catch (error) {
      spinner.fail('登録失敗');
      if (error instanceof Error) {
        console.error(chalk.red(`エラー: ${error.message}`));
      }
      process.exit(1);
    }
  });
