
import path from 'path';
import { fileURLToPath } from 'url';
import { YamlTableRepository } from '../packages/data/src/repositories/YamlTableRepository.js';
import { Table } from '../packages/core/src/schemas/tables.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_PATH = path.resolve(__dirname, '../assets');

async function verify() {
  console.log('Verifying YAML Data in:', ASSETS_PATH);
  
  const repo = new YamlTableRepository(ASSETS_PATH);
  
  const tablesToVerify = [
    'Encounter Type - Daytime - Road',
    'Encounter Type - Daytime - Wild',
    'Encounter Type - Nighttime - Fire',
    'Encounter Type - Nighttime - No Fire',
    'Common - Animal',
    'Common - Monster',
    'Common - Mortal',
    'Common - Sentient',
    'Regional - High Wold',
    'Regional - Aldweald',
    'Activity',
    'Reaction'
  ];

  let errors = 0;

  for (const tableName of tablesToVerify) {
    process.stdout.write(`Checking '${tableName}'... `);
    const result = await repo.getTable(tableName);
    
    if (result.kind === 'success') {
      const table = result.data;
      console.log('OK', `(${table.entries.length} entries)`);
      
      // Basic sanity checks
      if (table.entries.length === 0) {
        console.error('  Error: Table has 0 entries');
        errors++;
      }
      
      // Check die format
      if (!/^\d+d\d+$/.test(table.die)) {
         console.error(`  Error: Invalid die format '${table.die}'`);
         errors++;
      }

    } else {
      console.log('FAIL');
      console.error(`  Error: ${result.error.message}`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\nVerification failed with ${errors} errors.`);
    process.exit(1);
  } else {
    console.log('\nAll tables verified successfully.');
    process.exit(0);
  }
}

verify().catch(console.error);
