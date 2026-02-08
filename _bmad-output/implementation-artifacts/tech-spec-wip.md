---
title: 'DMB Creature ETL Pipeline'
slug: 'dmb-creature-etl-pipeline'
created: '2026-02-08'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack:
  - TypeScript
  - Node.js
  - pdf-parse
  - Zod
  - YAML
files_to_modify:
  - packages/etl/package.json
  - packages/etl/tsconfig.json
  - packages/etl/src/index.ts
  - packages/etl/src/steps/extract.ts
  - packages/etl/src/steps/transform.ts
  - packages/etl/src/steps/load.ts
  - assets/creatures.yaml
code_patterns:
  - ETL (Extract-Transform-Load)
  - CLI Command Pattern
  - Zod Validation
  - Monorepo Package
test_patterns:
  - Unit tests for regex parsing (Vitest)
  - Integration tests for full pipeline
---

# Technical Specification: DMB Creature ETL Pipeline

## Overview

### Problem Statement

The current process for importing creature data from the proprietary _Dolmenwood Monster Book_ (DMB) is manual and fragile. We need a robust, repeatable "Hardened ETL" pipeline to extract, transform, and load (ETL) creature statistics from the PDF source into a schema-validated `assets/creatures.yaml` file.

### Solution

Implement a dedicated monorepo package `@dolmenwood/etl` containing a CLI tool to orchestrate the pipeline:

1.  **Extract**: `tmp/etl/DMB.pdf` -> `tmp/etl/dmb-raw.txt`
2.  **Transform**: `tmp/etl/dmb-raw.txt` -> `tmp/etl/creatures-intermediate.json`
3.  **Load**: `tmp/etl/creatures-intermediate.json` -> `assets/creatures.yaml`

All intermediate files and the source PDF will reside in a git-ignored `tmp/etl/` directory at the project root.

### Scope

**In Scope:**

- New package: `packages/etl`.
- CLI entry point (e.g., `pnpm --filter @dolmenwood/etl start`) with flags.
- PDF text extraction logic.
- Parsing logic to handle DMB-specific formatting.
- **Validation:** Strict validation using `CreatureSchema` from `@dolmenwood/core`.
- **IP Protection:** Strict handling of intermediate files in a git-ignored `tmp/` directory.

**Out of Scope:**

- OCR.
- Importing non-creature data.

## Context for Development

- **Source of Truth:** `tmp/etl/DMB.pdf` (User must place it here).
- **Target:** `assets/creatures.yaml` (Project Root).
- **Schema Location:** `packages/core/src/schemas/creature.ts` (Verified).
- **Workspace Context:** `pnpm-workspace.yaml` defines `packages/*`, validating `packages/etl` as a new workspace.
- **Dependencies:** `@dolmenwood/etl` will depend on `@dolmenwood/core` (via `workspace:*`) for shared schemas.
- **Standards:** Must follow `AGENTS.md` (Strict TS, ESM, Hexagonal boundaries).

## Architecture

### 1. Package Structure

```
packages/etl/
├── package.json        (deps: pdf-parse, commander, zod, js-yaml; devDeps: @dolmenwood/core)
├── tsconfig.json       (extends root, references core)
├── src/
│   ├── index.ts        (CLI Entry Point)
│   ├── config.ts       (Paths & Constants)
│   └── steps/
│       ├── extract.ts  (Adapter: pdf-parse)
│       ├── transform.ts (Logic: Text -> JSON)
│       └── load.ts     (Adapter: fs/yaml)
└── test/
    └── transform.spec.ts
```

### 2. Data Flow

1.  **Extract**: Checks `tmp/etl/DMB.pdf` (project root). Extracts to `tmp/etl/dmb-raw.txt`.
2.  **Transform**: Parses `tmp/etl/dmb-raw.txt`. Maps to `Creature` objects. Outputs `tmp/etl/creatures-intermediate.json`.
3.  **Load**: Validates JSON against `CreatureSchema` (imported from `@dolmenwood/core`). Writes valid entries to `assets/creatures.yaml` (project root).

## Functional Requirements

1.  **CLI Interface**: `pnpm --filter @dolmenwood/etl start [options]`
    - `--step <extract|transform|load|all>` (Default: all)
    - `--clean` (Removes intermediate files in `tmp/etl`)
2.  **Parsing Accuracy**: Matches `CreatureSchema` fields (level, AC, attacks, etc.).
3.  **Validation**: Pipeline MUST fail if parsed data invalidates the schema.

## Non-Functional Requirements

1.  **IP Safety**: `tmp/` directory must be in root `.gitignore`.
2.  **Performance**: Parsing intermediate text should be near-instant.
3.  **Code Quality**: Strict Types, ESM, Prettier/Linting compliance.

## Implementation Plan

### Phase 1: Scaffold Package & Configuration

- [ ] **1.1** Create `packages/etl` directory structure.
- [ ] **1.2** Initialize `package.json` with dependencies (`pdf-parse`, `commander`, `zod`, `js-yaml`, `@dolmenwood/core`).
- [ ] **1.3** Create `tsconfig.json` extending root config.
- [ ] **1.4** Create `src/config.ts` defining strict paths for `tmp/etl/` and `assets/`.
- [ ] **1.5** Verify: `pnpm install` and ensure workspace links correctly.

### Phase 2: Step 1 - Extract (PDF -> Text)

- [ ] **2.1** Create `src/steps/extract.ts`.
- [ ] **2.2** Implement `extractText(pdfPath: string): Promise<string>` using `pdf-parse`.
- [ ] **2.3** Add basic CLI entry point `src/index.ts` to trigger extraction.
- [ ] **2.4** Verify: Run against a dummy PDF (or real DMB if user provides it) and check `tmp/etl/dmb-raw.txt` output.

### Phase 3: Step 2 - Transform (Text -> JSON)

- [ ] **3.1** Create `src/steps/transform.ts`.
- [ ] **3.2** Create `test/transform.spec.ts` (TDD approach for regex patterns).
- [ ] **3.3** Implement `parseCreatures(text: string): unknown[]`.
  - _Sub-task:_ Regex for splitting creatures.
  - _Sub-task:_ Regex for extracting AC, HD, Attacks, Move, Morale.
- [ ] **3.4** Verify: Run unit tests to confirm text chunks are correctly mapped to objects.

### Phase 4: Step 3 - Load (JSON -> YAML)

- [ ] **4.1** Create `src/steps/load.ts`.
- [ ] **4.2** Implement `validateAndLoad(data: unknown[]): void`.
- [ ] **4.3** Use `CreatureSchema.safeParse()` from `@dolmenwood/core` to validate each entry.
- [ ] **4.4** Log errors for invalid entries (do not crash whole batch).
- [ ] **4.5** Write valid entries to `assets/creatures.yaml` using `js-yaml`.

### Phase 5: Integration & Polish

- [ ] **5.1** Finalize `src/index.ts` with Commander flags (`--step`, `--clean`).
- [ ] **5.2** Add `.gitignore` entry for `tmp/etl/` (if not already present).
- [ ] **5.3** Run full end-to-end test.
