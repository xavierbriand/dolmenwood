/**
 * IP Compliance Check (Pre-commit hook)
 *
 * Scans staged files for chunks of content reproduced verbatim from the
 * Dolmenwood source book PDFs. Protects against accidental inclusion of
 * copyrighted passages in the public repository.
 *
 * Usage:
 *   pnpm tsx scripts/ip-check.ts          # Scan staged files only (pre-commit)
 *   pnpm tsx scripts/ip-check.ts --all    # Scan all source files (CI / manual)
 *
 * - Requires etl/output/extract/*-raw.txt files (raw PDF text) to be present locally.
 *   Generate them with: pnpm --filter @dolmenwood/etl start extract-text
 * - Skips gracefully if no source material is available (e.g., in CI).
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
  getStagedFiles,
  readStagedContent,
  isProtectedPath,
  MIN_CHUNK_LENGTH,
  type ContentViolation,
} from './ip-check-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const IGNORED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.ico']);

function scanContent(
  content: string,
  relPath: string,
  normalizedSource: string,
): ContentViolation[] {
  const violations: ContentViolation[] = [];
  const lines = content.split('\n');

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

function reportViolations(violations: ContentViolation[]): void {
  console.error(`\n⚠️  Content violations found: ${violations.length}`);
  console.error(
    '   The following lines contain text reproduced from the source material:\n',
  );

  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}`);
    console.error(
      `   Matched: "${v.matchedChunk.slice(0, 80)}${v.matchedChunk.length > 80 ? '...' : ''}"`,
    );
    console.error(`   Context: ${v.context.slice(0, 120)}`);
    console.error('');
  }

  console.error('❌ IP check failed. Remove or rephrase the flagged content.');
  console.error('   Tip: Use generic test data instead of text from the book.');
}

// Main execution
(() => {
  const scanAll = process.argv.includes('--all');
  const mode = scanAll ? 'full scan' : 'staged files';

  console.log(`🛡️  IP Compliance Check (${mode})...`);

  const normalizedSource = loadSourceMaterial();
  if (!normalizedSource) {
    console.log(
      'ℹ️  Source material (etl/output/extract/*-raw.txt) not found. Skipping check.',
    );
    console.log('   Run: pnpm --filter @dolmenwood/etl start extract-text');
    process.exit(0);
  }

  console.log(
    `📖 Source material loaded (${Math.round(normalizedSource.length / 1024)}KB, threshold: ${MIN_CHUNK_LENGTH} chars).`,
  );

  const allViolations: ContentViolation[] = [];

  if (scanAll) {
    // Full scan: walk all protected directories
    const SCAN_DIRS = [
      path.join(ROOT_DIR, 'packages', 'core'),
      path.join(ROOT_DIR, 'packages', 'data'),
      path.join(ROOT_DIR, 'packages', 'cli'),
      path.join(ROOT_DIR, 'scripts'),
      path.join(ROOT_DIR, '_bmad-output'),
    ];

    const sourceFiles: string[] = [];
    for (const dir of SCAN_DIRS) {
      sourceFiles.push(...getAllFiles(dir));
    }

    console.log(
      `🔍 Scanning ${sourceFiles.length} source files (packages/etl/ excluded)...`,
    );

    for (const filePath of sourceFiles) {
      if (IGNORED_EXTENSIONS.has(path.extname(filePath))) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const relPath = path.relative(ROOT_DIR, filePath);
      allViolations.push(...scanContent(content, relPath, normalizedSource));
    }
  } else {
    // Pre-commit: scan only staged files
    const stagedFiles = getStagedFiles();

    if (stagedFiles.length === 0) {
      console.log('   No staged files in protected scope. Nothing to check.');
      process.exit(0);
    }

    console.log(`🔍 Scanning ${stagedFiles.length} staged file(s)...`);

    for (const relPath of stagedFiles) {
      if (IGNORED_EXTENSIONS.has(path.extname(relPath))) continue;
      const content = readStagedContent(relPath);
      allViolations.push(...scanContent(content, relPath, normalizedSource));
    }
  }

  if (allViolations.length > 0) {
    reportViolations(allViolations);
    process.exit(1);
  }

  console.log(
    '\n✅ IP Compliance Check passed. No content reproduced from source material.',
  );
  process.exit(0);
})();
