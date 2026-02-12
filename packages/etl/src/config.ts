import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the monorepo (packages/etl/src -> packages/etl -> packages -> root)
export const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const TMP_DIR = path.join(PROJECT_ROOT, 'tmp/etl');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');

export const PATHS = {
  TMP_DIR: TMP_DIR,

  // Pipeline output (consumed by load step)
  INTERMEDIATE_JSON: path.join(TMP_DIR, 'creatures.json'),

  // Python extractor output (PyMuPDF)
  PY_BESTIARY_JSON: path.join(TMP_DIR, 'dmb-bestiary.json'),
  PY_ANIMALS_JSON: path.join(TMP_DIR, 'dmb-animals.json'),
  PY_MORTALS_JSON: path.join(TMP_DIR, 'dmb-mortals.json'),
  PY_ADVENTURERS_JSON: path.join(TMP_DIR, 'dmb-adventurers.json'),
  PY_FACTIONS_JSON: path.join(TMP_DIR, 'dmb-factions.json'),
  PY_DCB_TREASURE_JSON: path.join(TMP_DIR, 'dcb-treasure-tables.json'),

  // Target Asset File
  CREATURES_YAML: path.join(ASSETS_DIR, 'creatures.yaml'),

  // Encounter Tables
  ENCOUNTERS_DIR: ASSETS_DIR,
};
