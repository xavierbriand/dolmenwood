
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

// Configuration
const IGNORED_FILES = ['.DS_Store', 'node_modules'];
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.ico'];

interface Violation {
  file: string;
  line: number;
  term: string;
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

function getForbiddenTerms(): string[] {
  const terms: Set<string> = new Set();
  const assetFiles = getAllFiles(ASSETS_DIR);

  console.log(`🔍 Scanning ${assetFiles.length} asset files for forbidden terms...`);

  assetFiles.forEach((file) => {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) return;
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = yaml.load(content);
      
      // Extract names from arrays of objects (common pattern in this project)
      if (Array.isArray(data)) {
        data.forEach((item: unknown) => {
          if (typeof item === 'object' && item !== null && 'name' in item) {
            const namedItem = item as { name: unknown };
            if (typeof namedItem.name === 'string') {
              terms.add(namedItem.name);
            }
          }
        });
      } else if (typeof data === 'object' && data !== null) {
        const obj = data as { name?: unknown };
        if (obj.name && typeof obj.name === 'string') {
          terms.add(obj.name);
        }
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse ${file}:`, e);
    }
  });

  return Array.from(terms).filter(t => t.length > 3); // Filter out short common words
}

function scanCodebase(forbiddenTerms: string[]): Violation[] {
  const violations: Violation[] = [];
  const sourceFiles = getAllFiles(PACKAGES_DIR);

  console.log(`🔍 Scanning ${sourceFiles.length} source files for IP violations...`);

  sourceFiles.forEach((file) => {
    // Skip binary files or likely non-source
    if (IGNORED_EXTENSIONS.includes(path.extname(file))) return;
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check 1: Direct reference to assets folder
      if (line.includes('assets/') && !line.includes('IP_POLICY_EXCEPTION')) {
         violations.push({
           file: path.relative(ROOT_DIR, file),
           line: index + 1,
           term: 'assets/ directory reference',
           context: line.trim()
         });
         return;
      }

      // Check 2: Forbidden Terms
      for (const term of forbiddenTerms) {
        // Simple case-sensitive check, can be improved with regex boundary
        // We use a regex to ensure we match whole words if possible, or at least significant parts
        // Escaping regex special chars in term
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedTerm, 'g');
        
        if (regex.test(line)) {
            // Allow exceptions via comment
            if (line.includes('IP_POLICY_EXCEPTION')) continue;

            violations.push({
              file: path.relative(ROOT_DIR, file),
              line: index + 1,
              term: term,
              context: line.trim()
            });
            break; // Report one violation per line max
        }
      }
    });
  });

  return violations;
}

// Main Execution
try {
  console.log('🛡️  Starting Creator Warden IP Compliance Scan...');
  
  const forbiddenTerms = getForbiddenTerms();
  console.log(`📝 Identified ${forbiddenTerms.length} forbidden terms from Assets.`);
  if (forbiddenTerms.length > 0) {
      console.log(`   (Examples: ${forbiddenTerms.slice(0, 3).join(', ')}...)`);
  }

  const violations = scanCodebase(forbiddenTerms);

  if (violations.length > 0) {
    console.error(`\n❌ IP VALIDATION FAILED: Found ${violations.length} violations!`);
    console.error('   The following files reference proprietary assets or forbidden terms:');
    violations.forEach(v => {
      console.error(`   - ${v.file}:${v.line} -> Found "${v.term}"`);
      console.error(`     Context: ${v.context}`);
    });
    console.error('\n   ACTION REQUIRED: Remove references to proprietary content in packages/.');
    console.error('   If this is a false positive, append // IP_POLICY_EXCEPTION to the line.');
    process.exit(1);
  } else {
    console.log('\n✅ IP Compliance Scan Passed. No violations found.');
    process.exit(0);
  }
} catch (error) {
  console.error('🔥 Fatal Error during scan:', error);
  process.exit(1);
}
