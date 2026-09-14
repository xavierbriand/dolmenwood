---
title: 'Dolmenwood Encounter Generator'
slug: 'dolmenwood-encounter-generator'
created: 'Sat Feb 07 2026'
revised: '2026-09-14'
status: 'complete'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ['Node.js', 'TypeScript', 'YAML', 'commander', 'zod', 'vitest']
code_patterns:
  [
    'Hexagonal Architecture',
    'Monorepo/Workspace',
    'Schema Validation (Zod)',
    'Recursive Table Resolution',
    'Result Type (Success/Failure)',
  ]
test_patterns: ['Unit Tests (Vitest)', 'Mock RNG', 'BDD-style describe/it']
---

# Tech-Spec: Dolmenwood Encounter Generator

**Created:** Sat Feb 07 2026
**Revised:** 2026-09-14 — superseded by the TUI plan and subsequent fixes; see the "Revision note" at the end.

## Overview

### Problem Statement

Manually rolling on nested encounter tables (Type -> Creature -> Details) is too slow for live play. The Referee needs a tool to generate complex, multi-step encounters instantly.

### Solution

A Node.js/TypeScript core library handling nested probability tables and dice logic, driven by YAML configuration, with a CLI interface for immediate generation.

### Scope

**In Scope:**

- Core logic engine (dice rollers, table lookups, recursive encounter resolution).
- YAML data schema design (Regions, Common encounters, Creatures).
- Full generation chain: Type -> Creature -> Stats -> Activity -> Reaction -> Distance -> Surprise.
- CLI entry point with session state persistence.

**Out of Scope:**

- Web UI (future phase).
- NPC party generation procedure (see `plan-adventuring-party-generation.md`).

## Architecture

### Package Structure (Hexagonal)

```
@dolmenwood/core    Pure domain logic. No infrastructure dependencies.
  ├── schemas/      Zod schemas (Creature, Encounter, Tables, Session)
  ├── engine/       Dice roller, TableRoller
  ├── services/     EncounterGenerator, SessionService
  ├── ports/        CreatureRepository, TableRepository, RandomProvider, SessionRepository
  └── utils/        Result type (success/failure)

@dolmenwood/data    Secondary adapters (persistence/loading).
  └── repositories/ YamlCreatureRepository, YamlTableRepository, JsonSessionRepository

@dolmenwood/cli     Primary adapter (driving).
  ├── commands/     session
  └── index.ts      Commander CLI entry point; no-args delegates to @dolmenwood/tui

@dolmenwood/tui     Primary adapter (driving) — Ink terminal UI, the default
                    interactive mode. Replaced the old inquirer-based
                    InteractiveService entirely (see plan-tui-ink.md).

@dolmenwood/etl     ETL pipeline (separate concern, see tech-spec-dmb-creature-etl-pipeline.md)
```

**Dependency Rule:** `CLI / TUI -> Data -> Core`. Core knows nothing of the outer world.

### Data Files (assets/)

The `assets/` directory contains symlinks to ETL-generated outputs and hand-authored data files. ETL-generated files (e.g., `creatures.yaml`) are symlinks to `etl/output/load/` and are gitignored via the `/assets/*` rule with explicit exceptions. Hand-authored IP-containing files (encounter tables, etc.) are also gitignored.

| File                       | Type    | Description                                                                  |
| -------------------------- | ------- | ---------------------------------------------------------------------------- |
| `creatures.yaml`           | Symlink | 158 creatures with stats, variants, factions, enrichment fields, treasure (-> etl/output/load/creatures/) |
| `treasure-tables.json`     | Symlink | DCB hoard/gem/art/magic-item tables, rolled by `TreasureGenerator` (-> etl/output/load/treasure-tables/) |
| `encounter-types.yaml`     | Local   | 4 encounter type tables (Day/Night x Road/Wild/Fire/NoFire)                  |
| `common-encounters.yaml`   | Local   | Common sub-tables (Animal, Monster, Mortal, Sentient)                        |
| `regional-encounters.yaml` | Local   | Region-specific encounter tables                                             |
| `activity.yaml`            | Local   | Activity table (1d20)                                                        |
| `reaction.yaml`            | Local   | Reaction table (2d6)                                                         |

### Generation Flow

```
GenerationContext (region, time, terrain, camping)
  |
  v
1. getInitialTableName(context) -> "Encounter Type - Daytime - Road"
  |
  v
2. Roll on Encounter Type table (1d8) -> category (Animal/Monster/Mortal/Sentient/Regional)
  |
  v
3. Recursive resolution:
   - Animal/Monster/Mortal/Sentient -> roll on Common sub-table -> Creature ref
   - Regional -> roll on "Regional - {RegionName}" table -> Creature ref
   - Fallback: tries localized table name if base table not found
  |
  v
4. resolveCreature(entry) -> look up in CreatureRepository, roll count
  |
  v
5. Roll secondary details:
   - Activity (1d20 on Activity table)
   - Reaction (2d6 on Reaction table)
   - Distance (2d6 x 30 feet)
   - Surprise (1d6 per side, <= 2 = surprised)
  |
  v
Encounter { type, summary, details: { creature, count, activity, reaction, distance, surprise } }
```

Recursion guard: depth > 10 throws error.

## Implementation Status

### Task 1: Monorepo & Core Infrastructure -- COMPLETE

- pnpm workspace with 4 packages (core, data, cli, etl)
- TypeScript 5.x strict mode, ESM
- Vitest test runner
- ESLint + Prettier

### Task 2: Zod Schemas & Types -- COMPLETE

- `CreatureSchema` + `CreatureVariantSchema` (creature.ts)
- `EncounterSchema`, `EncounterTypeSchema`, `GenerationContextSchema` (encounter.ts)
- `RegionTableSchema`, `TableEntrySchema` (tables.ts)
- `SessionSchema` (session.ts)

### Task 3: Dice & Probability Engine -- COMPLETE

- `DiceRoll` class with `parse(diceString)` and `roll(random)`
- `Die` class for individual die types
- `TableRoller` for rolling on table entries
- Seeded `RandomProvider` port for testability
- 16 tests (Dice: 13, TableRoller: 3)

### Task 4: YAML Data Files -- COMPLETE

- 149 creatures in `assets/creatures.yaml` (via ETL pipeline)
- 4 encounter type tables
- Common encounter sub-tables (Animal, Monster, Mortal, Sentient)
- Regional encounter tables
- Activity and Reaction tables

### Task 5: Core Generator Logic -- COMPLETE

- `EncounterGenerator` with recursive table resolution
- Context-based initial table selection (day/night, road/wild, fire/no-fire)
- Region name formatting and localized table fallback
- Creature resolution with dice-based count rolling
- Secondary detail rolling (activity, reaction, distance, surprise)
- 3 tests (unit, recursive, integration)

### Task 6: CLI Session Tracker -- COMPLETE

- `SessionService` in Core (port-based)
- `JsonSessionRepository` in Data (persists to `~/.dolmenwood/session.json`)
- `session` command in CLI (set/get region, time, terrain, camping)
- 2 tests

### Task 7: CLI Commands -- COMPLETE

**Implemented:**

- `encounter <region>` command (calls `EncounterGenerator`, displays formatted result with chalk styling)
- `session` command (set/get region, time, terrain, camping)
- No-args invocation delegates to `@dolmenwood/tui` — the Ink terminal UI, not the old `inquirer`-based `InteractiveService` (deleted; see `plan-tui-ink.md`)

**Not built (superseded, not pursued):**

- `travel <hex>` / `time <set>` / `camp` shortcut commands — the TUI's encounter form and `session` command cover this instead
- `--debug` flag / raw-roll pretty-printer — no demand surfaced once the TUI shipped full stat blocks

### Task 8: Error Handling & Logging -- PARTIAL

**Implemented:**

- Chalk styling throughout CLI output (`packages/cli/src/index.ts`)
- `Result<T, E>` success/failure everywhere in `core`; failures surface as readable messages in both CLI and TUI

**Not built:**

- [ ] Pretty-printer for raw Zod validation errors (currently just `.message`)
- [ ] `--debug` flag showing dice rolls and table paths

### Task 9: CI & Documentation -- COMPLETE

- GitHub Actions CI (`.github/workflows/ci.yml`) — build, lint, test, `pnpm audit --prod` (blocking) + informational audit, `pip-audit`
- Pre-commit hook for IP compliance (`scripts/ip-check.ts`)
- `README.md`, `PROJECT.md`, `CLAUDE.md`, `.claude/rules/*.md` — current dev-harness docs (superseded the old `AGENTS.md`)

## Acceptance Criteria

- [x] AC 1: Core Logic generates valid Encounter objects from context
- [x] AC 2: Nested table resolution (Encounter Type -> Common sub-table -> Creature)
- [x] AC 3: Session state persists across CLI restarts
- [x] AC 4: Invalid YAML data produces clear Zod validation errors
- [ ] AC 5: Debug mode shows raw dice rolls and table selection paths — not built (see Task 8)

## Known Limitations

1. **"Adventuring Party" encounters** are not yet supported. The `Common - Mortal` table references "Adventuring Party" as a creature, but it's actually a multi-step generation procedure. See `plan-adventuring-party-generation.md` for the implementation plan. Still open.

2. **Dungeon-context encounters.** `EncounterGenerator` hardcodes the Outdoors 30 ft distance roll (`EncounterGenerator.ts`) — `GenerationContext` has no Dungeon/indoor variant and there's no dungeon content in the project yet. New limitation, not in the original spec.

3. **No region-specific table overrides** have been tested against the full DCB region set — only a handful of hand-authored regional tables exist today. The fallback mechanism in code is exercised in production (TUI + CLI) but DCB's remaining regions aren't extracted; see `plan-dcb-encounter-table-extraction.md`.

Resolved since the original spec: the `generate`/`encounter` CLI command shipped, and the "Elf-Courtier or Knight" compound reference now resolves (encounter table entry converted to an array `ref`, matching `TableEntrySchema`'s `string | string[]`).

## Dependencies

- `commander`: CLI framework
- `js-yaml`: YAML parser
- `zod`: Schema validation
- `chalk`: Terminal styling (CLI and ETL)
- `vitest`: Testing framework
- `ink` + `react` + `@inkjs/ui` (in `@dolmenwood/tui`): the interactive layer — replaced `inquirer`, which is no longer a dependency anywhere in the workspace

## Testing Strategy

- **Unit Tests**: Mock `RandomProvider` to verify table logic with deterministic outcomes.
- **Schema Tests**: Verify Zod schemas accept/reject expected shapes.
- **Integration Tests**: End-to-end generator tests with real table data and seeded RNG.
- **BDD-style naming**: `describe('given... when... then...')` pattern.

## Next Steps

See `plan-adventuring-party-generation.md` for the next major feature. Also open: `plan-dcb-encounter-table-extraction.md` and `plan-dcb-hex-data-extraction.md` (Campaign Book content), and dungeon-context distance rolls (Known Limitation 2, no plan doc yet).

## Revision note (2026-09-14)

This spec described the project as of Task 6. Since then: the TUI plan
(`plan-tui-ink.md`) shipped and replaced the CLI's `InteractiveService`, the
creature-enrichment/treasure plan shipped in full, and the `generate` command
and CI landed. Statuses and limitations above are updated in place rather than
left stale; treat this doc as a historical design record for the parts that
haven't changed (schemas, generation flow, package boundaries) and the
"Revised" sections above for current state.
