import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The domain layer must depend on nothing but its arguments. This test is the
// enforcement of that rule; the prose lives in .claude/rules/core.md.

/** Walk up to the package root, so the scan targets src/ whether this file
 *  runs from src/ (vitest on .ts) or from a compiled dist/ copy. */
function packageRoot(startDir: string): string {
  let dir = startDir;
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

const srcDir = join(packageRoot(dirname(fileURLToPath(import.meta.url))), 'src');

/** Node built-in modules the domain must never import. */
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net', 'os',
  'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

/** Sibling workspace packages the domain must never depend on. */
const OUTWARD_PACKAGES = [
  '@dolmenwood/data',
  '@dolmenwood/cli',
  '@dolmenwood/tui',
  '@dolmenwood/etl',
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Module specifiers pulled in by static/dynamic imports and re-exports. */
function importedModules(code: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(code)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

describe('packages/core is pure', () => {
  const files = sourceFiles(srcDir);

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('imports no node built-in and no outer workspace package', () => {
    const violations: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      for (const spec of importedModules(code)) {
        const bare = spec.replace(/^node:/, '');
        const isBuiltin = spec.startsWith('node:') || NODE_BUILTINS.has(bare);
        const isOutward = OUTWARD_PACKAGES.some(
          (pkg) => spec === pkg || spec.startsWith(`${pkg}/`),
        );
        if (isBuiltin || isOutward) {
          violations.push(`${relative(srcDir, file)} → ${spec}`);
        }
      }
    }
    expect(
      violations,
      `core must stay pure; found:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
