---
title: 'DMB Creature ETL Pipeline'
slug: 'dmb-creature-etl-pipeline'
created: '2026-02-08'
revised: '2026-02-12'
status: 'complete'
tech_stack:
  - TypeScript
  - Node.js
  - pdf-parse
  - Zod
  - YAML
code_patterns:
  - ETL (Extract-Transform-Load)
  - CLI Command Pattern
  - Zod Validation
  - Monorepo Package
  - Slicer/Splitter/Parser Pipeline
test_patterns:
  - Unit tests per processor (Vitest)
  - Integration tests per pipeline branch (skipIf no source data)
  - Schema validation tests in Core
---

# Technical Specification: DMB Creature ETL Pipeline

## Status: Complete

All creature types from the Dolmenwood Monster Book are successfully extracted, transformed, and loaded. The pipeline produces 149 validated creatures (87 bestiary + 53 animals + 9 mortals + 9 adventurers with L1/L3/L5 variants) plus faction assignments.

## Overview

### Problem Statement

The Dolmenwood Monster Book (DMB) is a proprietary PDF. Creature statistics must be extracted into structured, schema-validated YAML for use by the encounter generator.

### Solution

A dedicated `@dolmenwood/etl` package with a CLI tool orchestrating a multi-branch pipeline:

1. **Extract**: `tmp/etl/DMB.pdf` -> `tmp/etl/dmb-raw.txt` (via `pdf-parse`)
2. **Transform**: `tmp/etl/dmb-raw.txt` -> `tmp/etl/creatures-intermediate.json` (via 4 parallel pipeline branches + faction assignment)
3. **Load**: `tmp/etl/creatures-intermediate.json` -> `assets/creatures.yaml` (via Zod validation + YAML serialization)

All intermediate files and the source PDF reside in a git-ignored `tmp/etl/` directory.

## Architecture

### Package Structure

```
packages/etl/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              CLI entry point (commander)
│   ├── config.ts             Paths & constants
│   ├── processors/
│   │   ├── Normalizer.ts     Text standardization (symbols, de-hyphenation, kerning)
│   │   ├── Chunker.ts        TOC extraction, bestiary section splitting, page filtering
│   │   ├── PageMerger.ts     Merge multi-page bestiary entries
│   │   ├── BestiaryStatParser.ts    Parse full-page bestiary stat blocks
│   │   ├── CompactStatParser.ts     Parse compact stat blocks (Animals, Mortals)
│   │   ├── AnimalSlicer.ts          Slice Animals section from normalized text
│   │   ├── AnimalSplitter.ts        Split Animals section into creature blocks
│   │   ├── MortalSlicer.ts          Slice Everyday Mortals section
│   │   ├── MortalSplitter.ts        Split Mortals into job-based blocks
│   │   ├── MortalStatParser.ts      Parse Mortals (shared stat block + per-job cloning)
│   │   ├── AdventurerSlicer.ts      Slice Adventurers section
│   │   ├── AdventurerSplitter.ts    Split into class blocks
│   │   ├── AdventurerStatParser.ts  Parse 3-level adventurer blocks (L1 base + L3/L5 variants)
│   │   └── FactionParser.ts         Extract faction-creature mapping
│   └── steps/
│       ├── extract.ts        PDF -> raw text
│       ├── transform.ts      Orchestrates all pipeline branches
│       ├── load.ts           JSON -> validated YAML
│       └── validate-refs.ts  Cross-reference check (encounters vs creatures)
└── test/
    └── processors/
        ├── Normalizer.spec.ts
        ├── Chunker.spec.ts
        ├── BestiaryStatParser.spec.ts
        ├── CompactStatParser.spec.ts
        ├── AnimalSlicer.spec.ts
        ├── AnimalSplitter.spec.ts
        ├── MortalSlicer.spec.ts
        ├── MortalSplitter.spec.ts
        ├── MortalStatParser.spec.ts
        ├── AdventurerSlicer.spec.ts
        ├── AdventurerSplitter.spec.ts
        ├── AdventurerStatParser.spec.ts
        ├── FactionParser.spec.ts
        ├── BestiaryPipeline.integration.spec.ts
        ├── AnimalsPipeline.integration.spec.ts
        ├── MortalsPipeline.integration.spec.ts
        ├── AdventurersPipeline.integration.spec.ts
        └── FactionParser.integration.spec.ts
```

### Data Flow

```
Extract (PDF -> raw text)
  |
Normalize (symbols, de-hyphenation, kerning dictionary)
  |
  +-- Branch 2a: Bestiary Pipeline (87 creatures)
  |     Chunker.extractTOC -> extractBestiarySection -> splitBestiaryPages
  |     -> filterValidPages -> PageMerger.merge -> BestiaryStatParser.parse
  |
  +-- Branch 2b: Animals Pipeline (53 creatures)
  |     AnimalSlicer.slice -> AnimalSplitter.split -> CompactStatParser.parse
  |
  +-- Branch 2c: Everyday Mortals Pipeline (9 creatures)
  |     MortalSlicer.slice -> MortalSplitter.split -> MortalStatParser.buildCreature
  |     (shared stat block cloned per job)
  |
  +-- Branch 2d: Adventurers Pipeline (9 creatures with variants)
  |     AdventurerSlicer.slice -> AdventurerSplitter.split -> AdventurerStatParser.parse
  |     (L1 base + L3/L5 as CreatureVariant[])
  |
  v
Merge all Creature[] arrays
  |
FactionParser.parse -> assignFactions (22 creatures get faction arrays)
  |
  v
Load (validate via CreatureSchema -> write assets/creatures.yaml)
```

### CLI Commands

| Command         | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `extract`       | PDF -> raw text                                                |
| `transform`     | Raw text -> intermediate JSON (runs all 4 branches + factions) |
| `load`          | Validate JSON -> write YAML                                    |
| `verify`        | Cross-reference encounter tables vs creature data              |
| `all [--clean]` | Run full pipeline (optionally clean tmp/ first)                |
| `clean`         | Remove tmp/etl/ directory                                      |

### Creature Schema

Defined in `packages/core/src/schemas/creature.ts`:

- **Base fields**: name, level, alignment, xp, numberAppearing, armourClass, movement, hitDice, attacks, morale
- **Optional fields**: treasure, save, kindred, type, description, faction (string[]), variants (CreatureVariant[])
- **CreatureVariant**: label, level, xp, armourClass, movement, hitDice, attacks, morale, numberAppearing, save?, description?

The variant model stores L1 as the base creature and L3/L5 as full-snapshot variants (no inheritance/delta).

### IP Protection

- `tmp/` and `assets/` are git-ignored
- A pre-commit hook (`scripts/ip-check.ts`) scans staged files for 40+ character passages from the source PDF
- Integration tests use `skipIf(!hasSourceData)` guards
- Unit tests use generic/synthetic data per AGENTS.md guidelines

### Test Coverage

- **148 tests** across ETL package (14 test files)
- Unit tests per processor with synthetic data
- Integration tests per pipeline branch against real source data (guarded)
- Schema validation tests in Core (8 tests)

## Known Gaps

1. **Reference mismatches**: 3 faction creatures (Knight, Cleric, Friar) appear in the faction list but their creature names resolve to adventurer class entries, not standalone creatures. The faction parser logs these as unmatched.
2. **"Adventuring Party"** is referenced in encounter tables but is a composite generation procedure, not a creature. See `plan-adventuring-party-generation.md`.
3. **"Elf-Courtier or Knight"** in the Sentient table is a compound reference requiring resolution logic in the encounter generator.
