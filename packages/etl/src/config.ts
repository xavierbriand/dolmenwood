import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the monorepo (packages/etl/src -> packages/etl -> packages -> root)
export const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export const PATHS = {
  // Source PDF (User provided)
  PDF_SOURCE: path.join(PROJECT_ROOT, 'tmp/etl/DMB.pdf'),

  // Intermediate Files (Git ignored)
  TMP_DIR: path.join(PROJECT_ROOT, 'tmp/etl'),
  RAW_TEXT: path.join(PROJECT_ROOT, 'tmp/etl/dmb-raw.txt'),
  INTERMEDIATE_JSON: path.join(
    PROJECT_ROOT,
    'tmp/etl/creatures-intermediate.json',
  ),

  // Target Asset File
  CREATURES_YAML: path.join(PROJECT_ROOT, 'assets/creatures.yaml'),

  // Encounter Tables (for consistency check)
  ENCOUNTERS_DIR: path.join(PROJECT_ROOT, 'assets'),
};
