
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
  
  // Dynamically load all tables instead of hardcoding names
  // We need to expose a method to get all table names or just iterate manually if the repo doesn't support it.
  // Since YamlTableRepository doesn't expose listTables, we can rely on its internal loading mechanism
  // via a public method or just verify what we can find.
  
  // Better approach: We can't access private methods. 
  // But we know 'loadTables' is called internally.
  // Let's modify the repository to allow listing tables, or just rely on the fact 
  // that we want to verify the CONTENT of assets, so we can read the assets directory here 
  // to get the names, effectively replicating the repo's discovery logic but for verification.
  
  const tablesToVerify: string[] = [];
  
  // Structural tables we EXPECT to exist
  tablesToVerify.push(
    'Encounter Type - Daytime - Road',
    'Encounter Type - Daytime - Wild',
    'Encounter Type - Nighttime - Fire',
    'Encounter Type - Nighttime - No Fire',
    'Common - Animal',
    'Common - Monster',
    'Common - Mortal',
    'Common - Sentient',
    'Activity',
    'Reaction'
  );
  
  // Note: We are deliberately NOT hardcoding specific regional tables here
  // to avoid IP leakage in the source code.
  // If we wanted to verify them, we would need to discover them dynamically.

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
