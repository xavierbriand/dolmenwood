import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { getForbiddenTerms } from './ip-check-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    if (file === 'node_modules' || file === 'dist' || file === '.git' || file === '.DS_Store') return;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

(async () => {
  console.log(chalk.bold.magenta('\n🎉 Welcome to the IP Check PARTY MODE! 🎉\n'));
  await delay(500);

  // 1. Load Terms
  console.log(chalk.blue('🔎 Loading forbidden magic words from assets...'));
  const forbiddenTerms = getForbiddenTerms();
  await delay(800);
  
  console.log(chalk.yellow(`\n📝 Found ${chalk.bold(forbiddenTerms.length)} terms that will trigger the alarm:`));
  
  // Show a few random terms for effect
  const sample = forbiddenTerms.slice(0, 5).map(t => t.original).join(', ');
  console.log(chalk.dim(`   (e.g., ${sample}...)`));
  await delay(1000);

  // 2. Scan Files
  console.log(chalk.cyan('\n🚀 Launching codebase scanner...'));
  const files = getAllFiles(PACKAGES_DIR);
  
  for (const file of files) {
    if (Math.random() > 0.7) await delay(10); // Artificial delay for visual "scanning" effect
    
    const relative = path.relative(ROOT_DIR, file);
    process.stdout.write(chalk.gray(`\rScanning: ${relative.padEnd(60)}`));
    
    // Simulate finding/checking
    const content = fs.readFileSync(file, 'utf-8');
    let found = false;
    
    for (const term of forbiddenTerms) {
      if (term.regex.test(content)) {
        // Just for party mode, check if it's the exact match without caring about allowlist for now
        // Or wait, let's just make it look cool.
        // We won't fail here, just visualize.
      }
    }
  }

  console.log(chalk.green('\n\n✨ All files scanned! ✨'));
  await delay(500);

  console.log(chalk.bold.magenta('\n💃 Results: 🕺'));
  console.log(chalk.green('   ✅ IP Compliance is CLEAN and ready to PARTY!'));
  console.log('\n(This was a visualization. Run "npm run ip-check" for the actual audit.)\n');

})();
