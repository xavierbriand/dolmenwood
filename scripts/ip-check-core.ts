
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

const DENYLIST_PATH = path.join(ROOT_DIR, 'policies', 'ip-denylist.yaml');
const STATE_PATH = path.join(ROOT_DIR, 'policies', 'ip-state.json');

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

function getNewestAssetTimestamp(): number {
  if (!fs.existsSync(ASSETS_DIR)) return 0;
  let maxTime = 0;
  const files = fs.readdirSync(ASSETS_DIR);
  files.forEach(file => {
      const fullPath = path.join(ASSETS_DIR, file);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs > maxTime) maxTime = stat.mtimeMs;
  });
  return maxTime;
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
  // 1. Check for staleness (Skip in CI environment)
  if (!process.env.CI && fs.existsSync(STATE_PATH) && fs.existsSync(ASSETS_DIR)) {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      const lastReview = new Date(state.lastReviewed).getTime();
      const newestAsset = getNewestAssetTimestamp();
      
      // Allow 1 second buffer for file system variances
      if (newestAsset > lastReview + 1000) {
          console.error('❌ IP Safety Check Failed: Assets have been modified since the last IP Review.');
          console.error('   Please run `npm run ip:scan` to update the denylist.');
          process.exit(1);
      }
  } else if (fs.existsSync(ASSETS_DIR)) {
      // Assets exist but no state file -> never reviewed
      console.warn('⚠️  IP State file missing. Assuming first run or unverified state.');
  }

  // 2. Load Denylist
  if (!fs.existsSync(DENYLIST_PATH)) {
      console.warn('⚠️  No IP Denylist found. Skipping checks.');
      return [];
  }

  try {
      const content = fs.readFileSync(DENYLIST_PATH, 'utf8');
      const data = yaml.load(content) as { terms: string[] };
      const terms = data.terms || [];
      
      return terms.map(t => ({
          original: t,
          regex: generateRegexForTerm(t)
      }));
  } catch (e) {
      console.error('❌ Failed to load IP Denylist:', e);
      process.exit(1);
  }
}
