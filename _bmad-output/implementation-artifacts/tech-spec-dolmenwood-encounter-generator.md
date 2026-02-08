---
title: 'Dolmenwood Encounter Generator'
slug: 'dolmenwood-encounter-generator'
created: 'Sat Feb 07 2026'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Node.js', 'TypeScript', 'YAML', 'commander', 'zod', 'vitest', 'vitest-cucumber']
files_to_modify: ['package.json', 'packages/core/src/index.ts', 'packages/cli/src/index.ts', 'data/tables/regions.yaml']
code_patterns: ['Hexagonal Architecture', 'Monorepo/Workspace', 'Schema Validation (Zod)', 'Recursive Table Resolution']
test_patterns: ['Unit Tests (Vitest)', 'Mock RNG', 'BDD Features (Gherkin)']
---

# Tech-Spec: Dolmenwood Encounter Generator

**Created:** Sat Feb 07 2026

## Overview

### Problem Statement

Manually rolling on nested encounter tables (Type → Creature → Details) is too slow for live play. The Referee needs a tool to generate complex, multi-step encounters instantly.

### Solution

A Node.js/TypeScript core library handling nested probability tables and dice logic, driven by YAML configuration, with a CLI interface for immediate generation.

### Scope

**In Scope:**
- Core logic engine (dice rollers, table lookups, linked encounters).
- YAML data schema design (Regions, Settlements, Creatures).
- Implementation of the "Full Stack" generation chain (Type -> Creature -> Stats -> Activity -> Reaction -> Distance).
- CLI entry point with interactive prompts for context and session state.

**Out of Scope:**
- Web UI (Phase 2).
- Parsing Markdown source files (manual conversion to YAML required).

## Context for Development

### Codebase Patterns

Greenfield project.
- **Language**: TypeScript 5.x (Node.js LTS)
- **Architecture**: Monorepo-style workspace with 3 tiers:
    - `@dolmenwood/core`: Pure Domain Logic & Use Cases (Hexagonal Ports)
    - `@dolmenwood/data`: Data Access Adapters (YAML Reader)
    - `@dolmenwood/cli`: Presentation & User Interface
- **Validation**: `zod` for strict runtime validation of YAML data.
- **CLI**: `commander` for command structure, `inquirer` for interactive prompts.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `rules/Encounter rules.md` | The source of truth for encounter tables and logic. |
| `data/tables/regions.yaml` | (New) Region encounter tables definition. |
| `packages/core/src/generator.ts` | (New) Main generation logic. |

### Technical Decisions

- **Architecture**: "Hexagonal" style. Core defines ports; Data implements them. Strict boundaries via ESLint/dependency rules. Core must return pure DTOs (JSON-serializable) to ensure the API is ready for Phase 2 Web UI (no CLI dependencies in Core).
- **Data**: YAML for human-readable configuration. Zod schemas ensure invalid YAML crashes early with clear errors.
- **State**: CLI implements a `SessionTracker` class that persists `GenerationContext` to a local JSON file (`~/.dolmenwood/session.json`) for crash recovery.
- **Testing**: Vitest for unit tests. `vitest-cucumber` for BDD feature files.

## Implementation Plan

### Tasks

- [ ] Task 1: Setup Monorepo & Core Infrastructure
  - File: `package.json`, `packages/core/package.json`, `packages/data/package.json`, `packages/cli/package.json`, `tsconfig.json`
  - Action: Initialize npm workspace, install Typescript, Vitest, and configured build scripts. Set up `@dolmenwood/core`, `@dolmenwood/data`, `@dolmenwood/cli`.
  - Notes: Ensure core is a dependency of cli and data implements core ports.

- [ ] Task 2: Define Zod Schemas & YAML Types
  - File: `packages/core/src/schemas/encounter.ts`, `packages/core/src/schemas/tables.ts`
  - Action: Create Zod schemas for `EncounterType`, `Creature`, `RegionTable`, `SettlementTable`.
  - Notes: Must mirror the structure in `rules/Encounter rules.md`. Include `TableReference` type for recursive rolls. Implement semantic validation (e.g., checking that table probability weights sum to exactly 100% or the die max value).

- [ ] Task 3: Implement Dice & Probability Engine
  - File: `packages/core/src/engine/dice.ts`, `packages/core/src/engine/table-roller.ts`
  - Action: Implement `roll(diceString)`, `rollTable(table)`, and context-aware probability modifiers (e.g., night/day checks). Add recursion depth guard.
  - Notes: Include a seeded RNG for testability. Enforce `MAX_RECURSION_DEPTH = 10` to prevent circular reference crashes.

- [ ] Task 4: Create Initial YAML Data Files
  - File: `data/regions.yaml`, `data/creatures.yaml`
  - Action: manually transcribe the "Regional encounters" and "Common encounters" tables from `rules/Encounter rules.md` into the YAML format defined in Task 2.
  - Notes: Start with High Wold region and a few common creatures as a tracer bullet.

- [ ] Task 5: Implement Core Generator Logic
  - File: `packages/core/src/generator.ts`
  - Action: Implement `generateEncounter(context: GenerationContext)` which chains the lookups: Region -> Type -> Creature -> Activity -> Reaction -> Distance.
  - Notes: Pure function (or class instance) that takes context and returns an `Encounter` object.

- [ ] Task 6: Implement CLI Session Tracker (Persisted)
  - File: `packages/cli/src/session.ts`
  - Action: Create `SessionTracker` class to store `GenerationContext` (hex, time, camping status). Add `load/save` methods to `~/.dolmenwood/session.json`.
  - Notes: Handle file read errors gracefully. Ensure `save` method automatically creates the directory (`mkdir -p ~/.dolmenwood`) if it doesn't exist.

- [ ] Task 7: Implement CLI Commands
  - File: `packages/cli/src/index.ts`, `packages/cli/src/commands/generate.ts`, `packages/cli/src/commands/travel.ts`
  - Action: Implement `generate` (calls core), `travel <hex>`, `time <set>`, `camp`.
  - Notes: Use `inquirer` for interactive missing data. Add `--debug` flag support. Validate `<hex>` format (e.g., `^\d{4}$`) before updating session.

- [ ] Task 8: Implement Error Handling & Logging
  - File: `packages/cli/src/utils/error-handler.ts`, `packages/cli/src/utils/logger.ts`
  - Action: Create a pretty-printer for Zod errors and a debug logger that activates with `--debug`.
  - Notes: Use `chalk` for readable errors.

- [ ] Task 9: Setup CI & Documentation
  - File: `.github/workflows/ci.yml`, `README.md`, `docs/YAML_GUIDE.md`
  - Action: Create GitHub Action for Vitest. Write "How to Edit Data" guide.
  - Notes: CI should run unit tests and BDD features.

### Acceptance Criteria

- [ ] AC 1: Core Logic - Valid Context (Feature File)
  - Given a context of { region: "High Wold", time: "Day" }
  - When `generateEncounter` is called
  - Then it returns a valid `Encounter` object with creature details populated from the YAML data.

- [ ] AC 2: Core Logic - Nested Tables
  - Given a region roll results in "Common Encounter"
  - When resolved
  - Then it automatically rolls on the sub-table (e.g., "Animal" or "Monster") to find the specific creature.

- [ ] AC 3: CLI - State Persistence
  - Given I have set the location to "Hex 0101" via `travel 0101`
  - When I restart the CLI and run `generate`
  - Then it uses "Hex 0101" as the location context (persisted).

- [ ] AC 4: Data Validation
  - Given a YAML file with a missing probability weight
  - When the application starts
  - Then it throws a clear Zod validation error and refuses to run.

- [ ] AC 5: Debug Mode
  - Given I run `dolmenwood generate --debug`
  - When an encounter is generated
  - Then the output includes raw dice rolls and table selection paths.

## Additional Context

### Dependencies

- `commander`: CLI framework
- `inquirer`: Interactive prompts
- `js-yaml`: YAML parser
- `zod`: Schema validation
- `chalk`: Terminal styling
- `vitest`: Testing framework
- `vitest-cucumber`: BDD framework

### Testing Strategy

- **Unit Tests**: Mock `Math.random` to verify table logic (e.g., "Roll of 1 on d6 returns result A").
- **Schema Tests**: Verify YAML files match the Zod schema.
- **BDD Integration**: Use Gherkin features to verify the full generation chain against the rules.

### Notes

- Future proofing: Ensure the `Encounter` type is serializable for the future Web UI API.
