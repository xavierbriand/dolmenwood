---
title: 'Creature Enrichment & Treasure Resolution'
slug: 'creature-enrichment-and-treasure'
created: '2026-02-12'
status: 'draft'
tech_stack:
  - Python (PyMuPDF/fitz)
  - TypeScript
  - Node.js
  - Zod
  - YAML
code_patterns:
  - ETL (Extract-Transform-Load)
  - Python pre-processing to JSON
  - Hexagonal Architecture
  - TDD
---

# Creature Enrichment & Treasure Resolution

## Overview

Two workstreams that build on the existing 158-creature ETL pipeline:

**A. Creature Enrichment** — Extract behaviour, speech, possessions, hoard, traits, encounters, lairs, and names from the DMB for all bestiary creatures. Extend the creature schema and re-run the pipeline.

**B. Treasure Resolution** — Extract the DCB "Placing Treasure" tables (Coins C1-C12, Riches R1-R12, Magic M1-M12) plus supporting tables (Gems, Art Objects, Magic Item Type and all 13 sub-category tables). Build a TreasureGenerator domain service that resolves hoard codes into concrete rolled treasure when an encounter is generated.

## Architectural Change: Python Extraction Layer

### Problem with pdf-parse

The current ETL uses `pdf-parse` (a Node.js wrapper around pdf.js) which produces unstructured flat text. This causes ~35% of the ETL codebase to exist solely as workarounds: kerning dictionaries, drop-cap fixes, description deduplication, section slicing by regex, page merging by TOC cross-reference.

### PyMuPDF advantage

PyMuPDF (`fitz`) provides:

- **Font metadata** per text span (name, size, bold/italic flags)
- **Bounding boxes** for position-based deduplication and table cell extraction
- **Clean text** from decorative fonts (the `Winona` font renders creature names correctly)
- **Labelled field extraction** — bold spans like `Behaviour`, `Speech`, `Possessions` are trivially identifiable

### New architecture

```
PDF files (DMB.pdf, DCB.pdf)
  │
  ▼ [EXTRACT — Python/PyMuPDF]
  │  Font-aware, structured extraction
  │  Outputs JSON files to tmp/etl/
  │
  ▼ [TRANSFORM — TypeScript]
  │  Domain-specific parsing, validation
  │  Schema enforcement via Zod
  │
  ▼ [LOAD — TypeScript]
     YAML serialization to assets/
```

Python scripts live in `packages/etl/scripts/` and are invoked by the ETL pipeline as a child process (or run standalone). They read PDFs from `tmp/etl/` and write structured JSON to `tmp/etl/`.

The existing TypeScript transform/load steps continue to handle domain logic, validation, and output — they just consume cleaner, pre-structured input.

---

## Workstream A: Creature Enrichment

### What to extract (DMB bestiary creatures only)

The DMB stat block format (documented on DMB p9) includes these fields after the stat line:

| Field       | Present in               | Description                                                    |
| ----------- | ------------------------ | -------------------------------------------------------------- |
| Behaviour   | Bestiary (87 creatures)  | General demeanour (short text)                                 |
| Speech      | Bestiary                 | How the creature speaks + languages (text)                     |
| Possessions | Bestiary                 | Items carried on person (text or "None")                       |
| Hoard       | Bestiary + some appendix | Lair treasure codes + extras (already extracted as `treasure`) |

Additionally, below the stat block:
| Field | Description |
|-------|-------------|
| Traits | d-table of appearance/behaviour variations |
| Encounters | d-table of encounter scenario seeds |
| Lairs | d-table of lair descriptions |
| Names | List of example names (sentient creatures only) |

Animals, Mortals, and Adventurers use compact stat blocks that do NOT have behaviour/speech/traits/encounters/lairs/names fields. They keep their current data shape.

### Phase A1: Python extractor for DMB creatures

**Script:** `packages/etl/scripts/extract_dmb.py`

Uses PyMuPDF to extract each bestiary creature page into a structured JSON object:

```json
{
  "name": "Barrowbogey",
  "description": "Waif-like fairies (3' tall) with saggy, wrinkled skin...",
  "meta": "Small Fairy—Sentient—Any Alignment",
  "stats": {
    "level": "3", "ac": "13", "hp": "3d8 (13)",
    "saves": "D11 R12 H13 B14 S15",
    "attacks": ["2 scratches (+2, 1d4)", "2 bramble darts (+2, 1d4, range 20'/40'/60')"],
    "speed": "40", "morale": "9", "xp": "40",
    "encounters": "2d6 (25% in lair)"
  },
  "behaviour": "Sharp-witted, wild, tricksome",
  "speech": "Tinny voice emanating from head-pot. Sylvan, Woldish (1-in-3 chance)",
  "possessions": "None",
  "hoard": "C4 + R4 + M1 + 4d20 pots or jugs",
  "abilities": [...],
  "traits": [...],
  "encounterSeeds": [...],
  "lairSeeds": [...],
  "names": [...]
}
```

**Detection strategy:**

- Creature boundary: `Winona` font at size ~35 = creature name
- Stat fields: bold spans (`TheAntiquaB-W8ExtraBold`) at size ~10.5 followed by plain text
- Section headers: `AlegreyaSans` font at size ~14 = `TRAITS`, `ENCOUNTERS`, `LAIRS`
- Description dedup: detect overlapping bounding boxes (the PDF has twin text layers for decorative headers)
- Multi-page creatures: when a page has no `Winona` header, it's a continuation of the previous creature

**Output:** `tmp/etl/dmb-bestiary.json` (array of creature objects)

Also extract appendix creatures (animals, mortals, adventurers) with the same approach, producing:

- `tmp/etl/dmb-animals.json`
- `tmp/etl/dmb-mortals.json`
- `tmp/etl/dmb-adventurers.json`

### Phase A2: Extend Core creature schema

Add to `CreatureSchema`:

```typescript
behaviour: z.string().optional(),
speech: z.string().optional(),
possessions: z.string().optional(),
// traits, encounterSeeds, lairSeeds, names are new schemas:
traits: z.array(z.string()).optional(),
encounterSeeds: z.array(z.string()).optional(),
lairSeeds: z.array(z.string()).optional(),
names: z.array(z.string()).optional(),
```

### Phase A3: Update TypeScript transform step

Refactor the transform step to consume the new JSON structure from Python extraction instead of running the current Normalizer → Chunker → Slicer → Splitter → Parser chain for bestiary creatures.

The existing TypeScript processors for stat parsing can be simplified since the Python layer provides pre-structured fields. The transform step focuses on:

- Zod validation
- Domain-level normalization (e.g., parsing the meta line into size/kindred/alignment)
- Faction assignment (reuse existing FactionParser)
- Merging all creature sources into a single output

### Phase A4: Deprecate pdf-parse pipeline

Once the Python extraction is validated against the existing output (same 158 creatures, same stat values), the following processors can be retired:

- Normalizer, Chunker, PageMerger
- AnimalSlicer, MortalSlicer, AdventurerSlicer
- AnimalSplitter, MortalSplitter, AdventurerSplitter
- BestiaryStatParser (replaced by Python extraction + lighter TS validation)
- CompactStatParser (same)
- MortalStatParser, AdventurerStatParser (same)

The kerning dictionary disappears entirely.

---

## Workstream B: Treasure Resolution

### Phase B1: Python extractor for DCB treasure tables

**Script:** `packages/etl/scripts/extract_dcb_treasure.py`

Extracts pages 393-432 of the DCB (Part 7: Treasures and Oddments) into structured JSON.

#### Core hoard tables (p393-394)

```json
{
  "coins": {
    "C1": {
      "copper": { "chance": 25, "quantity": "1d4 * 1000" },
      "silver": { "chance": 10, "quantity": "1d3 * 1000" },
      "gold": null,
      "pellucidium": null,
      "averageValue": 25
    },
    ...
  },
  "riches": {
    "R1": {
      "gems": { "chance": 50, "quantity": "1d4" },
      "artObjects": null,
      "averageValue": 250
    },
    ...
  },
  "magicItems": {
    "M1": {
      "chance": 10,
      "items": "1 armour or weapon (equal chance of either)",
      "averageValue": 670
    },
    ...
  },
  "magicItemType": [
    { "min": 1, "max": 5, "type": "Amulet / talisman" },
    { "min": 6, "max": 20, "type": "Magic armour" },
    ...
  ],
  "treasureHoard": [
    { "min": 1, "max": 16, "description": "Coins (1d4 x 1,000gp)", "averageValue": 2500 },
    ...
  ]
}
```

#### Gem and Art Object tables (p395-396)

```json
{
  "gemValue": [
    { "min": 1, "max": 20, "category": "Ornamental", "value": 10 },
    { "min": 21, "max": 45, "category": "Semi-precious", "value": 50 },
    ...
  ],
  "gemType": {
    "Ornamental": ["Azurite", "Banded agate", ...],
    "Semi-precious": ["Bloodstone", "Carnelian", ...],
    ...
  },
  "jewellery": [
    { "min": 1, "max": 3, "type": "Anklet" },
    ...
  ],
  "miscArtObjects": [
    { "min": 1, "max": 1, "type": "Armour" },
    ...
  ],
  "preciousMaterials": [
    { "roll": 1, "material": "Alabaster" },
    ...
  ],
  "embellishments": [
    { "roll": 1, "embellishment": "Adorned with feathers" },
    ...
  ]
}
```

#### Magic item sub-tables (p398-432)

Each of the 13 magic item categories extracted as a table:

```json
{
  "amulets": [
    { "name": "Amulet of Breath", "value": 5000, "summary": "Breathe in air and underwater" },
    ...
  ],
  "magicArmour": [
    { "min": 1, "max": 10, "type": "Leather armour", "value": 6000 },
    ...
  ],
  "potions": [
    { "name": "Aethers of Starlight", "value": 2000, "summary": "See magic and invisible" },
    ...
  ],
  ...
}
```

**Output:** `tmp/etl/dcb-treasure-tables.json`

### Phase B2: Core treasure schemas

**File:** `packages/core/src/schemas/treasure.ts`

Define Zod schemas for:

- `TreasureSpecSchema` — parsed representation of a hoard code string like `C4 + R4 + M1`
- `CoinsTierSchema`, `RichesTierSchema`, `MagicTierSchema` — table row definitions
- `TreasureTablesSchema` — the full treasure tables data structure
- `RolledTreasureSchema` — the output of rolling treasure:

```typescript
const RolledTreasureSchema = z.object({
  coins: z.object({
    copper: z.number(),
    silver: z.number(),
    gold: z.number(),
    pellucidium: z.number(),
  }),
  gems: z.array(
    z.object({
      type: z.string(),
      category: z.string(),
      value: z.number(),
    }),
  ),
  artObjects: z.array(
    z.object({
      type: z.string(),
      material: z.string().optional(),
      embellishment: z.string().optional(),
      value: z.number(),
    }),
  ),
  magicItems: z.array(
    z.object({
      category: z.string(),
      name: z.string(),
      value: z.number(),
    }),
  ),
  totalValue: z.number(),
});
```

### Phase B3: Treasure code parser

**File:** `packages/core/src/services/TreasureCodeParser.ts`

Parses the opaque treasure string from creature data into a structured `TreasureSpec`:

```
"C4 + R4 + M1 + 4d20 pots or jugs"
→ {
    codes: [
      { category: 'coins', tier: 4 },
      { category: 'riches', tier: 4 },
      { category: 'magic', tier: 1 },
    ],
    extras: ["4d20 pots or jugs"]
  }
```

Also handles:

- Multiplied categories: `(R1 x 3)` → 3 separate R1 rolls
- Direct value formats: `2d100sp + 1-in-4 chance of 1 gem`
- Special values: `None`, `Ivory`, `Magical honey`

### Phase B4: TreasureGenerator service

**File:** `packages/core/src/services/TreasureGenerator.ts`

**Port:** `packages/core/src/ports/TreasureTableRepository.ts`

```typescript
interface TreasureTableRepository {
  getTreasureTables(): Promise<Result<TreasureTables>>;
}

class TreasureGenerator {
  constructor(
    private tables: TreasureTables,
    private random: RandomProvider,
  ) {}

  rollHoard(spec: TreasureSpec): RolledTreasure { ... }
}
```

Rolling algorithm (per the DCB rules on p392):

1. For each C/R/M code in the spec, look up the table row
2. For each entry in the row (copper, silver, gold, pp / gems, art / magic items):
   a. Roll d100 against the % chance
   b. If present, roll the quantity dice
   c. For gems: roll value on Gem Value table, optionally roll type on Gem Type table
   d. For art objects: roll 3d6 x 100gp value, optionally roll type on Jewellery or Misc table
   e. For magic items: roll on Magic Item Type d100 table, then roll on the sub-category table
3. Sum total value

### Phase B5: Data adapter

**File:** `packages/data/src/repositories/YamlTreasureTableRepository.ts`

Loads `assets/treasure-tables.yaml` (converted from ETL JSON output), validates against `TreasureTablesSchema`.

### Phase B6: Wire into EncounterGenerator

Update `EncounterGenerator` to:

1. Accept `TreasureGenerator` as a dependency
2. After resolving a creature, parse its `treasure` field via `TreasureCodeParser`
3. Roll the hoard via `TreasureGenerator.rollHoard()`
4. Include the `RolledTreasure` in the encounter result

Update `EncounterSchema.details` to include:

```typescript
treasure: RolledTreasureSchema.optional(),
possessions: z.string().optional(),
```

---

## ETL Pipeline Changes

### Updated pipeline commands

```
pnpm --filter @dolmenwood/etl start extract    # Python extraction (new)
pnpm --filter @dolmenwood/etl start transform   # TS transform (simplified)
pnpm --filter @dolmenwood/etl start load        # TS load (unchanged)
pnpm --filter @dolmenwood/etl start verify      # TS verify (unchanged)
pnpm --filter @dolmenwood/etl start all         # Full pipeline
```

The `extract` command invokes the Python scripts as child processes:

```typescript
import { execFileSync } from 'node:child_process';
execFileSync('python3', ['scripts/extract_dmb.py', inputPath, outputDir]);
execFileSync('python3', [
  'scripts/extract_dcb_treasure.py',
  inputPath,
  outputDir,
]);
```

### Existing ETL code disposition

| Current processor                                  | Disposition                                            |
| -------------------------------------------------- | ------------------------------------------------------ |
| Normalizer                                         | Retire — PyMuPDF handles font artifacts                |
| Chunker                                            | Retire — PyMuPDF font detection replaces section regex |
| PageMerger                                         | Retire — PyMuPDF detects multi-page creatures          |
| AnimalSlicer, MortalSlicer, AdventurerSlicer       | Retire — PyMuPDF sections by font                      |
| AnimalSplitter, MortalSplitter, AdventurerSplitter | Retire — PyMuPDF splits by creature name font          |
| BestiaryStatParser                                 | Retire — Python extracts structured fields             |
| CompactStatParser                                  | Retire — Python extracts structured fields             |
| MortalStatParser, AdventurerStatParser             | Retire — Python extracts structured fields             |
| FactionParser                                      | Keep — domain logic for faction assignment             |
| validate-refs                                      | Keep — cross-referencing encounters vs creatures       |
| load step                                          | Keep — Zod validation + YAML output                    |

---

## Phasing & Dependencies

```
Phase A1 (Python DMB extractor) ──→ Phase A2 (schema) ──→ Phase A3 (TS transform) ──→ Phase A4 (retire old)
                                         │
Phase B1 (Python DCB extractor) ──→ Phase B2 (schema) ──→ Phase B3 (parser) ──→ Phase B4 (generator) ──→ Phase B5 (adapter) ──→ Phase B6 (wiring)
```

A1 and B1 can be developed in parallel (independent Python scripts).
A2 and B2 can be developed in parallel (independent schema files).
A3 depends on A1+A2. B3 depends on B2. B4 depends on B2+B3. B6 depends on A3+B4.

## Testing Strategy

- Python scripts: tested by running them and validating JSON output structure + creature counts against known values (e.g., 87 bestiary creatures)
- Core schemas: Zod schema tests with synthetic data
- TreasureCodeParser: unit tests with known treasure strings
- TreasureGenerator: unit tests with seeded RNG and known table data, verifying rolled values
- Integration: end-to-end pipeline run comparing enriched output against current 158-creature baseline (no regressions)

## Resolved Questions

1. **Garbled treasure values** — ✅ Fix via Python extractor. PyMuPDF can precisely identify the `Hoard` bold label boundary, fixing the 2 corrupted treasure strings at the source.
2. **Magic item detail depth** — ✅ Full depth. Roll all the way to specific items (e.g., "Aethers of Starlight") with values and summaries. The tables are finite and already being extracted.
3. **Possessions vs Hoard distinction** — ✅ Context-dependent. Roll possessions for wandering encounters and hoard for lair encounters (30% base lair chance per encounter rules).
