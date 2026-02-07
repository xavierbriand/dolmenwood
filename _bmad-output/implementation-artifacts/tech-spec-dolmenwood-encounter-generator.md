---
title: 'Dolmenwood Encounter Generator'
slug: 'dolmenwood-encounter-generator'
created: 'Sat Feb 07 2026'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Node.js', 'TypeScript', 'YAML', 'commander', 'zod', 'vitest']
files_to_modify: ['package.json', 'packages/core/src/index.ts', 'packages/cli/src/index.ts', 'data/tables/regions.yaml']
code_patterns: ['Hexagonal Architecture', 'Monorepo/Workspace', 'Schema Validation (Zod)']
test_patterns: ['Unit Tests (Vitest)', 'Mock RNG']
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
- CLI entry point with interactive prompts for context.

**Out of Scope:**
- Web UI (Phase 2).
- Parsing Markdown source files (manual conversion to YAML required).

## Context for Development

### Codebase Patterns

Greenfield project.
- **Language**: TypeScript 5.x (Node.js LTS)
- **Architecture**: Monorepo-style workspace (`packages/core`, `packages/cli`) with Hexagonal Architecture.
- **Validation**: `zod` for strict runtime validation of YAML data.
- **CLI**: `commander` for command structure, `inquirer` for interactive prompts.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `Encounter rules.md` | The source of truth for encounter tables and logic. |
| `data/tables/regions.yaml` | (New) Region encounter tables definition. |
| `packages/core/src/generator.ts` | (New) Main generation logic. |

### Technical Decisions

- **Architecture**: "Hexagonal" style - Core domain logic decoupled from the CLI.
- **Data**: YAML for human-readable configuration. Zod schemas ensure invalid YAML crashes early with clear errors.
- **State**: CLI implements a simple in-memory `SessionTracker` class to hold `GenerationContext` (Time, Location, etc.) between commands.
- **Testing**: Vitest for unit testing. Critical to test the probability distribution of tables.

## Implementation Plan

### Tasks

- [ ] Task 1: Setup Monorepo & Core Infrastructure
  - File: `package.json`, `packages/core/package.json`, `packages/cli/package.json`, `tsconfig.json`
  - Action: Initialize npm workspace, install Typescript, Vitest, and configured build scripts.
  - Notes: Ensure core is a dependency of cli.

- [ ] Task 2: Define Zod Schemas & YAML Types
  - File: `packages/core/src/schemas/encounter.ts`, `packages/core/src/schemas/tables.ts`
  - Action: Create Zod schemas for `EncounterType`, `Creature`, `RegionTable`, `SettlementTable`.
  - Notes: Must mirror the structure in `Encounter rules.md`.

- [ ] Task 3: Implement Dice & Probability Engine
  - File: `packages/core/src/engine/dice.ts`, `packages/core/src/engine/table-roller.ts`
  - Action: Implement `roll(diceString)`, `rollTable(table)`, and context-aware probability modifiers (e.g., night/day checks).
  - Notes: Include a seeded RNG for testability.

- [ ] Task 4: Create Initial YAML Data Files
  - File: `data/regions.yaml`, `data/creatures.yaml`
  - Action: manually transcribe the "Regional encounters" and "Common encounters" tables from `Encounter rules.md` into the YAML format defined in Task 2.
  - Notes: Start with High Wold region and a few common creatures as a tracer bullet.

- [ ] Task 5: Implement Core Generator Logic
  - File: `packages/core/src/generator.ts`
  - Action: Implement `generateEncounter(context: GenerationContext)` which chains the lookups: Region -> Type -> Creature -> Activity -> Reaction -> Distance.
  - Notes: Pure function (or class instance) that takes context and returns an `Encounter` object.

- [ ] Task 6: Implement CLI Session Tracker
  - File: `packages/cli/src/session.ts`
  - Action: Create `SessionTracker` class to store `GenerationContext` (hex, time, camping status).
  - Notes: In-memory only for now.

- [ ] Task 7: Implement CLI Commands
  - File: `packages/cli/src/index.ts`, `packages/cli/src/commands/generate.ts`, `packages/cli/src/commands/context.ts`
  - Action: Implement `generate` (calls core), `travel <hex>`, `time <set>`, `camp`.
  - Notes: Use `inquirer` for interactive missing data.

### Acceptance Criteria

- [ ] AC 1: Core Logic - Valid Context
  - Given a context of { region: "High Wold", time: "Day" }
  - When `generateEncounter` is called
  - Then it returns a valid `Encounter` object with creature details populated from the YAML data.

- [ ] AC 2: Core Logic - Nested Tables
  - Given a region roll results in "Common Encounter"
  - When resolved
  - Then it automatically rolls on the sub-table (e.g., "Animal" or "Monster") to find the specific creature.

- [ ] AC 3: CLI - State Persistence
  - Given I have set the location to "Hex 0101" via `travel 0101`
  - When I run `generate` without arguments
  - Then it uses "Hex 0101" as the location context.

- [ ] AC 4: Data Validation
  - Given a YAML file with a missing probability weight
  - When the application starts
  - Then it throws a clear Zod validation error and refuses to run.

## Additional Context

### Dependencies

- `commander`: CLI framework
- `inquirer`: Interactive prompts
- `js-yaml`: YAML parser
- `zod`: Schema validation
- `chalk`: Terminal styling
- `vitest`: Testing framework

### Testing Strategy

- **Unit Tests**: Mock `Math.random` to verify table logic (e.g., "Roll of 1 on d6 returns result A").
- **Schema Tests**: Verify YAML files match the Zod schema.
- **Integration**: Run the CLI `generate` command and verify output structure.

### Notes

- Future proofing: Ensure the `Encounter` type is serializable for the future Web UI API.
