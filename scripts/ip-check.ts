
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import { getForbiddenTerms, ForbiddenTerm, Violation } from './ip-check-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const ALLOWLIST_PATH = path.join(ROOT_DIR, 'policies', 'ip-allowlist.yaml');
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.ico'];

// Duplicate helper locally since it's simple and avoids circular dependencies or complex exports
const IGNORED_FILES = ['.DS_Store', 'node_modules'];
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

interface AllowedException {
  file: string;
  term: string;
}

interface AllowList {
  exceptions: AllowedException[];
}

function getAllowList(): AllowedException[] {
  if (!fs.existsSync(ALLOWLIST_PATH)) return [];
  try {
    const content = fs.readFileSync(ALLOWLIST_PATH, 'utf8');
    const data = yaml.load(content) as AllowList;
    return data?.exceptions || [];
  } catch (e) {
    console.warn('⚠️  Failed to load allow list:', e);
    return [];
  }
}

function isAllowed(file: string, term: string, allowList: AllowedException[]): boolean {
  return allowList.some(ex => ex.file === file && ex.term === term);
}

function scanCodebase(forbiddenTerms: ForbiddenTerm[]): Violation[] {
  const violations: Violation[] = [];
  const sourceFiles = [
    ...getAllFiles(PACKAGES_DIR),
    ...getAllFiles(SCRIPTS_DIR)
  ];
  const allowList = getAllowList();

  console.log(`🔍 Scanning ${sourceFiles.length} source files for IP violations...`);
  console.log(`📋 Loaded ${allowList.length} allowed exceptions.`);

  sourceFiles.forEach((file) => {
    if (IGNORED_EXTENSIONS.includes(path.extname(file))) return;
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relativeFilePath = path.relative(ROOT_DIR, file);

    lines.forEach((line, index) => {
      // Check 1: Forbidden Terms
      for (const { original, regex } of forbiddenTerms) {
        const match = regex.exec(line);
        if (match) {
            if (isAllowed(relativeFilePath, original, allowList)) continue;
            violations.push({
              file: relativeFilePath,
              line: index + 1,
              term: original,
              matchedStr: match[0],
              context: line.trim()
            });
            break;
        }
        regex.lastIndex = 0;
      }
    });
  });

  return violations;
}

// Main Execution
(async () => {
  try {
    console.log('🛡️  Starting Creator Warden IP Compliance Scan (Codebase)...');
    
    const forbiddenTerms = getForbiddenTerms();
    console.log(`📝 Identified ${forbiddenTerms.length} forbidden terms from Assets.`);

    const violations = scanCodebase(forbiddenTerms);

    if (violations.length > 0) {
      console.error(`\n⚠️  Potential IP Violations Found: ${violations.length}`);
      
      const isInteractive = process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;
      const confirmedViolations: Violation[] = [];

      for (const v of violations) {
        console.log(`\n   File: ${v.file}:${v.line}`);
        console.log(`   Found: "${v.matchedStr}" (Matches Asset: "${v.term}")`);
        console.log(`   Context: ${v.context}`);

        if (isInteractive) {
           const { isViolation } = await inquirer.prompt([{
             type: 'confirm',
             name: 'isViolation',
             message: 'Is this a prohibited reference to Dolmenwood IP?',
             default: true
           }]);

           if (isViolation) {
             confirmedViolations.push(v);
           } else {
             console.log(`   ℹ️  To suppress this permanently, add the following to policies/ip-allowlist.yaml:`);
             console.log(`
  - file: ${v.file}
    term: ${v.term}
    reason: "Reviewed and approved by user"
`);
             console.log(`   ❌ You MUST add the exception to the allow list to pass CI.`);
             confirmedViolations.push(v);
           }
        } else {
          confirmedViolations.push(v);
        }
      }

      if (confirmedViolations.length > 0) {
        console.error(`\n❌ IP VALIDATION FAILED: ${confirmedViolations.length} confirmed violations.`);
        console.error('   ACTION REQUIRED: Remove references or add them to policies/ip-allowlist.yaml.');
        process.exit(1);
      }
    } else {
      console.log('\n✅ IP Compliance Scan Passed. No violations found.');
      process.exit(0);
    }
  } catch (error) {
    console.error('🔥 Fatal Error during scan:', error);
    process.exit(1);
  }
})();
