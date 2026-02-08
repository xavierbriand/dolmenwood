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
  .argument('<table_name>', 'Name of the table to roll on (e.g. "Forest - Day")')
  .description('Generate a random encounter from a region table')
  .action(async (tableName) => {
    try {
      // 1. Setup Dependencies
      const tableRepo = new YamlTableRepository(ASSETS_PATH);
      const creatureRepo = new YamlCreatureRepository(ASSETS_PATH);
      const random = new DefaultRandomProvider();
      const generator = new EncounterGenerator(tableRepo, creatureRepo, random);

      // 2. Generate
      console.log(chalk.blue(`Rolling on table: ${chalk.bold(tableName)}...`));
      const result = await generator.generate(tableName);

      // 3. Output
      if (result.kind === 'failure') {
        console.error(chalk.red('Error:'), result.error.message);
        process.exit(1);
      }

      const encounter = result.data;
      console.log(chalk.green('Success!'));
      console.log('---');

      if (encounter.kind === 'creature') {
        const c = encounter.creature;
        console.log(`${chalk.bold.yellow(encounter.count)} x ${chalk.bold.yellow(c.name)}`);
        console.log(`Stats: AC ${c.armourClass}, HD ${c.hitDice}, MV ${c.movement}`);
        console.log(`Attacks: ${c.attacks.join(', ')}`);
        if (c.description) console.log(chalk.italic(c.description));
      } else {
        console.log(chalk.bold(encounter.name));
        console.log(encounter.description);
      }
      
      console.log('---');

    } catch (error) {
      console.error(chalk.red('Unexpected error:'), error);
      process.exit(1);
    }
  });

program.parse();
