
import fs from 'node:fs';
import { getForbiddenTerms } from './ip-check-core.js';

const commitMsgFile = process.argv[2];

if (!commitMsgFile) {
  console.error('❌ Error: No commit message file provided.');
  process.exit(1);
}

try {
  const message = fs.readFileSync(commitMsgFile, 'utf8');
  const forbiddenTerms = getForbiddenTerms();
  const violations = [];

  for (const { original, regex } of forbiddenTerms) {
    const match = regex.exec(message);
    if (match) {
      violations.push({ term: original, matchedStr: match[0] });
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ COMMIT MESSAGE BLOCKED: IP Policy Violation');
    console.error('   Your commit message contains terms reserved for Dolmenwood proprietary assets.');
    console.error('   This risks exposing IP in public logs.');
    console.error('\n   Violations found:');
    violations.forEach(v => {
      console.error(`   - Found "${v.matchedStr}" (Matches Asset: "${v.term}")`);
    });
    console.error('\n   ACTION REQUIRED: Please reword your commit message to avoid specific entity names.');
    console.error('   (e.g., use "add wandering monster" instead of "add <Entity Name>")');
    process.exit(1);
  } else {
    process.exit(0);
  }
} catch (error) {
  console.error('🔥 Fatal Error checking commit message:', error);
  process.exit(1);
}
