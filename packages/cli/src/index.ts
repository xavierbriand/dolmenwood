#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  EncounterGenerator,
  DefaultRandomProvider,
  SessionService,
  GenerationContext,
} from '@dolmenwood/core';
import {
  YamlTableRepository,
  YamlCreatureRepository,
  JsonSessionRepository,
} from '@dolmenwood/data';
import { createSessionCommand } from './commands/session.js';
import { InteractiveService } from './services/InteractiveService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve assets path relative to the built file (dist/index.js)
const ASSETS_PATH = path.resolve(__dirname, '../../../assets');
const HOME = os.homedir();
const SESSION_DIR = path.join(HOME, '.dolmenwood', 'sessions');

const program = new Command();

program
  .name('deg')
  .description('Dolmenwood Encounter Generator')
  .version('0.0.1');

// Setup Services
const tableRepo = new YamlTableRepository(ASSETS_PATH);
const creatureRepo = new YamlCreatureRepository(ASSETS_PATH);
const sessionRepo = new JsonSessionRepository(SESSION_DIR);

const random = new DefaultRandomProvider();
const generator = new EncounterGenerator(tableRepo, creatureRepo, random);
const sessionService = new SessionService(sessionRepo);
const interactive = new InteractiveService(
  generator,
  sessionService,
  tableRepo,
);

// Register Commands
program.addCommand(createSessionCommand(sessionService));

program
  .command('encounter')
  .argument('<region_id>', 'ID of the region (e.g. "forest")')
  .option('-t, --time <time>', 'Time of day (Day or Night)')
  .option('--terrain <terrain>', 'Terrain type (Road or Off-road)')
  .option('-c, --camping', 'Is the party camping?')
  .description('Generate a random encounter for a specific region context')
  .action(async (regionId, options) => {
    try {
      // 1. Load Session (if any)
      let session = null;
      const sessionRes = await sessionService.getLatestSession();
      if (sessionRes.kind === 'success') {
        session = sessionRes.data;
      }

      // 2. Build Context
      // Priority: Flag > Session > Default
      const timeOfDay = options.time
        ? (options.time as 'Day' | 'Night')
        : session?.context.timeOfDay || 'Day';

      const terrain = options.terrain
        ? (options.terrain as 'Road' | 'Off-road')
        : 'Off-road'; // Default

      const camping = options.camping !== undefined ? !!options.camping : false;

      const context: GenerationContext = {
        regionId,
        timeOfDay,
        terrain,
        camping,
      };

      console.log(
        chalk.blue(`Generating encounter for region: ${chalk.bold(regionId)}`),
      );
      console.log(
        chalk.dim(`Context: ${timeOfDay}, ${terrain}, Camping: ${camping}`),
      );
      if (session) {
        console.log(
          chalk.dim(
            `Session: ${session.id} (Level ${session.context.partyLevel})`,
          ),
        );
      }

      // 3. Generate
      const result = await generator.generateEncounter(context);

      // 4. Output
      if (result.kind === 'failure') {
        console.error(chalk.red('Error:'), result.error.message);
        process.exit(1);
      }

      const encounter = result.data;
      console.log(chalk.green('\nEncounter Generated!'));
      console.log('==================================================');

      console.log(
        `${chalk.bold('Summary:')} ${chalk.white(encounter.summary)}`,
      );
      console.log(`${chalk.bold('Type:')}    ${encounter.type}`);

      if (encounter.details.distance) {
        console.log(`${chalk.bold('Distance:')} ${encounter.details.distance}`);
      }

      if (encounter.details.surprise) {
        let color = chalk.white;
        if (encounter.details.surprise.includes('Players surprised'))
          color = chalk.yellow;
        if (encounter.details.surprise.includes('Both')) color = chalk.magenta;
        console.log(
          `${chalk.bold('Surprise:')} ${color(encounter.details.surprise)}`,
        );
      }

      if (encounter.details.activity) {
        console.log(`${chalk.bold('Activity:')} ${encounter.details.activity}`);
      }

      if (encounter.details.reaction) {
        console.log(`${chalk.bold('Reaction:')} ${encounter.details.reaction}`);
      }

      if (encounter.type === 'Creature' && encounter.details.creature) {
        console.log('--------------------------------------------------');
        const c = encounter.details.creature;
        console.log(chalk.bold.cyan(c.name));
        console.log(
          `${chalk.dim('Stats:')} AC ${c.armourClass}, HD ${c.hitDice}, MV ${c.movement}, Morale ${c.morale}`,
        );
        console.log(`${chalk.dim('Attacks:')} ${c.attacks.join(', ')}`);

        console.log(
          `${chalk.dim('Align:')} ${c.alignment}  ${chalk.dim('Level:')} ${c.level}  ${chalk.dim('XP:')} ${c.xp}`,
        );

        if (c.description) {
          console.log('\n' + chalk.italic(c.description));
        }
      }

      console.log('==================================================');

      // 5. Save to Session
      if (session) {
        await sessionService.addEncounter(session.id, encounter, regionId);
        console.log(chalk.dim(`Encounter saved to session history.`));
      }
    } catch (error) {
      console.error(chalk.red('Unexpected error:'), error);
      process.exit(1);
    }
  });

// Handle Default Interactive Mode
if (process.argv.length <= 2) {
  interactive.start();
} else {
  program.parse();
}
