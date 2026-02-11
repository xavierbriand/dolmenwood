---
title: 'Dolmenwood Encounter Generator'
slug: 'dolmenwood-encounter-generator'
created: 'Sat Feb 07 2026'
revised: '2026-02-12'
status: 'in-progress'
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
**Revised:** 2026-02-12

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
- Adventuring party generation procedure (see `plan-adventuring-party-generation.md`).

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
  ├── services/     InteractiveService
  └── index.ts      Commander CLI entry point

@dolmenwood/etl     ETL pipeline (separate concern, see tech-spec-dmb-creature-etl-pipeline.md)
```

**Dependency Rule:** `CLI -> Data -> Core`. Core knows nothing of the outer world.

### Data Files (assets/)

| File                       | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `creatures.yaml`           | 149 creatures with stats, variants, factions                |
| `encounter-types.yaml`     | 4 encounter type tables (Day/Night x Road/Wild/Fire/NoFire) |
| `common-encounters.yaml`   | Common sub-tables (Animal, Monster, Mortal, Sentient)       |
| `regional-encounters.yaml` | Region-specific encounter tables                            |
| `activity.yaml`            | Activity table (1d20)                                       |
| `reaction.yaml`            | Reaction table (2d6)                                        |

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

### Task 7: CLI Commands -- PARTIAL

**Implemented:**

- `session` command with interactive prompts (InteractiveService)
- Basic CLI scaffolding with Commander

**Not yet implemented:**

- [ ] `generate` command (calls EncounterGenerator, displays formatted result)
- [ ] `travel <hex>` shortcut command
- [ ] `time <set>` shortcut command
- [ ] `camp` toggle command
- [ ] `--debug` flag showing raw dice rolls and table paths

### Task 8: Error Handling & Logging -- NOT STARTED

- [ ] Pretty-printer for Zod validation errors
- [ ] Debug logger with `--debug` flag
- [ ] Chalk styling for CLI output

### Task 9: CI & Documentation -- PARTIAL

**Implemented:**

- Pre-commit hook for IP compliance (ip-check.ts)
- pnpm audit and eslint-plugin-security
- AGENTS.md with full development guidelines

**Not yet implemented:**

- [ ] GitHub Actions CI workflow for tests
- [ ] User-facing documentation (README, YAML editing guide)

## Acceptance Criteria

- [x] AC 1: Core Logic generates valid Encounter objects from context
- [x] AC 2: Nested table resolution (Encounter Type -> Common sub-table -> Creature)
- [x] AC 3: Session state persists across CLI restarts
- [x] AC 4: Invalid YAML data produces clear Zod validation errors
- [ ] AC 5: Debug mode shows raw dice rolls and table selection paths

## Known Limitations

1. **"Adventuring Party" encounters** are not yet supported. The encounter table references "Adventuring Party" as a creature, but it's actually a multi-step generation procedure. See `plan-adventuring-party-generation.md` for the implementation plan.

2. **"Elf-Courtier or Knight"** in the Sentient table is a compound reference that the generator does not yet handle (it would fail on creature lookup).

3. **No `generate` CLI command** yet. The core generator logic works but there's no CLI command wired up to invoke it and display results.

4. **No region-specific table overrides** have been tested with real data. The fallback mechanism exists in code but the YAML data files may not have localized variants for all common tables.

## Dependencies

- `commander`: CLI framework
- `inquirer`: Interactive prompts
- `js-yaml`: YAML parser
- `zod`: Schema validation
- `chalk`: Terminal styling (used in ETL, not yet in CLI)
- `vitest`: Testing framework

## Testing Strategy

- **Unit Tests**: Mock `RandomProvider` to verify table logic with deterministic outcomes.
- **Schema Tests**: Verify Zod schemas accept/reject expected shapes.
- **Integration Tests**: End-to-end generator tests with real table data and seeded RNG.
- **BDD-style naming**: `describe('given... when... then...')` pattern.

## Next Steps

See `plan-adventuring-party-generation.md` for the next major feature.

For the encounter generator itself:

1. Wire up the `generate` CLI command
2. Add `--debug` output
3. Handle compound creature references ("Elf-Courtier or Knight")
4. Add GitHub Actions CI
