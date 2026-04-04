import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';
import type { Agent, AgentType } from '@maestro/shared';
import { AGENT_TYPES } from '@maestro/shared';

interface AgentListResponse {
  agents: Agent[];
}

export const agentCommand = new Command('agent')
  .description('エージェント管理')
  .addCommand(
    new Command('list')
      .description('エージェント一覧')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('エージェント一覧を取得中...').start();

        try {
          const response = await apiRequest<AgentListResponse>('GET', '/api/agents', apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n🤖 エージェント一覧\n'));

          if (response.agents.length === 0) {
            console.log(chalk.gray('エージェントがありません'));
          } else {
            const maxNameLen = Math.max(...response.agents.map((a) => a.name.length), 4);

            console.log(
              `${'名前'.padEnd(maxNameLen + 2)} ${'タイプ'.padEnd(18)} 状態 最終ハートビート`,
            );
            console.log('-'.repeat(maxNameLen + 50));

            for (const agent of response.agents) {
              const status = agent.enabled ? chalk.green('✅ 有効') : chalk.red('❌ 無効');
              const heartbeat = agent.lastHeartbeatAt
                ? new Date(agent.lastHeartbeatAt).toLocaleString('ja-JP')
                : chalk.gray('なし');
              console.log(
                `${agent.name.padEnd(maxNameLen + 2)} ${agent.type.padEnd(18)} ${status} ${heartbeat}`,
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
      .description('新規エージェント作成')
      .option('--name <name>', 'エージェント名')
      .option('--type <type>', 'エージェントタイプ')
      .action(async (options: { name?: string; type?: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        let name = options.name;
        let type: AgentType | undefined;

        if (!name || !type) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'エージェント名:',
              default: name,
              validate: (v: string) => v ? true : '名前を入力してください',
            },
            {
              type: 'list',
              name: 'type',
              message: 'タイプを選択:',
              default: type,
              choices: AGENT_TYPES,
            },
          ]);

          name = answers.name;
          type = answers.type as AgentType;
        } else {
          type = options.type as AgentType;
        }

        const spinner = ora('エージェント作成中...').start();

        try {
          await apiRequest<Agent>('POST', '/api/agents', apiKey, { name, type });

          spinner.succeed('作成完了');
          console.log(chalk.green(`\n✅ エージェント「${name}」を作成しました\n`));
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
      .description('エージェント詳細')
      .action(async (id: string) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('エージェント情報を取得中...').start();

        try {
          const agent = await apiRequest<Agent>('GET', `/api/agents/${id}`, apiKey);

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n🤖 エージェント詳細\n'));
          console.log(`名前: ${chalk.bold(agent.name)}`);
          console.log(`ID: ${chalk.gray(agent.id)}`);
          console.log(`タイプ: ${agent.type}`);
          console.log(`状態: ${agent.enabled ? chalk.green('有効') : chalk.red('無効')}`);
          if (agent.description) {
            console.log(`説明: ${agent.description}`);
          }
          if (agent.lastHeartbeatAt) {
            console.log(
              `最終ハートビート: ${new Date(agent.lastHeartbeatAt).toLocaleString('ja-JP')}`,
            );
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
    new Command('delete <id>')
      .description('エージェント削除')
      .option('--force', '確認なしで削除')
      .action(async (id: string, options: { force?: boolean }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        if (!options.force) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'このエージェントを削除しますか？',
              default: false,
            },
          ]);

          if (!answer.confirm) {
            console.log(chalk.gray('キャンセルしました\n'));
            return;
          }
        }

        const spinner = ora('エージェント削除中...').start();

        try {
          await apiRequest<void>('DELETE', `/api/agents/${id}`, apiKey);

          spinner.succeed('削除完了');
          console.log(chalk.green('\n✅ エージェントを削除しました\n'));
        } catch (error) {
          spinner.fail('削除失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  )
  .addCommand(
    new Command('status')
      .description('エージェント状態確認')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('エージェント状態を確認中...').start();

        try {
          const response = await apiRequest<AgentListResponse>('GET', '/api/agents', apiKey);

          spinner.succeed('確認完了');

          console.log(chalk.bold('\n🤖 エージェント状態\n'));

          const enabled = response.agents.filter((a) => a.enabled).length;
          const total = response.agents.length;

          console.log(`稼働中: ${chalk.green(enabled)} / ${total}`);

          const now = Date.now();
          const agentsOnline = response.agents.filter((a) => {
            if (!a.lastHeartbeatAt) return false;
            const lastBeat = new Date(a.lastHeartbeatAt).getTime();
            return now - lastBeat < 5 * 60 * 1000; // 5分以内
          });

          console.log(`オンライン: ${chalk.green(agentsOnline.length)} / ${total}`);
          console.log('');
        } catch (error) {
          spinner.fail('確認失敗');
          if (error instanceof Error) {
            console.error(chalk.red(`エラー: ${error.message}`));
          }
          process.exit(1);
        }
      }),
  );
