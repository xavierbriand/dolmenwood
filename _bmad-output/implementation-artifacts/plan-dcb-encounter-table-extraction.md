---
title: 'DCB Encounter Table Extraction'
slug: 'dcb-encounter-table-extraction'
created: '2026-02-13'
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

# DCB Encounter Table Extraction

## Overview

Build a Python extractor that pulls all encounter tables from the Dolmenwood Campaign Book (DCB) PDF, plus TypeScript transform and load steps to produce validated YAML files in `assets/`. This replaces the manually-authored YAML encounter tables with ETL-generated ones and fills in the 10 missing regional tables plus the 2 missing Unseason tables.

### Current state

| Table Category                            | Current YAML               | Source | Status                                 |
| ----------------------------------------- | -------------------------- | ------ | -------------------------------------- |
| Encounter Type (4 tables, 1d8)            | `encounter-types.yaml`     | Manual | Complete                               |
| Activity (1 table, 1d20)                  | `activity.yaml`            | Manual | Complete                               |
| Common Encounters (4 sub-tables, 1d20)    | `common-encounters.yaml`   | Manual | Complete                               |
| Regional Encounters (12 sub-tables, 1d20) | `regional-encounters.yaml` | Manual | **Only 2 of 12** (Aldweald, High Wold) |
| Reaction (1 table, 2d6)                   | `reaction.yaml`            | Manual | Complete                               |
| Unseason - Chame (1 table, 1d10)          | —                          | —      | **Missing entirely**                   |
| Unseason - Vague (1 table, 1d10)          | —                          | —      | **Missing entirely**                   |

### Target state

All 24 tables extracted from DCB, validated against `RegionTableSchema`, and written to `assets/`. The manually-authored YAML files are superseded and can be archived or removed.

---

## Phase E1: Python Encounter Table Extractor

**Script:** `packages/etl/scripts/extract_dcb_encounters.py`

A new Python script following the same pattern as `extract_dcb_treasure.py` — using PyMuPDF (`fitz`) for font-aware, position-based extraction.

### Tables to extract

**Group 1: Simple tables** (text cells, no creature refs)

| Table    | Die  | Page range  | Structure        |
| -------- | ---- | ----------- | ---------------- |
| Activity | 1d20 | Single page | `{ roll, text }` |
| Reaction | 2d6  | Single page | `{ roll, text }` |

**Group 2: Encounter Type tables** (text cells referencing sub-table categories)

| Table                | Die | Columns              |
| -------------------- | --- | -------------------- |
| Daytime - Road/Track | 1d8 | Roll → Category name |
| Daytime - Wild       | 1d8 | Roll → Category name |
| Nighttime - Fire     | 1d8 | Roll → Category name |
| Nighttime - No Fire  | 1d8 | Roll → Category name |

**Group 3: Common Encounter sub-tables** (creature refs with dice counts)

| Sub-table         | Die  | Entries                         |
| ----------------- | ---- | ------------------------------- |
| Common - Animal   | 1d20 | 20 creatures with `(NdS)` count |
| Common - Monster  | 1d20 | 20 creatures                    |
| Common - Mortal   | 1d20 | 20 creatures                    |
| Common - Sentient | 1d20 | 20 creatures                    |

**Group 4: Regional Encounter sub-tables** (creature refs with dice counts)

12 sub-tables (one per region), each 1d20 with 20 entries:

Aldweald, Aquatic, Dwelmfurgh, Fever Marsh, Hag's Addle, High Wold, Mulchgrove, Nagwood, Northern Scratch, Table Downs, Tithelands, Valley of Wise Beasts.

**Group 5: Unseason tables** (creature refs with dice counts)

| Table            | Die  | Trigger |
| ---------------- | ---- | ------- |
| Unseason - Chame | 1d10 | 2-in-6  |
| Unseason - Vague | 1d10 | 2-in-6  |

### Extraction approach

The DCB encounter tables are laid out as multi-column tables in the PDF. PyMuPDF provides bounding box coordinates for every text span, enabling column/row assignment by position.

**Algorithm:**

1. **Identify table pages.** Scan for known section headers ("Encounter Type", "Common Encounters", "Regional Encounters", "Unseason") using font detection (section title fonts are distinct — large, bold, often using the `Winona` decorative font).

2. **Extract table grid.** For each table page:
   - Collect all text spans with position and font data.
   - Identify column headers by font (bold, smaller than section titles).
   - Sort spans into a grid by `(y, x)` position, grouping into rows by y-proximity (within a threshold, e.g. 3pt).
   - Assign columns by x-position ranges derived from column headers.

3. **Parse creature entries.** Each cell in Groups 3–5 follows the pattern:

   ```
   CreatureName[*†‡#] (DiceCount)
   ```

   Parse into:
   - `ref`: creature name (strip footnote markers `*`, `†`, `‡`, `#`, `+`)
   - `count`: dice expression in parentheses (e.g., `2d6`, `1d4`, `1`)
   - `qualifier`: for entries like `Thief (Bandit)†`, the parenthesized word before the footnote marker is a qualifier, not a count — detect by checking if the parens content matches a dice pattern.

4. **Handle special entries:**
   - **"Adventuring Party"** — no count, treated as text-type entry or uses a default count.
   - **Array refs** — "Elf-Courtier or Knight (1d4)" → `ref: ["Elf-Courtier", "Elf-Knight"]`.
   - **"Wild Hunt (see p355)"** — strip page reference, `ref: "Wild Hunt"`, no count.
   - **"The Hag (see p82)"** — strip page reference, `ref: "The Hag"`.
   - **"Atanuwë (see p45)"** — strip page reference, `ref: "Atanuwë"`.
   - **Footnote markers** — `*` (Animal), `†` (Adventurer), `‡` (Mortal), `#` (has special note). Strip from name, optionally preserve as metadata.
   - **Duplicate entries** — Some creatures appear multiple times in the same table (e.g., Pook Morel at rows 15-16 in Mulchgrove). Each gets its own entry with distinct `min`/`max`.

5. **Encounter Type tables.** Cells contain category names ("Animal", "Monster", "Mortal", "Sentient", "Regional"). Map to sub-table references:
   - "Animal" → `ref: "Common - Animal"`
   - "Monster" → `ref: "Common - Monster"`
   - "Mortal" → `ref: "Common - Mortal"`
   - "Sentient" → `ref: "Common - Sentient"`
   - "Regional" → `ref: "Regional"` (the actual regional table is resolved at runtime based on `regionId` in `GenerationContext`).

### Output format

**File:** `etl/output/extract/dcb-encounter-tables.json`

```json
{
  "encounterTypes": [
    {
      "name": "Encounter Type - Daytime - Road",
      "die": "1d8",
      "entries": [
        { "min": 1, "max": 1, "type": "SubTable", "ref": "Common - Animal" },
        { "min": 2, "max": 2, "type": "SubTable", "ref": "Common - Monster" },
        { "min": 3, "max": 4, "type": "SubTable", "ref": "Common - Mortal" },
        { "min": 5, "max": 6, "type": "SubTable", "ref": "Common - Sentient" },
        { "min": 7, "max": 8, "type": "SubTable", "ref": "Regional" }
      ]
    }
  ],
  "commonEncounters": [
    {
      "name": "Common - Animal",
      "die": "1d20",
      "entries": [
        {
          "min": 1,
          "max": 1,
          "type": "Creature",
          "ref": "Bat Giant",
          "count": "1d10"
        }
      ]
    }
  ],
  "regionalEncounters": [
    {
      "name": "Regional - Aldweald",
      "die": "1d20",
      "entries": [
        {
          "min": 1,
          "max": 1,
          "type": "Creature",
          "ref": "Antler Wraith",
          "count": "2d4"
        }
      ]
    }
  ],
  "unseasonEncounters": [
    {
      "name": "Unseason - Chame",
      "die": "1d10",
      "entries": [
        {
          "min": 1,
          "max": 1,
          "type": "Creature",
          "ref": "Galosher",
          "count": "2d6"
        }
      ]
    }
  ],
  "activity": {
    "name": "Activity",
    "die": "1d20",
    "entries": [{ "min": 1, "max": 1, "type": "Text", "ref": "Celebrating" }]
  },
  "reaction": {
    "name": "Reaction",
    "die": "2d6",
    "entries": [{ "min": 2, "max": 2, "type": "Text", "ref": "Attacks" }]
  }
}
```

### Known OCR / extraction challenges

The `rules/Encounter rules.md` was OCR'd from the source PDF and contains known artifacts:

| Artifact                 | Example                                                                    | Fix                                                                                             |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Garbled dice             | `3010` instead of `3d10`, `sad` instead of `1d4`, `1220` instead of `1d20` | PyMuPDF extracts clean text — these artifacts are from the OCR'd rules doc, not the PDF itself. |
| Mangled footnote markers | `Clerict` instead of `Cleric†`, `Huntert` instead of `Hunter†`             | PyMuPDF preserves Unicode — footnote markers (`†`, `‡`) will be distinct code points.           |
| Typos in rules doc       | `Voodgrue` instead of `Woodgrue`, `Marchant` instead of `Merchant`         | Use PDF as source of truth, not the rules doc.                                                  |

Since the extractor reads the **PDF directly** (not the OCR'd markdown), most of these artifacts will not appear. The rules doc serves only as a cross-reference for expected values.

### Validation

The script validates its own output before writing:

- Each table has exactly the right number of entries for its die (20 for 1d20, 8 for 1d8, etc.).
- All entries have non-empty `ref` values.
- All creature entries have valid dice expressions in `count`.
- Regional tables: exactly 12 tables, matching the known region names.
- Print summary counts and any warnings to stderr.

### Tests

No automated Python tests (consistent with existing extractors). Validation is built into the script. Output is verified downstream by TypeScript Zod schemas during the load phase.

---

## Phase E2: Config & TypeScript Transform Step

Add config paths and a transform step that reads the Python JSON output and performs any TypeScript-side normalization.

### Config additions

**File:** `packages/etl/src/config.ts`

```typescript
PY_DCB_ENCOUNTERS_JSON: path.join(EXTRACT_DIR, 'dcb-encounter-tables.json'),
```

### Transform step

**File:** `packages/etl/src/steps/transform-encounters.ts`

```typescript
export async function transformEncounters(): Promise<RegionTable[]> {
  const raw = await fs.readFile(PATHS.PY_DCB_ENCOUNTERS_JSON, 'utf-8');
  const data = JSON.parse(raw);

  const allTables: RegionTable[] = [];

  // Flatten all table groups into a single array
  for (const table of data.encounterTypes) allTables.push(table);
  for (const table of data.commonEncounters) allTables.push(table);
  for (const table of data.regionalEncounters) allTables.push(table);
  for (const table of data.unseasonEncounters) allTables.push(table);
  allTables.push(data.activity);
  allTables.push(data.reaction);

  return allTables;
}
```

The transform step is intentionally thin. The Python extractor does the heavy lifting. TypeScript handles:

1. **Creature name normalization** — Ensure extracted names match `creatures.yaml` naming conventions (e.g., comma-delimited qualifiers: `"Snail, Giant-Psionic"` not `"Snail Giant-Psionic"`; hyphenated subtypes: `"Wyrm-Black Bile"` not `"Wyrm Black Bile"`).
2. **Merge consecutive identical entries** — If the Python extractor outputs per-row entries (e.g., Pook Morel at rows 15 and 16), merge them into `{ min: 15, max: 16, ... }`.
3. **Validate ref names** — Cross-reference every creature `ref` against `assets/creatures.yaml` to catch extraction errors early (before the load step).

### Tests

**File:** `packages/etl/src/steps/transform-encounters.spec.ts`

- Reads a synthetic JSON fixture matching the Python output format.
- Verifies flattening produces the expected number of tables.
- Verifies creature name normalization (e.g., footnote markers stripped).
- Verifies consecutive duplicate entries are merged into ranges.

---

## Phase E3: Load Step — YAML Generation

Write validated tables to `assets/` as YAML files, replacing the manually-authored ones.

**File:** `packages/etl/src/steps/load-encounters.ts`

```typescript
export async function loadEncounters(tables: RegionTable[]): Promise<void> {
  // Group tables by category
  const encounterTypes = tables.filter((t) =>
    t.name.startsWith('Encounter Type'),
  );
  const common = tables.filter((t) => t.name.startsWith('Common'));
  const regional = tables.filter((t) => t.name.startsWith('Regional'));
  const unseason = tables.filter((t) => t.name.startsWith('Unseason'));
  const activity = tables.filter((t) => t.name === 'Activity');
  const reaction = tables.filter((t) => t.name === 'Reaction');

  // Validate each table against RegionTableSchema
  // Write each group to its YAML file
  await writeYaml(encounterTypes, 'encounter-types.yaml');
  await writeYaml(common, 'common-encounters.yaml');
  await writeYaml(regional, 'regional-encounters.yaml');
  await writeYaml(unseason, 'unseason-encounters.yaml'); // NEW file
  await writeYaml(activity, 'activity.yaml');
  await writeYaml(reaction, 'reaction.yaml');
}
```

**Key decisions:**

- Unseason tables go in a **new file** `assets/unseason-encounters.yaml` (not merged with regional).
- Each file contains an array of `RegionTable` objects, matching the existing YAML structure.
- Zod validation (`RegionTableSchema`) is applied to every table before writing. Any validation failure aborts the load with a clear error.

### Tests

**File:** `packages/etl/src/steps/load-encounters.spec.ts`

- Synthetic table data → Zod validation → YAML output.
- Verifies correct file grouping (encounter types in one file, common in another, etc.).
- Verifies Zod range validation catches gaps/overlaps in entries.

---

## Phase E4: ETL CLI Wiring & Reference Validation

### CLI updates

**File:** `packages/etl/src/index.ts`

Add encounter extraction to the pipeline:

```typescript
// New command
program
  .command('extract-encounters')
  .description('Run Python encounter table extractor on DCB PDF')
  .action(async () => {
    await runEncounterExtraction();
  });

// Updated 'all' command
// Step 0: Extract (PDFs → JSON)
// Step 1: Transform creatures (JSON → creatures.json)
// Step 1b: Transform encounters (JSON → validated tables)
// Step 2: Load creatures (creatures.json → YAML)
// Step 2b: Load encounters (tables → YAML)
// Step 2c: Load treasure tables (JSON → assets/treasure-tables.json)
// Step 3: Verify (cross-reference encounters ↔ bestiary)
```

### Reference validation updates

**File:** `packages/etl/src/steps/validate-refs.ts`

Extend to also validate:

1. **Unseason encounter refs** — Load `unseason-encounters.yaml` and check all creature refs against the bestiary.
2. **Encounter Type refs** — Verify that all sub-table references ("Common - Animal", "Regional", etc.) correspond to actual loaded tables.
3. **Summary report** — Print a complete coverage matrix:
   ```
   Encounter tables: 24 loaded
   Unique creature refs: 147
   Resolved: 142
   Deferred: 1 (Wild Hunt)
   Generic: 4 (Adventuring Party, etc.)
   Missing: 0
   ```

### Deferred refs update

**File:** `_bmad-output/implementation-artifacts/deferred-creature-refs.md`

Add any new deferred refs discovered during extraction (e.g., "Atanuwë" from Nagwood, "The Hag" from Hag's Addle — these are DCB-specific NPCs, not DMB creatures).

### Tests

**File:** `packages/etl/src/steps/validate-refs.spec.ts` (extend existing)

- Verify unseason table refs are checked.
- Verify new deferred refs are recognized.
- Verify summary counts.

---

## Phase E5: Core Schema & Generator Support for Unseason

The Unseason tables introduce a new encounter trigger mechanism that the current `EncounterGenerator` doesn't support.

### Domain rules for Unseason

- Dolmenwood has two "unseasons": **Chame** (a false summer) and **Vague** (a supernatural fog season).
- During an active unseason, there is a **2-in-6** chance of an unseason encounter (separate from the normal encounter check).
- Unseason encounters use **1d10** (not 1d20).
- The unseason encounter replaces the normal encounter for that check (they don't stack).

### GenerationContext extension

**File:** `packages/core/src/schemas/encounter.ts`

```typescript
export const GenerationContextSchema = z.object({
  regionId: z.string(),
  timeOfDay: z.enum(['Day', 'Night']).default('Day'),
  terrain: z.enum(['Road', 'Off-road']).default('Off-road'),
  camping: z.boolean().default(false),
  unseason: z.enum(['none', 'chame', 'vague']).default('none'), // NEW
});
```

### EncounterGenerator changes

**File:** `packages/core/src/services/EncounterGenerator.ts`

In `generateEncounter()`, before the normal encounter type roll:

1. If `context.unseason !== 'none'`, roll 2-in-6 chance.
2. If the unseason check succeeds, resolve directly from the unseason table (`"Unseason - Chame"` or `"Unseason - Vague"`) instead of going through the encounter type table.
3. If the unseason check fails, proceed with normal encounter generation.

### CLI changes

**File:** `packages/cli/src/index.ts`

Add `--unseason` option to the encounter command:

```typescript
.option('--unseason <season>', 'Active unseason (chame/vague)', 'none')
```

### Table loading

**File:** `packages/data/src/repositories/YamlTableRepository.ts`

The existing `YamlTableRepository` loads all YAML files in `assets/` except `creatures.yaml`. Since `unseason-encounters.yaml` follows the same `RegionTable` schema, it will be loaded automatically with no code changes.

### Tests

**File:** `packages/core/src/services/EncounterGenerator.spec.ts` (extend)

- **Unseason encounter triggers.** Seed random for 2-in-6 success. Verify the generator resolves from the unseason table.
- **Unseason encounter does not trigger.** Seed random for 2-in-6 failure. Verify normal encounter generation proceeds.
- **No unseason active.** Verify `unseason: 'none'` skips the check entirely.
- **Chame vs Vague table selection.** Verify correct table name is used for each unseason.

---

## Phasing & Dependencies

```
Phase E1 (Python extractor)
    │
    ▼
Phase E2 (TypeScript transform) ─── depends on E1 JSON output format
    │
    ▼
Phase E3 (YAML load) ─── depends on E2 for validated tables
    │
    ▼
Phase E4 (CLI wiring + validation) ─── depends on E3 for loaded YAML
    │
Phase E5 (Unseason support) ─── independent of E1-E3 (domain logic)
    │                            but needs E3 for integration testing
    ▼
All phases complete: full encounter table ETL pipeline
```

- **E1** is the largest phase and can be developed first.
- **E2-E3** are straightforward once E1 output format is stable.
- **E4** is integration wiring.
- **E5** can be developed in parallel with E2-E4 as it's primarily domain logic in `packages/core`.

## Testing Strategy

- **E1 (Python):** Built-in validation counts in the script. Manual comparison against OCR'd rules doc for spot checks. No pytest suite (matches existing convention).
- **E2 (Transform):** Synthetic JSON fixtures → Zod validation → assertion on table counts, names, entry ranges. Fast unit tests.
- **E3 (Load):** Synthetic tables → YAML file output → re-parse and validate roundtrip. No external deps.
- **E4 (Validation):** Existing `validate-refs` test patterns extended for new table categories.
- **E5 (Unseason):** Seeded `RandomProvider` tests for deterministic 2-in-6 rolls and table resolution.

## Resolved Questions

1. **Aquatic bypasses Encounter Type table** — ✅ This is already handled by `EncounterGenerator.getInitialTableName()` which can detect `regionId === 'aquatic'` and skip directly to `"Regional - Aquatic"`. No schema change needed — it's a routing decision in the generator.
2. **Array refs ("Elf-Courtier or Knight")** — ✅ Extracted as `ref: ["Elf-Courtier", "Elf-Knight"]`, matching the existing `TableEntrySchema` which supports `z.union([z.string(), z.array(z.string())])`.
3. **Deferred creature refs** — ✅ "Wild Hunt" is already in the `DEFERRED_REFS` allowlist. New DCB-specific NPCs ("Atanuwë", "The Hag") will be added to the allowlist and documented in `deferred-creature-refs.md`.
4. **Unseason trigger chance** — ✅ 2-in-6 is a domain rule, not a table property. It will be hardcoded in `EncounterGenerator` (or configurable via `GenerationContext` if we later want variable unseason intensity).
5. **Should manually-authored YAML be deleted?** — Deferred. The ETL-generated YAML will overwrite the existing files. The git history preserves the manual versions. We can keep or remove them after verifying the ETL output matches.
