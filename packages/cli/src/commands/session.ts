import { Command } from 'commander';
import { SessionService } from '@dolmenwood/core';
import chalk from 'chalk';

export function createSessionCommand(sessionService: SessionService): Command {
  const cmd = new Command('session').description('Manage game sessions');

  cmd
    .command('new')
    .description('Start a new session')
    .action(async () => {
      const result = await sessionService.createSession();
      if (result.kind === 'success') {
        console.log(chalk.green(`Session created!`));
        console.log(`ID: ${chalk.bold(result.data.id)}`);
      } else {
        console.error(chalk.red('Failed to create session:'), result.error);
      }
    });

  cmd
    .command('list')
    .description('List all sessions')
    .action(async () => {
      const result = await sessionService.listSessions();
      if (result.kind === 'failure') {
        console.error(chalk.red('Failed to list sessions:'), result.error);
        return;
      }

      if (result.data.length === 0) {
        console.log(
          chalk.yellow('No sessions found. Create one with "deg session new"'),
        );
        return;
      }

      console.log(chalk.bold('Available Sessions:'));
      result.data.forEach((s) => {
        const date = new Date(s.updatedAt).toLocaleString();
        console.log(
          `- ${chalk.cyan(s.id)} [${date}] Level: ${s.context.partyLevel}`,
        );
      });
    });

  cmd
    .command('info')
    .argument('[id]', 'Session ID (defaults to latest)')
    .description('Show session details')
    .action(async (id) => {
      let result;
      if (id) {
        result = await sessionService.getSession(id);
      } else {
        result = await sessionService.getLatestSession();
      }

      if (result.kind === 'failure') {
        console.error(
          chalk.red('Failed to load session:'),
          result.error.message,
        );
        return;
      }

      const s = result.data;
      console.log(chalk.bold(`Session: ${s.id}`));
      console.log(`Created: ${s.createdAt}`);
      console.log(`Updated: ${s.updatedAt}`);
      console.log(chalk.bold('Context:'));
      console.log(`  Level: ${s.context.partyLevel}`);
      console.log(`  Time:  ${s.context.timeOfDay}`);
      console.log(`  Region: ${s.context.currentRegionId || 'None'}`);
      console.log(chalk.bold(`History (${s.history.length} encounters):`));
      s.history.slice(-5).forEach((h) => {
        // Show last 5
        console.log(
          `  [${new Date(h.timestamp).toLocaleTimeString()}] ${h.encounter.summary} (${h.regionId})`,
        );
      });
    });

  return cmd;
}
