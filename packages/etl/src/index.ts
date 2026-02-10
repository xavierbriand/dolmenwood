import { Command } from 'commander';
import fs from 'node:fs/promises';
import { PATHS } from './config.js';
import { extractText } from './steps/extract.js';
import { normalizeText } from './steps/transform.js';
import { loadCreatures } from './steps/load.js';
import { validateReferences } from './steps/validate-refs.js';

const program = new Command();

program
  .name('dolmenwood-etl')
  .description('ETL pipeline for Dolmenwood Monster Book')
  .version('0.0.1');

async function cleanTmp() {
  console.log('Cleaning temporary files...');
  try {
    await fs.rm(PATHS.TMP_DIR, { recursive: true, force: true });
    console.log('✅ Cleaned tmp/etl/');
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
  .command('extract')
  .description('Extract text from PDF to raw text file')
  .action(async () => {
    try {
      console.log('Step 1: Extracting...');
      await fs.mkdir(PATHS.TMP_DIR, { recursive: true });
      const text = await extractText();
      await fs.writeFile(PATHS.RAW_TEXT, text, 'utf-8');
      console.log(`Extraction complete. Saved to: ${PATHS.RAW_TEXT}`);
    } catch (error) {
      console.error('Extraction failed:', error);
      process.exit(1);
    }
  });

program
  .command('transform')
  .description('Transform raw text to intermediate JSON')
  .action(async () => {
    try {
      console.log('Step 2: Transforming...');
      const rawText = await fs.readFile(PATHS.RAW_TEXT, 'utf-8');
      const normalizedText = normalizeText(rawText);
      console.log(`Saved normalized text to: ${PATHS.NORMALIZED_TEXT}`);

      await fs.writeFile(PATHS.NORMALIZED_TEXT, normalizedText, 'utf-8');
      console.info('--- implementation not finished ---')
      process.exit(1);      
    } catch (error) {
      console.error('Transformation failed:', error);
      process.exit(1);
    }
  });

program
  .command('load')
  .description('Validate and load JSON to YAML assets')
  .action(async () => {
    try {
      console.log('Step 3: Loading...');
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
  .description('Run full ETL pipeline')
  .option('-c, --clean', 'Clean temporary files before starting')
  .action(async (options) => {
    try {
      if (options.clean) {
        await cleanTmp();
      }

      // 1. Extract
      console.log('Step 1: Extracting...');
      await fs.mkdir(PATHS.TMP_DIR, { recursive: true });
      const text = await extractText();
      await fs.writeFile(PATHS.RAW_TEXT, text, 'utf-8');

      // 2. Transform
      console.log('Step 2: Transforming...');
      const { blocks: creatures, normalizedText } = parseCreatures(text);

      await fs.writeFile(PATHS.NORMALIZED_TEXT, normalizedText, 'utf-8');
      await fs.writeFile(
        PATHS.INTERMEDIATE_JSON,
        JSON.stringify(creatures, null, 2),
        'utf-8',
      );

      // 3. Load
      console.log('Step 3: Loading...');
      await loadCreatures();

      // 4. Verify
      await validateReferences();

      console.log('\n🎉 Pipeline Complete!');
    } catch (error) {
      console.error('\n❌ Pipeline Failed:', error);
      process.exit(1);
    }
  });

program.parse();
