#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { registerCommand } from './commands/register.js';
import { loginCommand } from './commands/login.js';
import { orgCommand } from './commands/org.js';
import { agentCommand } from './commands/agent.js';
import { issueCommand } from './commands/issue.js';
import { goalCommand } from './commands/goal.js';
import { projectCommand } from './commands/project.js';
import { routineCommand } from './commands/routine.js';
import { approvalCommand } from './commands/approval.js';
import { costsCommand } from './commands/costs.js';
import { pluginCommand } from './commands/plugin.js';
import { uiCommand } from './commands/ui.js';
import { backupCommand } from './commands/backup.js';
import { updateCommand } from './commands/update.js';
import { uninstallCommand } from './commands/uninstall.js';

const program = new Command();

program
  .name('company')
  .description('.company CLI — AIエージェント組織管理ツール')
  .version('0.1.0');

// サブコマンド登録
program.addCommand(initCommand);
program.addCommand(doctorCommand);
program.addCommand(registerCommand);
program.addCommand(loginCommand);
program.addCommand(orgCommand);
program.addCommand(agentCommand);
program.addCommand(issueCommand);
program.addCommand(goalCommand);
program.addCommand(projectCommand);
program.addCommand(routineCommand);
program.addCommand(approvalCommand);
program.addCommand(costsCommand);
program.addCommand(pluginCommand);
program.addCommand(uiCommand);
program.addCommand(backupCommand);
program.addCommand(updateCommand);
program.addCommand(uninstallCommand);

program.parse(process.argv);
