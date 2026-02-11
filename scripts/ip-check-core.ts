/**
 * IP Compliance Core
 *
 * Content-level IP protection: detects when chunks of the original Dolmenwood
 * Monster Book PDF text are reproduced verbatim in source files.
 *
 * This is NOT about individual words or creature names -- it's about preventing
 * meaningful passages of copyrighted content from leaking into the public repo.
 *
 * The source material is the raw PDF text at tmp/etl/dmb-raw.txt.
 * If the file is not present (e.g., in CI), the check is skipped gracefully.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SOURCE_MATERIAL_PATH = path.join(ROOT_DIR, 'tmp', 'etl', 'dmb-raw.txt');

/** Minimum character length for a match to be considered a violation. */
export const MIN_CHUNK_LENGTH = 40;

export interface ContentViolation {
  file: string;
  line: number;
  matchedChunk: string;
  context: string;
}

/**
 * Normalize text for comparison: collapse whitespace, lowercase.
 * This avoids false negatives from minor formatting differences
 * (extra spaces, line breaks, casing changes).
 */
export function normalizeForComparison(text: string): string {
  return text.replace(/\s+/g, ' ').toLowerCase().trim();
}

/**
 * Load and normalize the source material (PDF raw text).
 * Returns null if the file is not available.
 */
export function loadSourceMaterial(): string | null {
  if (!fs.existsSync(SOURCE_MATERIAL_PATH)) {
    return null;
  }
  const raw = fs.readFileSync(SOURCE_MATERIAL_PATH, 'utf8');
  return normalizeForComparison(raw);
}

/**
 * Check a single line of source code against the normalized source material.
 * Returns the matched chunk if a violation is found, or null otherwise.
 *
 * Strategy: normalize the line, then check if any contiguous substring of
 * MIN_CHUNK_LENGTH+ characters appears in the source material.
 *
 * We check the full line first (fast path), then slide a window of
 * MIN_CHUNK_LENGTH across the line. This is efficient because each
 * `includes()` call is a single scan of the source material, and we
 * only need to find one match, not the longest.
 */
export function findContentMatch(
  normalizedLine: string,
  normalizedSource: string,
): string | null {
  if (normalizedLine.length < MIN_CHUNK_LENGTH) {
    return null;
  }

  // Fast path: check if the entire line appears in the source
  if (normalizedSource.includes(normalizedLine)) {
    return normalizedLine;
  }

  // Sliding window at MIN_CHUNK_LENGTH: find any matching chunk
  for (
    let start = 0;
    start + MIN_CHUNK_LENGTH <= normalizedLine.length;
    start++
  ) {
    const chunk = normalizedLine.slice(start, start + MIN_CHUNK_LENGTH);
    if (normalizedSource.includes(chunk)) {
      return chunk;
    }
  }

  return null;
}

/**
 * Collect all source files from a directory, recursively.
 * Skips node_modules, dist, and .git directories.
 */
export function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
  const SKIP_FILES = new Set(['.DS_Store']);

  for (const file of fs.readdirSync(dir)) {
    if (SKIP_FILES.has(file)) continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}
