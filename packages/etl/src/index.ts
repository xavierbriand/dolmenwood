import { Command } from 'commander';
import fs from 'node:fs/promises';
import { PATHS } from './config.js';
import { extractText } from './steps/extract.js';
import { loadCreatures } from './steps/load.js';
import { validateReferences } from './steps/validate-refs.js';
import {
  normalizeText,
  mergeBestiaryPages,
  transformBestiary,
  transformAnimals,
  transformMortals,
} from './steps/transform.js';

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
      const text = await fs.readFile(PATHS.RAW_TEXT, 'utf-8');
      const { normalizedText, pages, toc } = normalizeText(text);

      await fs.writeFile(PATHS.NORMALIZED_TEXT, normalizedText, 'utf-8');
      await fs.writeFile(
        PATHS.CREATURE_PAGES,
        JSON.stringify(pages, null, 2),
        'utf-8',
      );
      await fs.writeFile(PATHS.TOC_JSON, JSON.stringify(toc, null, 2), 'utf-8');

      // BRANCH: Bestiary
      console.log('Step 2a: Processing Bestiary Branch...');
      const bestiaryMerged = mergeBestiaryPages(pages, toc);
      await fs.writeFile(
        PATHS.BESTIARY_MERGED,
        JSON.stringify(bestiaryMerged, null, 2),
        'utf-8',
      );

      const bestiaryCreatures = transformBestiary(bestiaryMerged);

      // BRANCH: Animals
      console.log('Step 2b: Processing Animals Branch...');
      const animals = transformAnimals(normalizedText);
      await fs.writeFile(
        PATHS.ANIMALS_JSON,
        JSON.stringify(animals, null, 2),
        'utf-8',
      );

      // BRANCH: Everyday Mortals
      console.log('Step 2c: Processing Everyday Mortals Branch...');
      const mortalNames = toc.appendices.everydayMortals.map((e) => e.name);
      const mortals = transformMortals(normalizedText, mortalNames);
      await fs.writeFile(
        PATHS.MORTALS_JSON,
        JSON.stringify(mortals, null, 2),
        'utf-8',
      );

      // Combine all creatures
      const allCreatures = [...bestiaryCreatures, ...animals, ...mortals];
      await fs.writeFile(
        PATHS.INTERMEDIATE_JSON,
        JSON.stringify(allCreatures, null, 2),
        'utf-8',
      );

      console.log(`Saved normalized text to: ${PATHS.NORMALIZED_TEXT}`);
      console.log(`Saved creature pages to: ${PATHS.CREATURE_PAGES}`);
      console.log(`Saved bestiary merged to: ${PATHS.BESTIARY_MERGED}`);
      console.log(`Saved animals JSON to: ${PATHS.ANIMALS_JSON}`);
      console.log(`Saved mortals JSON to: ${PATHS.MORTALS_JSON}`);
      console.log(
        `Saved ${allCreatures.length} creatures to: ${PATHS.INTERMEDIATE_JSON}`,
      );
      console.log(`Saved parsed TOC to: ${PATHS.TOC_JSON}`);
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
      const { normalizedText, pages, toc } = normalizeText(text);

      await fs.writeFile(PATHS.NORMALIZED_TEXT, normalizedText, 'utf-8');
      await fs.writeFile(
        PATHS.CREATURE_PAGES,
        JSON.stringify(pages, null, 2),
        'utf-8',
      );
      await fs.writeFile(PATHS.TOC_JSON, JSON.stringify(toc, null, 2), 'utf-8');

      // BRANCH: Bestiary
      console.log('Step 2a: Processing Bestiary Branch...');
      const bestiaryMerged = mergeBestiaryPages(pages, toc);
      await fs.writeFile(
        PATHS.BESTIARY_MERGED,
        JSON.stringify(bestiaryMerged, null, 2),
        'utf-8',
      );

      const bestiaryCreatures = transformBestiary(bestiaryMerged);

      // BRANCH: Animals
      console.log('Step 2b: Processing Animals Branch...');
      const animals = transformAnimals(normalizedText);
      await fs.writeFile(
        PATHS.ANIMALS_JSON,
        JSON.stringify(animals, null, 2),
        'utf-8',
      );

      // BRANCH: Everyday Mortals
      console.log('Step 2c: Processing Everyday Mortals Branch...');
      const mortalNamesAll = toc.appendices.everydayMortals.map((e) => e.name);
      const mortals = transformMortals(normalizedText, mortalNamesAll);
      await fs.writeFile(
        PATHS.MORTALS_JSON,
        JSON.stringify(mortals, null, 2),
        'utf-8',
      );

      console.log(`Saved parsed TOC to: ${PATHS.TOC_JSON}`);

      // Combine all creatures
      const allCreatures = [...bestiaryCreatures, ...animals, ...mortals];
      await fs.writeFile(
        PATHS.INTERMEDIATE_JSON,
        JSON.stringify(allCreatures, null, 2),
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
