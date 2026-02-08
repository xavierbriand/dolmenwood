
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const IGNORED_FILES = ['.DS_Store', 'node_modules'];

// Terms that are found in assets but are considered structural/architectural
// and are therefore safe to use in code (e.g. table names used for lookups).
const SAFE_TERMS = [
  'Activity',
  'Reaction',
];

const SAFE_PREFIXES = [
  'Encounter Type -',
  'Common -',
  'Regional -'
];

export interface ForbiddenTerm {
  original: string;
  regex: RegExp;
}

export interface Violation {
  file: string;
  line: number;
  term: string;
  matchedStr: string;
  context: string;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    if (IGNORED_FILES.includes(file)) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

export function generateRegexForTerm(term: string): RegExp {
  if (/[\s\-_]/.test(term)) {
    const parts = term.split(/[\s\-_]+/);
    const pattern = parts
      .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\-_]+');
    return new RegExp(pattern, 'i');
  } else {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'g');
  }
}

export function getForbiddenTerms(): ForbiddenTerm[] {
  const terms: Set<string> = new Set();
  const assetFiles = getAllFiles(ASSETS_DIR);
  
  assetFiles.forEach((file) => {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) return;
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = yaml.load(content);
      if (Array.isArray(data)) {
        data.forEach((item: unknown) => {
          if (typeof item === 'object' && item !== null && 'name' in item) {
            const namedItem = item as { name: unknown };
            if (typeof namedItem.name === 'string') terms.add(namedItem.name);
          }
        });
      } else if (typeof data === 'object' && data !== null) {
        const obj = data as { name?: unknown };
        if (obj.name && typeof obj.name === 'string') terms.add(obj.name);
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse ${file}:`, e);
    }
  });

  return Array.from(terms)
    .filter(t => t.length > 3)
    .filter(t => !SAFE_TERMS.includes(t))
    .filter(t => !SAFE_PREFIXES.some(prefix => t.startsWith(prefix)))
    .map(t => ({
      original: t,
      regex: generateRegexForTerm(t)
    }));
}
