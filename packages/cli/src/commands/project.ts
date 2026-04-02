import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectListResponse {
  projects: Project[];
  meta: {
    total: number;
  };
}

export const projectCommand = new Command('project')
  .description('プロジェクト管理')
  .addCommand(
    new Command('list')
      .description('プロジェクト一覧')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('プロジェクト一覧を取得中...').start();

        try {
          const response = await apiRequest<ProjectListResponse>('GET', '/api/projects', apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n📂 プロジェクト一覧 (${response.meta.total}件)\n`));

          if (response.projects.length === 0) {
            console.log(chalk.gray('プロジェクトがありません'));
          } else {
            const maxNameLen = Math.max(...response.projects.map((p) => p.name.length), 4);

            console.log(
              `${'名前'.padEnd(maxNameLen + 2)} 作成日`,
            );
            console.log('-'.repeat(maxNameLen + 30));

            for (const project of response.projects) {
              console.log(
                `${project.name.padEnd(maxNameLen + 2)} ${new Date(project.createdAt).toLocaleDateString('ja-JP')}`,
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
      .description('新規プロジェクト作成')
      .option('--name <name>', 'プロジェクト名')
      .action(async (options: { name?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let name = options.name;

        if (!name) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'プロジェクト名:',
              validate: (v: string) => v ? true : '名前を入力してください',
            },
          ]);

          name = answers.name;
        }

        const spinner = ora('プロジェクト作成中...').start();

        try {
          const project = await apiRequest<Project>(
            'POST',
            '/api/projects',
            apiKey,
            { name },
          );

          spinner.succeed('作成完了');
          console.log(chalk.green(`\n✅ プロジェクト「${name}」を作成しました`));
          console.log(`ID: ${chalk.gray(project.id)}\n`);
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
      .description('プロジェクト詳細')
      .action(async (id: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('プロジェクト情報を取得中...').start();

        try {
          const project = await apiRequest<Project>('GET', `/api/projects/${id}`, apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n📂 プロジェクト詳細\n'));
          console.log(`名前: ${chalk.bold(project.name)}`);
          console.log(`ID: ${chalk.gray(project.id)}`);
          if (project.description) {
            console.log(`説明: ${project.description}`);
          }
          console.log(`作成日: ${new Date(project.createdAt).toLocaleDateString('ja-JP')}`);
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
