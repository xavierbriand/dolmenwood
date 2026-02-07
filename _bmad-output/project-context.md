---
project_name: 'dolmenwood-encounters'
user_name: 'Xavier'
date: 'Sun Feb 08 2026'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 52
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Core:** Node.js (LTS), TypeScript 5.x
- **Architecture:** Monorepo (pnpm workspaces: `@deg/core`, `@deg/data`, `@deg/cli`)
- **Type System:** **Strict ESM** (`"type": "module"`)
  - **CRITICAL:** All local imports MUST include `.js` extension (e.g., `import { x } from './x.js'`).
  - **TS Config:** `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.
- **Libraries:**
  - CLI: `commander`, `inquirer` (Pure ESM versions), `chalk`
  - Logic/Data: `zod` (Strict Schema Validation), `js-yaml`
- **Testing:** `vitest` (Native ESM support), `vitest-cucumber`

## Critical Implementation Rules

### Language-Specific Rules

- **ESM/Node.js Constraints:**
  - **MANDATORY:** Use `.js` extension for ALL relative imports (e.g., `import { x } from './file.js'`).
  - **Missing Globals:** `__dirname`/`__filename` do NOT exist. Use `import.meta.url` with `fileURLToPath` instead.
  - **JSON:** Use `createRequire(import.meta.url)` to load JSON files, not `import`.

- **TypeScript 5.x Configuration:**
  - **Type Imports:** Use `import type` explicitly (enforce `verbatimModuleSyntax: true`).
  - **Target:** `ES2022` (utilize top-level await).
  - **Exports:** Workspace packages MUST use `package.json` "exports" field; DO NOT deep-link (e.g., no `@deg/core/src/foo`).

- **Zod & Types:**
  - **Inference:** Derive TypeScript types from Zod schemas (`z.infer<typeof X>`).
  - **Strictness:** Use `.strict()` by default for all Data Adapters to reject unknown fields.

### Architecture & Framework Rules

- **Hexagonal Wiring (Manual Composition):**
  - **No DI Containers:** Use constructor injection in `@deg/cli/src/index.ts`.
  - **Composition Root:** `CLI` instantiates `Data` adapters -> Injects into `Core` -> Runs `Command`.

- **Core Purity:**
  - **Allowed:** `zod`, `uuid`, `date-fns` (Pure logic/validation).
  - **BANNED:** `fs`, `path`, `process`, `commander`, `inquirer`.
  - **Zod:** Use Zod for Domain Entity definitions and Validation.

- **State Management:**
  - **Port Pattern:** `SessionPersistence` is an interface in Core.
  - **Implementation:** `FileSessionRepository` in `@deg/data`.
  - **Config:** CLI determines the file path (`~/.deg/session.json`); Core never sees paths.

- **CLI Pattern (Hybrid):**
  - **Thin Handlers:** `action()` maps input -> Core calls -> Console output.
  - **Interactive Fallback:** If CLI args missing, await `inquirer` prompts.

### Testing Rules

- **Strategies:**
  - **Unit (`.test.ts`):** Verify internal logic/helpers. Colocated with code. Mocks EVERYTHING.
  - **BDD (`.feature`):** Verify **Core Use Cases** (Public API). Tests behavior, not implementation.
  - **Integration:** Tests in `@deg/data` verify actual File I/O.

- **Mocking & RNG:**
  - **Strict Injection:** `DiceEngine` must accept a `RandomProvider` interface.
  - **Determinism:** Tests NEVER use `Math.random()`. Inject `MockRandom([1, 6])` to force outcomes.
  - **Data Mocks:** Core tests use `InMemoryRepository`; never hit the disk.

- **Monorepo Execution:**
  - **Workspace:** Use `vitest.workspace.ts` to isolate packages.
  - **Filter:** `pnpm test --project core` vs `pnpm test --project data`.

### Code Quality & Style Rules

- **Naming Conventions:**
  - **Files:** `kebab-case.ts`.
  - **Types:** `PascalCase`. NO `I` prefix.
  - **DTOs:** Suffix required (e.g., `EncounterDTO` for raw data vs `Encounter` for domain).

- **Type Definitions:**
  - **Ports:** Use `interface` (Behavioral Contracts).
  - **Entities/Data:** Use `type` (Data Shapes/Unions).

- **Module Structure (Anti-Barrels):**
  - **Internal Barrels:** **BANNED**. Do not put `index.ts` in subfolders.
  - **Package Entry:** Only ONE `src/index.ts` per package to expose public API.

- **Documentation:**
  - **JSDoc:** Mandatory for Core Ports and Public API.

### Development Workflow Rules

- **Git & Safety:**
  - **Forbidden Commands:** `git push --force`, `git rebase`, `git reset --hard` (Data Loss Risks).
  - **Commit Standard:** `type(scope): description`. Scope MUST match package (e.g., `feat(core):`).
  - **Pre-Commit:** Check `git status` for untracked files before adding.
  - **Branch Strategy:** All features implemented in `feat/` branches. Merge to `main` ONLY when CI passes.

- **Monorepo Dependencies:**
  - **Root:** Shared tooling ONLY (DevDeps like `typescript`, `eslint`, `vitest`).
  - **Packages:** Runtime dependencies ONLY.
  - **Linking:** Use `tsc -b -w` (Build Watch) for live updates. DO NOT use `npm link`.

- **Local Execution:**
  - **Pattern:** Run local binary directly: `./packages/cli/bin/deg.js`.
  - **Filter:** Use `pnpm --filter @deg/cli run start`.

- **CI/CD (GitHub Actions):**
  - **Trigger:** On `push` to branches and `pull_request`.
  - **Gatekeeper:** Build -> Lint -> Test (Unit + BDD). Code cannot merge if red.

### Critical Don't-Miss Rules

- **Logic Resilience:**
  - **Recursion Guard:** `depth > 10` throws `RecursionError`.
  - **Execution Timeout:** Abort generation if > 2000ms (Prevent infinite loops).
  - **Missing Tables:** Return `[MISSING TABLE: <key>]` placeholder; do NOT crash.

- **Data Integrity:**
  - **Canonical Keys:** Normalize ALL Hex IDs to `DDDD` format (e.g., `0101`) before lookup.
  - **Static Loading:** Load YAML data ONCE at boot. No hot-reloading (avoids partial-write crashes).
  - **Validation:** Table weights MUST sum to Die Size.

- **System Resilience:**
  - **Atomic Saves:** Write `session.tmp` -> Rename `session.json`.
  - **Corruption Boot:** Detect bad JSON -> Backup -> Reset -> Warn.

- **Determinism:**
  - **Seeds:** Log session seed to `debug.log`. Accept `--seed <val>` flag to reproduce specific "bad" rolls.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: Sun Feb 08 2026
