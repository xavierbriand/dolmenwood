#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { EncounterGenerator, DefaultRandomProvider } from '@dolmenwood/core';
import { YamlTableRepository, YamlCreatureRepository } from '@dolmenwood/data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve assets path relative to the built file (dist/index.js)
// In dev: packages/cli/dist/index.js -> ../../../assets (root/assets)
const ASSETS_PATH = path.resolve(__dirname, '../../../assets');

const program = new Command();

program
  .name('deg')
  .description('Dolmenwood Encounter Generator')
  .version('0.0.1');

program
  .command('encounter')
  .argument('<region_id>', 'ID of the region (e.g. "forest")')
  .option('-t, --time <time>', 'Time of day (Day or Night)', 'Day')
  .option('--terrain <terrain>', 'Terrain type (Road or Off-road)', 'Off-road')
  .option('-c, --camping', 'Is the party camping?', false)
  .description('Generate a random encounter for a specific region context')
  .action(async (regionId, options) => {
    try {
      // 1. Setup Dependencies
      const tableRepo = new YamlTableRepository(ASSETS_PATH);
      const creatureRepo = new YamlCreatureRepository(ASSETS_PATH);
      const random = new DefaultRandomProvider();
      const generator = new EncounterGenerator(tableRepo, creatureRepo, random);

      // 2. Build Context
      // Validate inputs minimally (zod schema in core handles strict validation)
      const context = {
        regionId,
        timeOfDay: options.time as 'Day' | 'Night',
        terrain: options.terrain as 'Road' | 'Off-road',
        camping: !!options.camping
      };

      console.log(chalk.blue(`Generating encounter for region: ${chalk.bold(regionId)}`));
      console.log(chalk.dim(`Context: ${options.time}, ${options.terrain}, Camping: ${options.camping}`));

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
      
      console.log(`${chalk.bold('Summary:')} ${chalk.white(encounter.summary)}`);
      console.log(`${chalk.bold('Type:')}    ${encounter.type}`);
      
      if (encounter.details.distance) {
        console.log(`${chalk.bold('Distance:')} ${encounter.details.distance}`);
      }
      
      if (encounter.details.surprise) {
        let color = chalk.white;
        if (encounter.details.surprise.includes('Players surprised')) color = chalk.yellow;
        if (encounter.details.surprise.includes('Both')) color = chalk.magenta;
        console.log(`${chalk.bold('Surprise:')} ${color(encounter.details.surprise)}`);
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
        console.log(`${chalk.dim('Stats:')} AC ${c.armourClass}, HD ${c.hitDice}, MV ${c.movement}, Morale ${c.morale}`);
        console.log(`${chalk.dim('Attacks:')} ${c.attacks.join(', ')}`);
        
        console.log(`${chalk.dim('Align:')} ${c.alignment}  ${chalk.dim('Level:')} ${c.level}  ${chalk.dim('XP:')} ${c.xp}`);
        
        if (c.description) {
            console.log('\n' + chalk.italic(c.description));
        }
      }

      console.log('==================================================');

    } catch (error) {
      console.error(chalk.red('Unexpected error:'), error);
      process.exit(1);
    }
  });

program.parse();
