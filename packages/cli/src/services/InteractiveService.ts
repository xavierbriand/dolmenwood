import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  EncounterGenerator,
  SessionService,
  TableRepository,
  GenerationContext,
  SessionState,
  Encounter,
} from '@dolmenwood/core';

export class InteractiveService {
  constructor(
    private generator: EncounterGenerator,
    private sessionService: SessionService,
    private tableRepo: TableRepository,
  ) {}

  async start() {
    console.clear();
    console.log(chalk.bold.green('🌲 Dolmenwood Encounter Generator 🌲'));

    // Check for active session
    let activeSession: SessionState | null = null;
    const sessionRes = await this.sessionService.getLatestSession();
    if (sessionRes.kind === 'success') {
      activeSession = sessionRes.data;
      console.log(
        chalk.dim(
          `Active Session: ${activeSession.id} (Level ${activeSession.context.partyLevel})`,
        ),
      );
    }

    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '⚔️  Generate Encounter', value: 'encounter' },
            { name: '📜 Manage Sessions', value: 'session' },
            { name: '🚪 Exit', value: 'exit' },
          ],
        },
      ]);

      if (action === 'exit') {
        console.log('Farewell, traveler.');
        process.exit(0);
      }

      if (action === 'encounter') {
        await this.handleEncounter(activeSession);
      }

      if (action === 'session') {
        await this.handleSession();
        // Refresh active session after management
        const newSessionRes = await this.sessionService.getLatestSession();
        if (newSessionRes.kind === 'success') {
          activeSession = newSessionRes.data;
        }
      }
    }
  }

  private async handleEncounter(session: SessionState | null) {
    // 1. Fetch Regions
    const tablesRes = await this.tableRepo.listTables();
    if (tablesRes.kind === 'failure') {
      console.error(chalk.red('Failed to load regions.'));
      return;
    }

    const regions = tablesRes.data
      .filter((t) => t.name.startsWith('Regional - '))
      .map((t) => {
        const id = t.name.replace('Regional - ', '').toLowerCase();
        // Capitalize for display
        const name = t.name.replace('Regional - ', '');
        return { name, value: id };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // 2. Prompt
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'regionId',
        message: 'Select Region:',
        choices: regions,
        default: session?.context.currentRegionId,
      },
      {
        type: 'list',
        name: 'timeOfDay',
        message: 'Time of Day:',
        choices: ['Day', 'Night'],
        default: session?.context.timeOfDay || 'Day',
      },
      {
        type: 'list',
        name: 'terrain',
        message: 'Terrain:',
        choices: ['Road', 'Off-road'],
        default: 'Off-road',
      },
      {
        type: 'confirm',
        name: 'camping',
        message: 'Is the party camping?',
        default: false,
        when: (ans) => ans.timeOfDay === 'Night',
      },
    ]);

    const context: GenerationContext = {
      regionId: answers.regionId,
      timeOfDay: answers.timeOfDay,
      terrain: answers.terrain,
      camping: !!answers.camping,
    };

    console.log(chalk.dim('Rolling dice... 🎲'));
    const result = await this.generator.generateEncounter(context);

    if (result.kind === 'failure') {
      console.error(
        chalk.red('Error generating encounter:'),
        result.error.message,
      );
      await this.pause();
      return;
    }

    const encounter = result.data;
    this.printEncounter(encounter);

    // Save to session?
    if (session) {
      const { save } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'save',
          message: 'Save this encounter to session history?',
          default: true,
        },
      ]);

      if (save) {
        await this.sessionService.addEncounter(
          session.id,
          encounter,
          context.regionId,
        );
        console.log(chalk.green('Saved to history.'));
      }
    }

    await this.pause();
  }

  private async handleSession() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Session Management:',
        choices: [
          { name: '✨ New Session', value: 'new' },
          { name: '📋 List Sessions', value: 'list' },
          { name: '↩️  Back', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') return;

    if (action === 'new') {
      const { level } = await inquirer.prompt([
        {
          type: 'number',
          name: 'level',
          message: 'Party Level:',
          default: 1,
        },
      ]);

      const res = await this.sessionService.createSession({
        partyLevel: level,
      });
      if (res.kind === 'success') {
        console.log(chalk.green(`Session created! ID: ${res.data.id}`));
      }
    }

    if (action === 'list') {
      const res = await this.sessionService.listSessions();
      if (res.kind === 'success') {
        res.data.forEach((s) => {
          console.log(
            `${chalk.cyan(s.id)} - Level ${s.context.partyLevel} - ${new Date(s.updatedAt).toLocaleDateString()}`,
          );
        });
      }
    }

    await this.pause();
  }

  private printEncounter(encounter: Encounter) {
    console.log(chalk.green('\nEncounter Generated!'));
    console.log('==================================================');
    console.log(`${chalk.bold('Summary:')} ${chalk.white(encounter.summary)}`);
    console.log(`${chalk.bold('Type:')}    ${encounter.type}`);

    if (encounter.details.isLair !== undefined) {
      const lairLabel = encounter.details.isLair
        ? chalk.bold.magenta('[In Lair]')
        : chalk.dim('[Wandering]');
      console.log(`${chalk.bold('Context:')} ${lairLabel}`);
    }

    if (encounter.details.distance)
      console.log(`${chalk.bold('Distance:')} ${encounter.details.distance}`);
    if (encounter.details.surprise)
      console.log(`${chalk.bold('Surprise:')} ${encounter.details.surprise}`);
    if (encounter.details.activity)
      console.log(`${chalk.bold('Activity:')} ${encounter.details.activity}`);
    if (encounter.details.reaction)
      console.log(`${chalk.bold('Reaction:')} ${encounter.details.reaction}`);

    if (encounter.type === 'Creature' && encounter.details.creature) {
      console.log('--------------------------------------------------');
      const c = encounter.details.creature;
      console.log(chalk.bold.cyan(c.name));
      console.log(
        `${chalk.dim('Stats:')} AC ${c.armourClass}, HD ${c.hitDice}, MV ${c.movement}, Morale ${c.morale}`,
      );
      console.log(`${chalk.dim('Attacks:')} ${c.attacks.join(', ')}`);
      if (c.description) console.log('\n' + chalk.italic(c.description));
    }
    console.log('==================================================');
  }

  private async pause() {
    await inquirer.prompt([
      { type: 'input', name: 'enter', message: 'Press Enter to continue...' },
    ]);
  }
}
