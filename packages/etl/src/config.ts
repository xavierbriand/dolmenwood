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

  // Source PDF (User provided)
  PDF_SOURCE: path.join(TMP_DIR, 'DMB.pdf'),

  // Intermediate Files
  RAW_TEXT: path.join(TMP_DIR, 'dmb-raw.txt'),
  NORMALIZED_TEXT: path.join(TMP_DIR, 'dmb-normalized.md'),
  
  // Target Asset File
  CREATURES_YAML: path.join(ASSETS_DIR, 'creatures.yaml'),

  // Encounter Tables
  ENCOUNTERS_DIR: ASSETS_DIR
};
