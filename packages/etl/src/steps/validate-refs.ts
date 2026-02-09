import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { PATHS } from '../config.js';

interface EncounterTable {
  table: string;
  entries: {
    min: number;
    max: number;
    result: string;
  }[];
}

interface CreatureData {
  name: string;
}

/**
 * Validates consistency between Encounter Tables and the Creature Bestiary.
 * Checks if every creature referenced in the encounters exists in the loaded creature data.
 */
export async function validateReferences(): Promise<void> {
  console.log(chalk.cyan('\n🔍 Validating Data Consistency...'));

  // 1. Load Generated Creature Data
  if (!fs.existsSync(PATHS.CREATURES_YAML)) {
    console.log(
      chalk.red(
        `❌ Creatures file not found at ${PATHS.CREATURES_YAML}. Run 'load' step first.`,
      ),
    );
    return;
  }

  const creaturesYaml = await fs.readFile(PATHS.CREATURES_YAML, 'utf-8');
  // creatures.yaml is an array of objects directly, or an object with a root key?
  // Let's check assets/creatures.yaml format.
  // Based on AC4, it should be an array or object.
  // The error "creatures.creatures is undefined" suggests it's just an array at the root.
  const creaturesData = yaml.load(creaturesYaml) as CreatureData[];

  // Create a Set of normalized creature names for fast lookup
  const creatureNames = new Set(
    Array.isArray(creaturesData)
      ? creaturesData.map((c) => normalizeName(c.name))
      : [], // Handle case where file might be empty or wrong structure
  );
  console.log(
    chalk.gray(`Loaded ${creatureNames.size} creatures from bestiary.`),
  );

  // 2. Load Encounter Tables
  // We have multiple encounter files in assets/: common-encounters.yaml and regional-encounters.yaml
  const encounterFiles = ['common-encounters.yaml', 'regional-encounters.yaml'];
  const encounterReferences = new Set<string>();

  for (const file of encounterFiles) {
    const filePath = path.join(PATHS.ENCOUNTERS_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = yaml.load(content);
      extractCreatureReferences(data, encounterReferences);
    }
  }

  console.log(
    chalk.gray(
      `Found ${encounterReferences.size} unique references in encounter tables.`,
    ),
  );

  // 3. Compare and Report
  let missingCount = 0;
  const missingRefs: string[] = [];

  for (const ref of encounterReferences) {
    if (!creatureNames.has(normalizeName(ref)) && !isGenericRef(ref)) {
      missingCount++;
      missingRefs.push(ref);
    }
  }

  if (missingCount > 0) {
    console.log(
      chalk.yellow(`\n⚠️  Found ${missingCount} missing creature definitions:`),
    );
    missingRefs.sort().forEach((ref) => {
      console.log(chalk.yellow(`   - [ ] ${ref}`));
    });
    console.log(
      chalk.yellow(
        `\nThese creatures are referenced in encounters but missing from 'assets/creatures.yaml'.`,
      ),
    );
    console.log(
      chalk.gray(
        `This may be due to parsing errors, naming mismatches, or they are not yet in the DMB PDF.`,
      ),
    );
  } else {
    console.log(
      chalk.green(`\n✅ All encounter references resolve to valid creatures!`),
    );
  }

  // 4. Reverse Check: Creatures not used in encounters
  const normalizedRefs = new Set<string>();
  encounterReferences.forEach((ref) => normalizedRefs.add(normalizeName(ref)));

  const unused: string[] = [];
  if (Array.isArray(creaturesData)) {
    creaturesData.forEach((c) => {
      if (!normalizedRefs.has(normalizeName(c.name))) {
        unused.push(c.name);
      }
    });
  }

  if (unused.length > 0) {
    console.log(
      chalk.blue(`\nℹ️  Found ${unused.length} unreferenced creatures:`),
    );
    unused.sort().forEach((name) => {
      console.log(chalk.blue(`   - ${name}`));
    });
    console.log(
      chalk.gray(
        `\nThese creatures exist in the bestiary but are not currently used in any encounter table.`,
      ),
    );
  } else {
    console.log(
      chalk.green(
        `\n✅ All bestiary creatures are used in at least one encounter!`,
      ),
    );
  }
}

/**
 * Normalizes a creature name for comparison (lowercase, trimmed).
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Recursive function to find 'result' fields in the encounters object.
 * This is a heuristic approach since the encounters YAML structure might vary.
 */
function extractCreatureReferences(obj: any, refs: Set<string>) {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractCreatureReferences(item, refs));
    return;
  }

  // Check if this object looks like an encounter entry
  if ('ref' in obj && typeof obj.ref === 'string') {
    // Basic filter to avoid non-creature results like "Roll on subtable" or empty strings
    const res = obj.ref.trim();
    if (res && !res.startsWith('Roll on') && !res.startsWith('See')) {
      refs.add(res);
    }
  }

  // Recurse into all values
  for (const key of Object.keys(obj)) {
    extractCreatureReferences(obj[key], refs);
  }
}

/**
 * Checks if a reference is likely a generic term or instruction rather than a specific creature name.
 * This helps reduce noise in the report.
 */
function isGenericRef(ref: string): boolean {
  const generics = [
    'npc',
    'adventurer',
    'adventuring party',
    'animal',
    'monster',
    'corpse',
    'none',
    'special',
    'talking animal',
  ];
  return generics.includes(ref.toLowerCase());
}
