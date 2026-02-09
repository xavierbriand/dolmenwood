---
title: 'DMB Creature ETL Pipeline'
slug: 'dmb-creature-etl-pipeline'
created: '2026-02-08'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3]
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

## Implementation Plan

### Phase 1: Scaffold Package & Configuration

- [x] Task 1.1: Create package structure and configuration
  - File: `packages/etl/package.json`
  - Action: Initialize with name `@dolmenwood/etl`, `type: module`, and dependencies (`pdf-parse`, `commander`, `zod`, `js-yaml`, `fs-extra`). Add `@dolmenwood/core` as a workspace dependency.
  - Notes: Ensure `scripts` include `build`, `start`, `test`.

- [x] Task 1.2: Configure TypeScript
  - File: `packages/etl/tsconfig.json`
  - Action: Create extending root config, ensuring `references` to `packages/core` are set up if using project references, or just simple path mapping.

- [x] Task 1.3: Define configuration constants
  - File: `packages/etl/src/config.ts`
  - Action: Export constants for paths: `PDF_SOURCE` (`tmp/etl/DMB.pdf`), `RAW_TEXT` (`tmp/etl/dmb-raw.txt`), `INTERMEDIATE_JSON` (`tmp/etl/creatures-intermediate.json`), `TARGET_YAML` (`assets/creatures.yaml`). ensure `tmp/etl` is created if missing.

### Phase 2: Step 1 - Extract (PDF -> Text)

- [x] Task 2.1: Implement PDF extraction
  - File: `packages/etl/src/steps/extract.ts`
  - Action: Export `extractText(): Promise<void>`. Use `pdf-parse` to read `PDF_SOURCE` and write text to `RAW_TEXT`.
  - Notes: Handle "File not found" error gracefully with a clear message to the user.

- [x] Task 2.2: Create CLI entry point
  - File: `packages/etl/src/index.ts`
  - Action: Setup `commander` program. Add command `extract` that calls `extractText`.
  - Notes: Keep it simple for now, add other commands later.

### Phase 3: Step 2 - Transform (Text -> JSON)

- [x] Task 3.1: Create Parsing Logic with TDD
  - File: `packages/etl/test/transform.spec.ts`
  - Action: Create unit tests with sample raw text chunks (e.g., a standard creature block) and assert expected JSON output.

- [x] Task 3.2: Implement Transformation Logic
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Export `transformText(): Promise<void>`. Read `RAW_TEXT`. Split by creature (regex). Parse fields (AC, HD, Attacks, etc.). Write to `INTERMEDIATE_JSON`.
  - Notes: Use regex carefully. Handle cases where fields might be missing or formatted differently.

### Phase 4: Step 3 - Load (JSON -> YAML)

- [x] Task 4.1: Implement Validation and Loading
  - File: `packages/etl/src/steps/load.ts`
  - Action: Export `loadData(): Promise<void>`. Read `INTERMEDIATE_JSON`. Iterate and validate each item using `CreatureSchema` from `@dolmenwood/core`.
  - Notes: Collect all validation errors. If valid, convert to YAML and write to `TARGET_YAML`. Report success/failure counts.

### Phase 5: Integration

- [x] Task 5.1: Finalize CLI
  - File: `packages/etl/src/index.ts`
  - Action: Add `transform` and `load` commands. Add a default `all` command that runs extract -> transform -> load in sequence. Add `--clean` flag to wipe `tmp/etl` before starting.

- [x] Task 5.2: Gitignore
  - File: `.gitignore` (Root)
  - Action: Ensure `tmp/` is ignored.

### Phase 6: Refinement & Bug Fixes

- [ ] Task 6.1: Fix False Positive Creature 'AC'
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Adjust `parseBestiary` loop or regex to prevent 'AC' (Armor Class) from being detected as a creature name.
  - Notes: This is causing invalid entries in the pipeline.

- [ ] Task 6.2: Fix Missing Fields for 'Cleric' (Adventurer)
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Investigate `parseCompactSecondaryStats` or Adventurer parsing logic. Ensure XP/Move/HD are correctly extracted for the Cleric entry.
  - Notes: 'Cleric' is currently skipped due to validation errors.

- [x] Task 6.3: Implement Data Consistency Check (Encounters vs Creatures)
  - File: `packages/etl/src/steps/validate-refs.ts` (New)
  - Action: Implement logic to scan encounter tables in `assets/` (e.g., `encounters.yaml`) for creature references. Compare against loaded `creatures.yaml`.
  - Notes: Report warnings for any creature listed in an encounter table that is missing from the generated creature data. This serves as a "coverage report" to identify parsing gaps. Use `chalk` for colorized output.

### Phase 7: Hardening

- [ ] Task 7.1: Noise Removal and Filtering
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Implement filtering to remove non-creature artifacts identified in the verification report (e.g., 'Basic Details', 'Pilgrim Destinations', 'Fortune-telling Method').
  - Notes: Also strip page headers/footers if they persist in the name field.

- [ ] Task 7.2: Type Conversion Safety
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Explicitly handle string-to-number conversion for schema fields (AC, HD, Move, Morale) with fallbacks (e.g., `parseInt(val) || 0`) to prevent schema validation failures on coerced types.
  - Notes: Ensure compatibility with Zod schema expectations.

- [ ] Task 7.3: Add Chalk for CLI Output (Partially Complete)
  - File: `packages/etl/src/steps/load.ts`
  - Action: Update `load.ts` to use colorized output for success/warning/error messages, matching the style of `validate-refs.ts`.
  - Notes: `validate-refs.ts` already uses chalk.

- [ ] Task 7.4: Name Normalization (Dashes & Case)
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Normalize dashes (convert em-dashes `—` to standard hyphens `-`) and fix capitalization for ALL CAPS names (e.g., `SNAKE—ADDER` -> `Snake-Adder`).
  - Notes: This addresses the mismatch between PDF formatting and Encounter Tables.

- [ ] Task 7.5: Enhanced Kerning Cleaning
  - File: `packages/etl/src/steps/transform.ts`
  - Action: Improve `cleanKerning` to handle comma-separated names and specific capitalized clusters (e.g., `Bat,   Va Mpir E` -> `Bat, Vampire`).
  - Notes: Fixes the `Rat, Giant` and `Fly, Giant` issues.

## Acceptance Criteria

- [x] AC 1: PDF Extraction
  - Given the user has placed `DMB.pdf` in `tmp/etl/`
  - When I run `pnpm --filter @dolmenwood/etl start extract`
  - Then a file `tmp/etl/dmb-raw.txt` is created containing the raw text of the PDF.

- [x] AC 2: Text Transformation
  - Given `dmb-raw.txt` exists with valid creature text
  - When I run `pnpm --filter @dolmenwood/etl start transform`
  - Then a JSON file `tmp/etl/creatures-intermediate.json` is created
  - And the JSON contains an array of creature objects matching the internal structure.

- [x] AC 3: Schema Validation
  - Given `creatures-intermediate.json` contains a creature with invalid data (e.g., missing AC)
  - When I run `pnpm --filter @dolmenwood/etl start load`
  - Then the CLI reports a validation error for that specific creature
  - And the creature is NOT added to the final YAML (or the process fails, depending on desired strictness - let's say report and skip for now).

- [x] AC 4: Final YAML Output
  - Given valid data in the intermediate JSON
  - When the load step completes
  - Then `assets/creatures.yaml` is updated/created
  - And the file contains valid YAML parsable by the Core application.

- [ ] AC 5: Zero False Positives
  - Given the full DMB text
  - When the pipeline runs
  - Then 'AC' should NOT be listed as a creature in the output/logs.

- [ ] AC 6: Complete Adventurer Parsing
  - Given the Adventurers section (specifically Cleric)
  - When the pipeline runs
  - Then 'Cleric' should be successfully parsed and validated, with all required fields (XP, Move, etc.) present.

- [ ] AC 7: Consistency Reporting
  - Given `assets/encounters.yaml` exists and references "Goblin"
  - And `assets/creatures.yaml` does NOT contain "Goblin"
  - When I run `pnpm --filter @dolmenwood/etl start load` (or `verify`)
  - Then the CLI output should display a warning: "Missing dependency: 'Goblin' referenced in encounters but not found in creature data."

## Additional Context

### Dependencies

- **Runtime:** Node 20+
- **Packages:** `pdf-parse`, `commander`, `zod`, `js-yaml`, `fs-extra`
- **Internal:** `@dolmenwood/core` (for `CreatureSchema`)

### Testing Strategy

- **Unit Tests:** Focus heavily on `transform.spec.ts`. The regex parsing is the most fragile part. Test against various edge cases (multi-line attacks, special characters).
- **Integration Tests:** Run the full `all` command with a sample PDF (or a mocked text file for the transform step) to ensure the pipeline flows correctly.

### Notes

- **Risk:** PDF layout changes or inconsistencies in the DMB source will break the regex. The pipeline should be verbose about _where_ it failed (which creature name) to allow for quick debugging.
- **Performance:** Not a major concern for < 500 creatures, but using streams for large files is good practice if we were scaling. For now, reading full files into memory is acceptable.
