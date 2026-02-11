/**
 * IP Compliance Check (Pre-commit hook)
 *
 * Scans source files for chunks of content reproduced verbatim from the
 * Dolmenwood Monster Book PDF. Protects against accidental inclusion of
 * copyrighted passages in the public repository.
 *
 * - Requires tmp/etl/dmb-raw.txt (the raw PDF text) to be present locally.
 * - Skips gracefully if the source material is not available (e.g., in CI).
 * - Excludes packages/etl/ (ETL code inherently processes the source material).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadSourceMaterial,
  normalizeForComparison,
  findContentMatch,
  getAllFiles,
  MIN_CHUNK_LENGTH,
  type ContentViolation,
} from './ip-check-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'packages', 'core'),
  path.join(ROOT_DIR, 'packages', 'data'),
  path.join(ROOT_DIR, 'packages', 'cli'),
  path.join(ROOT_DIR, 'scripts'),
];

const IGNORED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.ico']);

function scanFile(
  filePath: string,
  normalizedSource: string,
  rootDir: string,
): ContentViolation[] {
  const violations: ContentViolation[] = [];

  if (IGNORED_EXTENSIONS.has(path.extname(filePath))) return violations;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(rootDir, filePath);

  for (let i = 0; i < lines.length; i++) {
    const normalizedLine = normalizeForComparison(lines[i]);
    const match = findContentMatch(normalizedLine, normalizedSource);
    if (match) {
      violations.push({
        file: relPath,
        line: i + 1,
        matchedChunk: match,
        context: lines[i].trim(),
      });
    }
  }

  return violations;
}

// Main execution
(() => {
  console.log('🛡️  IP Compliance Check: Content-level scan...');

  const normalizedSource = loadSourceMaterial();
  if (!normalizedSource) {
    console.log(
      'ℹ️  Source material (tmp/etl/dmb-raw.txt) not found. Skipping check.',
    );
    console.log(
      '   This is expected in CI. Run the ETL extract step locally to enable this check.',
    );
    process.exit(0);
  }

  console.log(
    `📖 Source material loaded (${Math.round(normalizedSource.length / 1024)}KB, threshold: ${MIN_CHUNK_LENGTH} chars).`,
  );

  // Collect all source files (excluding packages/etl/)
  const sourceFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    sourceFiles.push(...getAllFiles(dir));
  }

  console.log(
    `🔍 Scanning ${sourceFiles.length} source files (packages/etl/ excluded)...`,
  );

  const allViolations: ContentViolation[] = [];
  for (const file of sourceFiles) {
    const violations = scanFile(file, normalizedSource, ROOT_DIR);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error(`\n⚠️  Content violations found: ${allViolations.length}`);
    console.error(
      '   The following lines contain text reproduced from the source material:\n',
    );

    for (const v of allViolations) {
      console.error(`   ${v.file}:${v.line}`);
      console.error(
        `   Matched: "${v.matchedChunk.slice(0, 80)}${v.matchedChunk.length > 80 ? '...' : ''}"`,
      );
      console.error(`   Context: ${v.context.slice(0, 120)}`);
      console.error('');
    }

    console.error(
      '❌ IP check failed. Remove or rephrase the flagged content.',
    );
    console.error(
      '   Tip: Use generic test data instead of text from the book.',
    );
    process.exit(1);
  }

  console.log(
    '\n✅ IP Compliance Check passed. No content reproduced from source material.',
  );
  process.exit(0);
})();
