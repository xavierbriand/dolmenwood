# Story: Setup Monorepo & Core Infrastructure

**Status:** review
**Story Key:** 1-1-setup-monorepo
**Sprint:** 1

## Description
Initialize the Monorepo structure for the Dolmenwood Encounter Generator using pnpm workspaces. Set up the three core packages (`core`, `data`, `cli`) and configure the build and test tooling (TypeScript, Vitest).

## Acceptance Criteria
- [x] Root `package.json` defines a pnpm workspace.
- [x] `packages/core`, `packages/data`, and `packages/cli` exist with valid `package.json` files.
- [x] `@dolmenwood/core` is a dependency of `@dolmenwood/cli` and `@dolmenwood/data`.
- [x] TypeScript is configured with strict mode in a root `tsconfig.json` and extended by packages.
- [x] `pnpm build` successfully builds all packages.
- [x] `pnpm test` successfully runs tests (even if empty/placeholder).
- [x] Project follows Hexagonal Architecture boundaries (Core has no external deps, CLI depends on Core).

## Tasks/Subtasks
- [x] Initialize Root Workspace
    - [x] Create root `package.json`
    - [x] Create `pnpm-workspace.yaml`
    - [x] Install root dependencies (`typescript`, `vitest`, `tsx`, `eslint`, `prettier`)
    - [x] Create root `tsconfig.json` (base config)
- [x] Setup @dolmenwood/core
    - [x] Create `packages/core/package.json`
    - [x] Create `packages/core/tsconfig.json`
    - [x] Create `packages/core/src/index.ts` (placeholder)
    - [x] Create `packages/core/src/index.spec.ts` (placeholder test)
- [x] Setup @dolmenwood/data
    - [x] Create `packages/data/package.json`
    - [x] Add `@dolmenwood/core` as dependency
    - [x] Create `packages/data/tsconfig.json`
    - [x] Create `packages/data/src/index.ts` (placeholder)
- [x] Setup @dolmenwood/cli
    - [x] Create `packages/cli/package.json`
    - [x] Add `@dolmenwood/core` and `@dolmenwood/data` as dependencies
    - [x] Create `packages/cli/tsconfig.json`
    - [x] Create `packages/cli/src/index.ts` (placeholder)
- [x] Verify Build & Test Pipeline
    - [x] Run `pnpm install`
    - [x] Run `pnpm build`
    - [x] Run `pnpm test`

## Dev Notes
- **Architecture:** Hexagonal (Ports & Adapters).
    - `core`: Pure domain logic. No infrastructure dependencies.
    - `data`: Secondary adapter (persistence/loading).
    - `cli`: Primary adapter (driving).
- **Tooling:**
    - Runtime: Node.js v20+
    - Module System: ESM (`"type": "module"`)
    - Package Manager: `pnpm`
- **Naming:**
    - Scope: `@dolmenwood`
    - Packages: `@dolmenwood/core`, `@dolmenwood/data`, `@dolmenwood/cli`

## Dev Agent Record
### Implementation Plan
- Will use `pnpm init` and manual file creation.
- Will strictly enforce ESM (`.js` imports).
- Will ensure `references` are set in `tsconfig` if using project references, or just simple extends.

### Completion Notes
- Monorepo successfully initialized with pnpm workspaces.
- Three packages created: core, data, cli.
- TypeScript build pipeline verified.
- Vitest test pipeline verified.
- Dependencies linked correctly.

## File List
- package.json
- pnpm-workspace.yaml
- tsconfig.json
- packages/core/package.json
- packages/core/tsconfig.json
- packages/core/src/index.ts
- packages/core/src/index.spec.ts
- packages/data/package.json
- packages/data/tsconfig.json
- packages/data/src/index.ts
- packages/data/src/index.spec.ts
- packages/cli/package.json
- packages/cli/tsconfig.json
- packages/cli/src/index.ts
- packages/cli/src/sanity.spec.ts

## Change Log
- Initial setup of monorepo structure.
