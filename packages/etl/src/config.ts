import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the monorepo (packages/etl/src -> packages/etl -> packages -> root)
export const PROJECT_ROOT = path.resolve(__dirname, '../../../');

// ETL directory structure
const ETL_DIR = path.join(PROJECT_ROOT, 'etl');
const INPUT_DIR = path.join(ETL_DIR, 'input');
const OUTPUT_DIR = path.join(ETL_DIR, 'output');
const EXTRACT_DIR = path.join(OUTPUT_DIR, 'extract');
const TRANSFORM_DIR = path.join(OUTPUT_DIR, 'transform');
const LOAD_DIR = path.join(OUTPUT_DIR, 'load');

const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');

export const PATHS = {
  // Directory roots
  ETL_DIR,
  INPUT_DIR,
  OUTPUT_DIR,
  EXTRACT_DIR,
  TRANSFORM_DIR,
  LOAD_DIR,

  // Source PDFs (etl/input/)
  DMB_PDF: path.join(INPUT_DIR, 'DMB.pdf'),
  DCB_PDF: path.join(INPUT_DIR, 'DCB.pdf'),

  // Python scripts (packages/etl/scripts/)
  EXTRACT_RAW_TEXT_SCRIPT: path.join(
    PROJECT_ROOT,
    'packages',
    'etl',
    'scripts',
    'extract_raw_text.py',
  ),
  PY_EXTRACT_DMB: path.join(
    PROJECT_ROOT,
    'packages',
    'etl',
    'scripts',
    'extract_dmb.py',
  ),
  PY_EXTRACT_DCB_TREASURE: path.join(
    PROJECT_ROOT,
    'packages',
    'etl',
    'scripts',
    'extract_dcb_treasure.py',
  ),

  // Extract phase output (etl/output/extract/)
  PY_BESTIARY_JSON: path.join(EXTRACT_DIR, 'dmb-bestiary.json'),
  PY_ANIMALS_JSON: path.join(EXTRACT_DIR, 'dmb-animals.json'),
  PY_MORTALS_JSON: path.join(EXTRACT_DIR, 'dmb-mortals.json'),
  PY_ADVENTURERS_JSON: path.join(EXTRACT_DIR, 'dmb-adventurers.json'),
  PY_FACTIONS_JSON: path.join(EXTRACT_DIR, 'dmb-factions.json'),
  PY_DCB_TREASURE_JSON: path.join(EXTRACT_DIR, 'dcb-treasure-tables.json'),

  // Transform phase output (etl/output/transform/)
  INTERMEDIATE_JSON: path.join(TRANSFORM_DIR, 'creatures.json'),

  // Load phase output (etl/output/load/)
  CREATURES_YAML: path.join(LOAD_DIR, 'creatures', 'creatures.yaml'),
  TREASURE_TABLES_JSON: path.join(
    LOAD_DIR,
    'treasure-tables',
    'treasure-tables.json',
  ),

  // Assets (hand-authored encounter tables + symlinks to ETL outputs)
  ENCOUNTERS_DIR: ASSETS_DIR,
};
