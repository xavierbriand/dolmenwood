
import { getForbiddenTerms } from './ip-check-core.js';

const prBody = process.env.PR_BODY || '';
const prTitle = process.env.PR_TITLE || '';

if (!prBody && !prTitle) {
  console.log('ℹ️  No PR content to scan (PR_BODY/PR_TITLE env vars empty). Skipping.');
  process.exit(0);
}

const content = `${prTitle}\n\n${prBody}`;
const forbiddenTerms = getForbiddenTerms();
const violations = [];

console.log('🛡️  Scanning PR Title and Description for IP Violations...');

for (const { original, regex } of forbiddenTerms) {
  const match = regex.exec(content);
  if (match) {
    violations.push({ term: original, matchedStr: match[0] });
  }
}

if (violations.length > 0) {
  console.error('\n❌ PR CONTENT BLOCKED: IP Policy Violation');
  console.error('   The Pull Request title or description contains proprietary terms.');
  console.error('\n   Violations found:');
  violations.forEach(v => {
    console.error(`   - Found "${v.matchedStr}" (Matches Asset: "${v.term}")`);
  });
  console.error('\n   ACTION REQUIRED: Edit the PR description/title to remove these references.');
  process.exit(1);
} else {
  console.log('✅ PR Content Scan Passed.');
  process.exit(0);
}
