import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../config.js';
import { apiRequest, checkAuth } from '../api.js';

interface CostSummary {
  total: number;
  byAgent: Record<string, number>;
}

interface Cost {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  description?: string;
  createdAt: Date;
}

interface CostListResponse {
  costs: Cost[];
  meta: {
    total: number;
  };
}

export const costsCommand = new Command('costs')
  .description('コスト管理')
  .addCommand(
    new Command('summary')
      .description('コスト概要')
      .action(async () => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const spinner = ora('コスト概要を取得中...').start();

        try {
          const summary = await apiRequest<CostSummary>(
            'GET',
            '/api/costs/summary',
            apiKey,
          );

          spinner.succeed('取得完了');

          console.log(chalk.bold('\n💰 コスト概要\n'));
          console.log(`合計: ${chalk.bold(summary.total.toFixed(2))} 円`);

          if (Object.keys(summary.byAgent).length > 0) {
            console.log(chalk.bold('\nエージェント別:'));
            const maxNameLen = Math.max(
              ...Object.keys(summary.byAgent).map((k) => k.length),
              4,
            );

            for (const [agentName, amount] of Object.entries(summary.byAgent)) {
              console.log(`  ${agentName.padEnd(maxNameLen + 2)} ${amount.toFixed(2)} 円`);
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
    new Command('list')
      .description('コスト一覧')
      .option('--limit <limit>', ' 表示件数 (デフォルト 20)', '20')
      .action(async (options: { limit: string }) => {
        const config = getConfig();
        const apiKey = checkAuth(config);

        const limit = parseInt(options.limit, 10) || 20;
        const spinner = ora('コスト一覧を取得中...').start();

        try {
          const response = await apiRequest<CostListResponse>(
            'GET',
            `/api/costs?limit=${limit}`,
            apiKey,
          );

          spinner.succeed('取得完了');

          console.log(chalk.bold(`\n💰 コスト一覧 (全${response.meta.total}件、最新${limit}件)\n`));

          if (response.costs.length === 0) {
            console.log(chalk.gray('コスト記録がありません'));
          } else {
            const maxAgentLen = Math.max(
              ...response.costs.map((c) => c.agentName.length),
              6,
            );

            console.log(
              `${'エージェント'.padEnd(maxAgentLen + 2)} 金額 日時`,
            );
            console.log('-'.repeat(maxAgentLen + 40));

            for (const cost of response.costs) {
              console.log(
                `${cost.agentName.padEnd(maxAgentLen + 2)} ${cost.amount.toFixed(2).padStart(8)} 円 ${new Date(cost.createdAt).toLocaleString('ja-JP')}`,
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
