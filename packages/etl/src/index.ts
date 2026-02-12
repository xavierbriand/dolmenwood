import { Command } from 'commander';
import fs from 'node:fs/promises';
import { PATHS } from './config.js';
import { loadCreatures } from './steps/load.js';
import { validateReferences } from './steps/validate-refs.js';
import { transformV2 } from './steps/transform-v2.js';

const program = new Command();

program
  .name('dolmenwood-etl')
  .description('ETL pipeline for Dolmenwood Monster Book')
  .version('0.0.1');

async function cleanTmp() {
  console.log('Cleaning temporary files...');
  try {
    await fs.rm(PATHS.TMP_DIR, { recursive: true, force: true });
    console.log('Cleaned tmp/etl/');
  } catch (error) {
    console.error('Failed to clean:', error);
  }
}

program
  .command('clean')
  .description('Remove intermediate files in tmp/etl')
  .action(async () => {
    await cleanTmp();
  });

program
  .command('transform')
  .description(
    'Transform Python-extracted JSON into creatures (mapper pipeline)',
  )
  .action(async () => {
    try {
      console.log('Step 1: Transforming via mapper pipeline...');
      await transformV2();
      console.log('Transform complete.');
    } catch (error) {
      console.error('Transform failed:', error);
      process.exit(1);
    }
  });

program
  .command('load')
  .description('Validate and load JSON to YAML assets')
  .action(async () => {
    try {
      console.log('Step 2: Loading...');
      await loadCreatures();

      // Auto-run validation after load
      await validateReferences();
    } catch (error) {
      console.error('Load failed:', error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Check consistency between Encounters and Bestiary')
  .action(async () => {
    await validateReferences();
  });

program
  .command('all')
  .description('Run full ETL pipeline (assumes Python extractor has been run)')
  .option('-c, --clean', 'Clean temporary files before starting')
  .action(async (options) => {
    try {
      if (options.clean) {
        await cleanTmp();
      }

      // 1. Transform (Python JSON -> creatures.json)
      console.log('Step 1: Transforming via mapper pipeline...');
      await transformV2();

      // 2. Load (creatures.json -> YAML assets)
      console.log('Step 2: Loading...');
      await loadCreatures();

      // 3. Verify
      await validateReferences();

      console.log('\nPipeline Complete!');
    } catch (error) {
      console.error('\nPipeline Failed:', error);
      process.exit(1);
    }
  });

program.parse();
