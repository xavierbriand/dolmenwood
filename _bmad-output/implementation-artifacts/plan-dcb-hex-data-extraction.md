---
title: 'DCB Hex Data Extraction'
slug: 'dcb-hex-data-extraction'
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

# DCB Hex Data Extraction

## Overview

Extract structured hex data from the Dolmenwood Campaign Book (DCB) PDF — every hex's ID, name, terrain type(s), region, lost/encounter chance, and foraging chance — and build a hex lookup system that lets the CLI accept a hex ID instead of a free-form region string, automatically resolving terrain, region, and encounter probability.

### Current state

- **No hex data** exists anywhere in the codebase.
- `GenerationContext.regionId` is a free-form `z.string()` with no validation.
- `GenerationContext.terrain` is a binary `'Road' | 'Off-road'` — not the 12 specific terrain types from the rules.
- Encounter probability is not modeled — every encounter is generated unconditionally.
- Foraging is not modeled. Foraging chance is terrain-derived (not per-hex), and 57/200 hexes have special foraging results.
- The `travel <hex>` command mentioned in the tech spec (`tech-spec-dolmenwood-encounter-generator.md` line 176) is listed as not implemented.
- `project-context.md` line 131 establishes that hex IDs must be normalized to `DDDD` format (e.g., `0101`).

### Target state

- `assets/hexes.yaml` contains all 200 DCB hexes with structured data.
- A `HexRepository` port in core and a `YamlHexRepository` adapter in data.
- `GenerationContext` accepts an optional `hexId` — when provided, the generator resolves region (primary from `regions[0]`), terrain, and encounter chance automatically.
- The CLI `encounter` command accepts `<hex_id>` as an alternative to `<region_id>`.
- Interactive mode offers hex-based input alongside region selection.
- Encounter chance (X-in-6, where X is 1–3) is rolled before generating, matching the terrain difficulty rules.
- Foraging chance is derived from terrain difficulty and displayed alongside hex info. Special foraging notes (57 hexes) are shown when available.
- Dual-region hexes (20 hexes) use primary region for encounter table lookup.

---

## Phase H1: Python Hex Extractor

**Script:** `packages/etl/scripts/extract_dcb_hexes.py`

A new Python script following the same PyMuPDF pattern as `extract_dmb.py` and `extract_dcb_treasure.py`.

### DCB hex page structure (from PDF analysis)

Each hex occupies one page (occasionally spanning into content on the next). The page layout is **two-column** but the hex header fields are always in a predictable location. Every page with a hex entry has:

1. **Hex ID** — `TheAntiquaB-W9Black` font at 20.0pt, matching `^\d{4}$`. Can appear in either the left column (x≈36) or right column (x≈512). This is the primary anchor.
2. **Hex name** — `AlverataBl` font at 16.6pt. Decorative title like `THE OUTLOOK AND THE RED MONOLITH`. Always on the same page as the hex ID.
3. **Structured header fields** — `TheAntiquaB-W8ExtraBold` font at 9.5pt, always in the left column area (x≈55), with y < 250. The labels appear in this order:
   - **`Terrain:`** (200/200 hexes — always present)
   - **`Lost/encounters:`** (200/200 hexes — always present)
   - **`Ley Line *:` / `Ley line *:`** (48/200 hexes — optional, various ley line names)
   - **`Within the Ring of Chell (p20):`** (37/200 hexes — optional)
   - **`Foraging:`** (57/200 hexes — optional, NOT universal)
4. **Content body** — below the structured header. Contains location descriptions, NPCs, stat blocks, etc. using `Alverata-Bold` 12pt for sub-section titles and `W7Bold` 9.5pt for inline bold labels.

The field values (plain text following each ExtraBold label) use `TheAntiquaB-W5Plain` at 9.5pt.

### What to extract

| Field           | Example                                            | Notes                                                                                                                          |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Hex ID          | `0106`                                             | 4-digit format `DDDD`. 200 hexes on a 19×12 grid (columns 01–19, rows 01–12) with 28 missing hexes at the SE corner.           |
| Name            | `THE OUTLOOK AND THE RED MONOLITH`                 | Decorative title in `AlverataBl` font.                                                                                         |
| Terrain         | `Tangled forest (3), High Wold`                    | One or more terrain types with optional `(N)` count, then region(s) after last comma. See terrain parsing below.               |
| Region(s)       | `High Wold` or `High Wold / Dwelmfurgh`            | Extracted from the terrain line. 20 hexes have dual regions separated by `/`.                                                  |
| Lost/Encounters | `2-in-6`                                           | Always starts with `N-in-6` (N is 1, 2, or 3). Values: 57× `1-in-6`, 99× `2-in-6`, 44× `3-in-6`.                               |
| Encounter notes | `2-in-6 chance of meeting a [creature]...`         | Optional prose after the `N-in-6` base chance. Caution: text from the hex body can bleed in; truncate at first sentence break. |
| Ley lines       | `Ley Line Chell`, `Ley line Ywyr`, etc.            | 48 hexes. Optional — out of scope for encounter generation but captured for completeness.                                      |
| Foraging        | `Foraging here produces 1d3 servings of [herb]...` | 57 hexes only. No `N-in-6` chance in the field itself; foraging chance is implied by terrain difficulty.                       |

### Extraction approach

1. **Scan all pages** for `W9Black` 20pt spans matching `^\d{4}$` to locate hex pages. Expected: 200 hexes (pages ~191–390).

2. **For each hex page**, collect all spans and extract:
   - **Hex ID**: the `W9Black` span.
   - **Hex name**: the `AlverataBl` 16.6pt span on the same page.
   - **Structured fields**: iterate spans after the hex ID, collecting text for each `W8ExtraBold` label (`Terrain`, `Lost/encounters`, `Foraging`). Stop collecting a field's text when the next `W8ExtraBold` label is encountered, or when a `W9Black` (next hex ID), `Alverata-Bold` 12pt (content sub-section), or stat block label (`Level`, `AC`, `HP`, etc.) is reached.

3. **Important**: The field labels and values are interleaved in the span stream. A label like `Terrain:` (ExtraBold) is immediately followed by its value spans (Plain). The ley line labels (`Ley Line Chell (p18):`, `Within the Ring of Chell (p20):`) are also ExtraBold and must be recognized and skipped (or optionally captured) without breaking the collection of Terrain/Lost/Foraging.

### Terrain parsing

The terrain field is the most complex to parse. The raw text follows the pattern:

```
<terrain_type> (<count>)[, <terrain_type> (<count>)], <region>[/ <region>]
```

**Observed patterns** (from all 200 hexes):

| Pattern                                                 | Count | Example hex |
| ------------------------------------------------------- | ----: | ----------- |
| `<terrain> (N), <region>`                               |   155 | 0106        |
| `<terrain> (N), <region> / <region>`                    |    15 | 0204        |
| `Aquatic, <region>`                                     |     2 | 0605        |
| `Aquatic / <terrain>, <region>`                         |     2 | 0707        |
| `Aquatic / <abbrev_terrain>, <region> / <region>`       |     1 | 0806        |
| `<terrain> (N), <region>/<region>` (no spaces around /) |     2 | 1111, 0403  |
| `<terrain> (N), <region>.` (trailing period)            |     1 | 0111        |
| `<terrain> (N), <region_abbrev>` (abbreviated)          |     2 | 0304, 0503  |

**Known terrain types** (12 total, from rules doc):

| Category  | Terrain Types                                       | Encounter Chance |
| --------- | --------------------------------------------------- | ---------------- |
| Light     | Farmland, Fungal forest, Hills, Meadow, Open forest | 1-in-6           |
| Moderate  | Bog, Hilly forest, Tangled forest                   | 2-in-6           |
| Difficult | Boggy forest, Craggy forest, Swamp, Thorny forest   | 3-in-6           |

**Known regions** (12 total): Aldweald, Dwelmfurgh, Fever Marsh, Hag's Addle, High Wold, Mulchgrove, Nagwood, Northern Scratch, Table Downs, Tithelands, Valley of Wise Beasts. Note: `Aquatic` is a terrain type, NOT a region (despite the original plan listing it as one).

**Abbreviation normalization** required:

- `tang. forest` → `Tangled forest`
- `Northern Scr.` / `Northern Scr` → `Northern Scratch`
- `High wold` → `High Wold` (case normalization, hex 0311)
- Trailing `.` must be stripped (hex 0111: `High Wold.`)

**Parsing algorithm:**

1. Strip trailing period.
2. Split on the **last comma** to separate terrain part from region part.
3. **Region part**: normalize abbreviations, split on `/` (with optional surrounding whitespace) for dual-region hexes. Validate each against known regions.
4. **Terrain part**: split on `/` for Aquatic combinations (e.g., `Aquatic / tangled forest`). For each terrain segment, match against known terrain types (case-insensitive), extract optional `(N)` count. Aquatic has no count.
5. If no parenthesized count, default to the hex's total sub-hex count (typically the number in parens for the main terrain, or 1 for Aquatic).

### Lost/encounters parsing

The field always starts with `N-in-6`. The challenge is that text from the hex content body can bleed into this field due to the span collection approach.

**Parsing rules:**

1. Extract the `(\d)-in-6` prefix as `encounterChance` (integer 1–3).
2. Everything after the `N-in-6` prefix (up to the next ExtraBold label) is `encounterNotes`.
3. **Truncation heuristic**: The encounter notes are short prose (1–2 sentences). If the collected text exceeds ~200 characters, it likely contains bleed from the hex body. Truncate at the last sentence-ending period before 200 chars. For entries where `Lost/encounters` text transitions directly into a named NPC description or stat block without a sentence break, take only the first sentence.

### Foraging extraction

Present on only 57/200 hexes. The foraging field does NOT contain an `N-in-6` chance — instead it describes what can be foraged (e.g., `Foraging here produces 1d3 servings of [herb] (DPB), on top of normal results.`).

The `foragingChance` in the original plan was incorrectly assumed to be per-hex. In the actual DCB, foraging chance is determined by terrain difficulty (same as encounter chance), not a per-hex value. The per-hex foraging field only describes **special foraging results** (bonus herbs/ingredients).

**Revised extraction:**

- `foragingNotes`: the raw text of the Foraging field (string, may be empty).
- `foragingChance`: **removed from per-hex data** — it is derived from terrain difficulty at runtime.

### Ley line extraction (optional, captured for completeness)

48 hexes have ley line fields. These appear as ExtraBold labels between `Lost/encounters` and `Foraging`:

- `Ley Line Chell (p18):` (14×)
- `Ley line Ywyr (p18):` (13×)
- `Ley line Hoad (p18):` (12×)
- `Ley line Lamm (p18):` (10×)
- `Ley line crossing <A>/<B>:` (5×)
- `Ley line proximity <A>/<B>:` (2×)
- `Within the Ring of Chell (p20):` (37×)

**Extraction**: Capture ley line names as a string array (e.g., `["Chell", "Ywyr"]`). The text values are generic rules references and don't need per-hex capture.

### Output format

**File:** `etl/output/extract/dcb-hexes.json`

```json
[
  {
    "id": "0106",
    "name": "The Outlook and the Red Monolith",
    "terrain": [{ "type": "Tangled forest", "count": 3 }],
    "regions": ["High Wold"],
    "encounterChance": 2,
    "encounterNotes": "",
    "foragingNotes": "Foraging here produces 1d3 servings of [herb] (DPB), on top of normal results.",
    "leyLines": []
  },
  {
    "id": "0204",
    "name": "The Summerstone Uruzzur",
    "terrain": [{ "type": "Bog", "count": 3 }],
    "regions": ["Northern Scratch", "Dwelmfurgh"],
    "encounterChance": 2,
    "encounterNotes": "",
    "foragingNotes": "",
    "leyLines": ["Chell"]
  },
  {
    "id": "0806",
    "name": "The Palace of the Witch Queen",
    "terrain": [
      { "type": "Aquatic", "count": 1 },
      { "type": "Tangled forest", "count": 1 }
    ],
    "regions": ["Aldweald", "Dwelmfurgh"],
    "encounterChance": 2,
    "encounterNotes": "Water-based encounters have a 2-in-6 chance of involving [creature] (p253).",
    "foragingNotes": "",
    "leyLines": ["Chell"]
  }
]
```

**Key changes from original plan:**

- `region` → `regions` (array) to handle dual-region hexes.
- Removed `foragingChance` (derived from terrain, not per-hex).
- Added `leyLines` array.
- `name` is title-cased (normalized from ALL CAPS in the PDF).

### Validation

The script validates before writing:

- Every hex ID matches `^\d{4}$`.
- No duplicate hex IDs.
- Total count is exactly 200.
- Every region in every hex matches one of the 12 known region names.
- Every terrain type matches one of the 12 known terrain types (after normalization).
- `encounterChance` is an integer 1–3 (observed range from all 200 hexes).
- Print summary: total hexes, hexes per region, terrain type distribution, ley line count, foraging count.

### Tests

No automated Python tests (consistent with existing extractor convention). Validation is built into the script. Output is verified downstream by TypeScript Zod schemas.

---

## Phase H2: Core Hex Schema & Port

Define the hex domain model in `packages/core`.

### Hex schema

**File:** `packages/core/src/schemas/hex.ts`

```typescript
import { z } from 'zod';

export const HexTerrainSchema = z.object({
  type: z.string(),
  count: z.number().int().min(1).default(1),
});

export const HexSchema = z.object({
  id: z.string().regex(/^\d{4}$/, 'Hex ID must be 4 digits'),
  name: z.string(),
  terrain: z.array(HexTerrainSchema).min(1),
  regions: z.array(z.string()).min(1), // Array: 180 hexes have 1 region, 20 have 2
  encounterChance: z.number().int().min(1).max(3), // Observed range: 1–3
  encounterNotes: z.string().optional(),
  foragingNotes: z.string().optional(), // 57/200 hexes; no per-hex foragingChance
  leyLines: z.array(z.string()).optional(), // e.g., ["Chell", "Ywyr"]
});

export type HexTerrain = z.infer<typeof HexTerrainSchema>;
export type Hex = z.infer<typeof HexSchema>;
```

**Key differences from original plan:**

- `region: string` → `regions: string[]` — 20 hexes straddle two regions (e.g., `High Wold / Dwelmfurgh`). The first region is the "primary" one used for encounter table lookup.
- `foragingChance` removed — foraging chance is terrain-derived, not per-hex. The `foragingNotes` field captures special foraging results for the 57 hexes that have them.
- `encounterChance` range tightened to 1–3 (matching observed data).
- `leyLines` added for completeness (48 hexes).

### Terrain difficulty mapping

**File:** `packages/core/src/domain/Terrain.ts`

A pure domain module mapping terrain types to difficulty categories and encounter/foraging chances:

```typescript
export type TerrainDifficulty = 'Light' | 'Moderate' | 'Difficult';

export const TERRAIN_DIFFICULTY: Record<string, TerrainDifficulty> = {
  Farmland: 'Light',
  'Fungal forest': 'Light',
  Hills: 'Light',
  Meadow: 'Light',
  'Open forest': 'Light',
  Bog: 'Moderate',
  'Hilly forest': 'Moderate',
  'Tangled forest': 'Moderate',
  'Boggy forest': 'Difficult',
  'Craggy forest': 'Difficult',
  Swamp: 'Difficult',
  'Thorny forest': 'Difficult',
};

/** Aquatic is a special terrain — it uses the hex's encounterChance directly. */
export const AQUATIC_TERRAIN = 'Aquatic';

export const DIFFICULTY_ENCOUNTER_CHANCE: Record<TerrainDifficulty, number> = {
  Light: 1,
  Moderate: 2,
  Difficult: 3,
};

/**
 * Foraging chance by terrain difficulty (from rules).
 * Foraging chance is terrain-derived, NOT a per-hex value.
 */
export const DIFFICULTY_FORAGING_CHANCE: Record<TerrainDifficulty, number> = {
  Light: 1,
  Moderate: 2,
  Difficult: 3,
};

export function getTerrainDifficulty(
  terrainType: string,
): TerrainDifficulty | undefined {
  return TERRAIN_DIFFICULTY[terrainType];
}

export function getEncounterChance(terrainType: string): number {
  const difficulty = getTerrainDifficulty(terrainType);
  return difficulty ? DIFFICULTY_ENCOUNTER_CHANCE[difficulty] : 1;
}

export function getForagingChance(terrainType: string): number {
  const difficulty = getTerrainDifficulty(terrainType);
  return difficulty ? DIFFICULTY_FORAGING_CHANCE[difficulty] : 1;
}
```

Note: `Aquatic` is intentionally excluded from `TERRAIN_DIFFICULTY`. Aquatic hexes use the `encounterChance` from the hex data directly (always 2-in-6 for the 5 aquatic hexes observed).

### HexRepository port

**File:** `packages/core/src/ports/HexRepository.ts`

```typescript
import { Hex } from '../schemas/hex.js';
import { Result } from '../utils/Result.js';

export interface HexRepository {
  getById(hexId: string): Promise<Result<Hex>>;
  getAll(): Promise<Result<Hex[]>>;
  getByRegion(region: string): Promise<Result<Hex[]>>;
  listRegions(): Promise<Result<string[]>>;
}
```

The `getByRegion()` method matches hexes where the region appears in the `regions` array (not just the primary region). This means a hex like `0204` (regions: `["Northern Scratch", "Dwelmfurgh"]`) is returned for both region queries.

The `listRegions()` method returns the distinct regions found in the hex data — this can replace the current approach of inferring regions from table names.

### Exports

Update `packages/core/src/index.ts` to export the new schemas, types, port, and terrain module.

### Tests

**File:** `packages/core/src/schemas/hex.spec.ts`

- Valid hex parses successfully (single region).
- Valid hex with dual regions parses successfully.
- Hex ID validation rejects non-4-digit strings.
- Terrain array must be non-empty.
- `encounterChance` must be 1-3.
- `regions` array must be non-empty.
- Optional fields (`encounterNotes`, `foragingNotes`, `leyLines`) default correctly when omitted.

**File:** `packages/core/src/domain/Terrain.spec.ts`

- Each known terrain type maps to correct difficulty.
- Unknown terrain (e.g., `Aquatic`) returns `undefined` difficulty.
- Encounter chance matches difficulty tier.
- Foraging chance matches difficulty tier.
- `Aquatic` is not in the difficulty map (special case).

---

## Phase H3: Data Adapter — YamlHexRepository

**File:** `packages/data/src/repositories/YamlHexRepository.ts`

Implements `HexRepository` by loading `assets/hexes.yaml`:

```typescript
export class YamlHexRepository implements HexRepository {
  private cache: Promise<Hex[]> | null = null;

  constructor(private basePath: string) {}

  private async loadHexes(): Promise<Hex[]> {
    // Read assets/hexes.yaml, parse, validate each entry against HexSchema
  }

  async getById(hexId: string): Promise<Result<Hex>> {
    // Normalize to 4-digit format, find in cache
    const normalized = hexId.padStart(4, '0');
    // ...
  }

  async getAll(): Promise<Result<Hex[]>> {
    /* ... */
  }

  async getByRegion(region: string): Promise<Result<Hex[]>> {
    // Case-insensitive match against hex.regions array
  }

  async listRegions(): Promise<Result<string[]>> {
    // Return distinct regions from all hexes' regions arrays, sorted
  }
}
```

Follows the same caching pattern as `YamlTableRepository` and `YamlCreatureRepository`.

### Tests

**File:** `packages/data/src/repositories/YamlHexRepository.spec.ts`

- Loads synthetic `hexes.yaml` fixture from `tests/fixtures/`.
- `getById` returns correct hex for valid ID.
- `getById` returns failure for unknown ID.
- `getById` normalizes short IDs (e.g., `"807"` → `"0807"`).
- `getByRegion` filters correctly (matches any region in the array).
- `getByRegion` returns dual-region hex for either region.
- `listRegions` returns distinct sorted region names (flattened from all hexes).

---

## Phase H4: ETL Transform & Load

### Config additions

**File:** `packages/etl/src/config.ts`

```typescript
PY_DCB_HEXES_JSON: path.join(EXTRACT_DIR, 'dcb-hexes.json'),
HEXES_YAML: path.join(LOAD_DIR, 'hexes', 'hexes.yaml'),
```

### Transform step

**File:** `packages/etl/src/steps/transform-hexes.ts`

Reads `etl/output/extract/dcb-hexes.json` and performs:

1. **Hex ID normalization** — Ensure all IDs are zero-padded to 4 digits.
2. **Region name normalization** — Match against canonical region names (same 12 as encounter tables).
3. **Terrain type normalization** — Match against known terrain types. Flag unknowns as warnings.
4. **Deduplication check** — Ensure no duplicate hex IDs.

Returns validated `Hex[]`.

### Load step

**File:** `packages/etl/src/steps/load-hexes.ts`

Validates each hex against `HexSchema`, writes `assets/hexes.yaml`:

```typescript
export async function loadHexes(hexes: Hex[]): Promise<void> {
  for (const hex of hexes) {
    HexSchema.parse(hex);
  }
  const yamlStr = yaml.dump(hexes, { lineWidth: -1, noRefs: true });
  await fs.writeFile(PATHS.HEXES_YAML, yamlStr, 'utf-8');
  console.log(`Loaded ${hexes.length} hexes to ${PATHS.HEXES_YAML}`);
}
```

### CLI wiring

**File:** `packages/etl/src/index.ts`

```typescript
program
  .command('extract-hexes')
  .description('Run Python hex extractor on DCB PDF')
  .action(async () => {
    await runHexExtraction();
  });
```

The `all` command includes hex extraction in the pipeline.

### Reference validation

**File:** `packages/etl/src/steps/validate-refs.ts`

Extend to cross-reference hex regions against available regional encounter tables:

- Every region referenced in hex data should have a corresponding `"Regional - {Region}"` table.
- Report hexes whose region has no encounter table (important for regions not yet extracted).

### Tests

**File:** `packages/etl/src/steps/transform-hexes.spec.ts`

- Synthetic JSON → normalization → validation.
- Duplicate hex ID detection.
- Unknown terrain type warning.
- Unknown region warning.

**File:** `packages/etl/src/steps/load-hexes.spec.ts`

- Synthetic hexes → YAML output → re-parse roundtrip.

---

## Phase H5: GenerationContext & EncounterGenerator Changes

This is the core domain logic phase — making the generator hex-aware.

### GenerationContext extension

**File:** `packages/core/src/schemas/encounter.ts`

```typescript
export const GenerationContextSchema = z.object({
  // Existing fields
  regionId: z.string().optional(), // Now optional
  timeOfDay: z.enum(['Day', 'Night']).default('Day'),
  terrain: z.enum(['Road', 'Off-road']).default('Off-road'),
  camping: z.boolean().default(false),

  // New hex-based fields
  hexId: z
    .string()
    .regex(/^\d{4}$/)
    .optional(), // NEW
  encounterChance: z.number().int().min(1).max(3).optional(), // NEW — derived from hex (range 1–3)
});
```

**Invariant:** Either `regionId` or `hexId` must be provided. If `hexId` is provided, `regionId` and `encounterChance` are resolved from the hex data (but can be overridden by explicit values).

**Removed from original plan:** `foragingChance` on `GenerationContext`. Foraging chance is terrain-derived and surfaced at the display layer, not passed through the generation context.

### EncounterGenerator changes

**File:** `packages/core/src/services/EncounterGenerator.ts`

The constructor gains an optional `HexRepository` dependency:

```typescript
constructor(
  private readonly tableRepository: TableRepository,
  private readonly creatureRepository: CreatureRepository,
  private readonly random: RandomProvider,
  private readonly treasureGenerator?: TreasureGenerator,
  private readonly hexRepository?: HexRepository,
)
```

`generateEncounter()` is updated:

1. **Resolve hex** (new, before anything else):

   ```typescript
   if (context.hexId && this.hexRepository) {
     const hexResult = await this.hexRepository.getById(context.hexId);
     if (hexResult.kind === 'success') {
       const hex = hexResult.data;
       // Fill in derived context fields if not explicitly set
       // Use primary region (first in array) for encounter table lookup
       if (!context.regionId) context.regionId = hex.regions[0].toLowerCase();
       if (!context.encounterChance)
         context.encounterChance = hex.encounterChance;
     }
   }
   ```

2. **Roll encounter check** (new, after hex resolution):

   ```typescript
   if (context.encounterChance) {
     const d6 = new Die(6).roll(this.random);
     if (d6 > context.encounterChance) {
       // No encounter occurs
       return success({
         type: 'None',
         summary: 'No encounter',
         details: { hexId: context.hexId },
       });
     }
   }
   ```

   This introduces a new encounter type `'None'` for when the check fails.

3. **Continue with normal generation** if the encounter check passes.

4. **Include hex metadata in the result:**
   ```typescript
   encounter.details.hexId = context.hexId;
   ```

### Encounter schema changes

**File:** `packages/core/src/schemas/encounter.ts`

Add to `EncounterTypeSchema`:

```typescript
export const EncounterTypeSchema = z.enum([
  'Animal',
  'Monster',
  'Mortal',
  'Sentient',
  'Regional',
  'Lair',
  'Spoor',
  'Structure',
  'Hazard',
  'Creature',
  'None', // NEW — no encounter occurred
]);
```

Add to `EncounterSchema.details`:

```typescript
details: z.object({
  // ... existing fields
  hexId: z.string().optional(),           // NEW
}),
```

### formatRegionName fix

The existing `formatRegionName` method expects kebab-case input (`"high-wold"` → `"High Wold"`), but hex-derived region IDs will be space-separated lowercase (`"high wold"`). Update to handle both:

```typescript
private formatRegionName(regionId: string): string {
  return regionId
    .split(/[-\s]+/)  // Split on hyphens OR spaces
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

This also fixes the latent bug where interactive mode produces space-separated IDs.

### Tests

**File:** `packages/core/src/services/EncounterGenerator.spec.ts` (extend)

- **Hex-based encounter.** Provide `hexId`, mock `HexRepository` returns hex data with `regions: ["High Wold"]`. Verify `regionId` is resolved from hex's primary region, correct regional table is used.
- **Hex with dual regions.** Provide `hexId`, mock hex has `regions: ["Northern Scratch", "Dwelmfurgh"]`. Verify primary region (`"Northern Scratch"`) is used for table lookup.
- **Encounter chance check — no encounter.** Seed random so d6 > encounterChance. Verify `type: 'None'` result.
- **Encounter chance check — encounter occurs.** Seed random so d6 ≤ encounterChance. Verify normal encounter generation proceeds.
- **Hex overrides.** Provide both `hexId` and explicit `regionId`. Verify explicit `regionId` takes precedence.
- **No hex repository.** Provide `hexId` but no `hexRepository`. Verify graceful fallback (use `regionId` if available, error if not).

---

## Phase H6: CLI Changes

### `encounter` command update

**File:** `packages/cli/src/index.ts`

Change the `encounter` command to accept either a hex ID or a region ID:

```typescript
program
  .command('encounter')
  .argument(
    '<location>',
    'Hex ID (e.g. "0807") or region name (e.g. "aldweald")',
  )
  .option('-t, --time <time>', 'Time of day (Day or Night)')
  .option('--terrain <terrain>', 'Terrain type (Road or Off-road)')
  .option('-c, --camping', 'Is the party camping?')
  .description('Generate a random encounter')
  .action(async (location, options) => {
    // Detect if location is a hex ID (4 digits) or a region name
    const isHexId = /^\d{3,4}$/.test(location);

    const context: GenerationContext = {
      hexId: isHexId ? location.padStart(4, '0') : undefined,
      regionId: isHexId ? undefined : location,
      timeOfDay: options.time || 'Day',
      terrain: options.terrain || 'Off-road',
      camping: !!options.camping,
    };
    // ...
  });
```

### Dependency wiring

```typescript
const hexRepo = new YamlHexRepository(ASSETS_PATH);

async function createGenerator(): Promise<EncounterGenerator> {
  const treasureGen = await loadTreasureGenerator();
  return new EncounterGenerator(
    tableRepo,
    creatureRepo,
    random,
    treasureGen,
    hexRepo,
  );
}
```

### Output display

When a hex is resolved, show hex metadata including terrain-derived foraging chance:

```
Hex 0106 — The Outlook and the Red Monolith
Region: High Wold | Terrain: Tangled forest (3) — Encounter chance: 2-in-6
Foraging: 2-in-6 (Foraging here produces 1d3 servings of [herb])
```

For dual-region hexes:

```
Hex 0204 — The Summerstone Uruzzur
Regions: Northern Scratch / Dwelmfurgh | Terrain: Bog (3) — Encounter chance: 2-in-6
```

When the encounter check fails:

```
Hex 0106 — The Outlook and the Red Monolith
No encounter today. (Rolled 4, needed 2-in-6)
Foraging: 2-in-6
```

### Interactive mode update

**File:** `packages/cli/src/services/InteractiveService.ts`

Add a choice between hex-based and region-based input:

```typescript
const { inputMode } = await inquirer.prompt([
  {
    type: 'list',
    name: 'inputMode',
    message: 'How would you like to specify location?',
    choices: [
      { name: 'By Hex ID', value: 'hex' },
      { name: 'By Region', value: 'region' },
    ],
  },
]);

if (inputMode === 'hex') {
  const { hexId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'hexId',
      message: 'Enter Hex ID (e.g. 0807):',
      validate: (v) => /^\d{3,4}$/.test(v) || 'Must be a 3-4 digit hex ID',
    },
  ]);
  context.hexId = hexId.padStart(4, '0');
} else {
  // Existing region selection flow
}
```

The `InteractiveService` constructor gains `hexRepo` as a dependency. When `HexRepository` is available, the hex input mode is offered; otherwise, only region selection is shown.

### `travel` shortcut command

**File:** `packages/cli/src/index.ts`

Implement the `travel <hex>` command from the tech spec:

```typescript
program
  .command('travel')
  .argument('<hex_id>', 'Hex ID to travel to (e.g. "0807")')
  .description('Set current hex and generate a travel encounter')
  .action(async (hexId) => {
    // Normalize hex ID
    const normalized = hexId.padStart(4, '0');
    // Build context from hex, use session defaults for time/terrain
    // Generate encounter
    // Update session with new hex
  });
```

This is a convenience wrapper that combines `session set-hex` + `encounter`.

### Tests

CLI tests are primarily integration-level. The core logic is tested via `EncounterGenerator.spec.ts`. Additional manual testing with the CLI.

---

## Phasing & Dependencies

```
Phase H1 (Python extractor)
    │
    ▼
Phase H2 (Core schema + port) ─── independent of H1 (domain model)
    │
    ▼
Phase H3 (Data adapter) ─── depends on H2 for port interface
    │
Phase H4 (ETL transform + load) ─── depends on H1 JSON output + H2 schema
    │
    ▼
Phase H5 (Generator changes) ─── depends on H2 for port, H3 for testing
    │
    ▼
Phase H6 (CLI changes) ─── depends on H3 + H5 for wiring
```

- **H1** and **H2** can be developed in parallel — H1 is Python extraction, H2 is TypeScript domain modeling.
- **H3** depends on H2 for the port interface.
- **H4** depends on H1 for input data and H2 for the schema.
- **H5** depends on H2 for the port and can use mocked repos for testing.
- **H6** depends on everything above for full integration.

## Testing Strategy

- **H1 (Python):** Built-in validation: total count = 200, no duplicate IDs, all regions/terrains normalized to known values, encounterChance in range 1–3. Manual spot-check of terrain abbreviation normalization and dual-region parsing.
- **H2 (Core schema + domain):** Zod schema tests with synthetic hex data (single-region, dual-region, Aquatic terrain). Terrain difficulty mapping tests including Aquatic special case. Fast, no external deps.
- **H3 (Data adapter):** Synthetic `hexes.yaml` fixture loaded by `YamlHexRepository`. Dual-region query tests. Standard repo test patterns.
- **H4 (ETL):** Synthetic JSON → transform → load → roundtrip validation. Abbreviation normalization tests.
- **H5 (Generator):** Seeded `RandomProvider` tests with mocked `HexRepository`. Deterministic encounter chance rolls. Dual-region hex uses primary region.
- **H6 (CLI):** Manual testing with the CLI. Optionally, Commander test utilities for argument parsing.

## Migration Notes

### Backward compatibility

The `encounter <region_id>` command continues to work as before. Hex-based input is additive — users who don't have hex data loaded can still specify regions directly.

The `regionId` field on `GenerationContext` becomes optional (currently required). Code that constructs a context with `regionId` alone continues to work unchanged. The invariant "either `regionId` or `hexId` must be present" is enforced at the generator level, not the schema level, to avoid breaking existing callers.

### Encounter check opt-in

The encounter chance check (`N-in-6` roll) only fires when `encounterChance` is present on the context. When a user provides a raw `regionId` without hex data, no encounter check is rolled — behavior is unchanged from today (encounter always occurs).

This lets users opt in gradually: use hex IDs for full simulation fidelity, or use region IDs for quick encounter generation without the "no encounter" possibility.

### Foraging display

Foraging chance is NOT part of the encounter generation pipeline. It is computed from the hex's primary terrain difficulty at the CLI display layer:

- Terrain difficulty → `DIFFICULTY_FORAGING_CHANCE` mapping (Light=1, Moderate=2, Difficult=3).
- If the hex has `foragingNotes`, they are displayed alongside the base foraging chance.

### Symlink

`assets/hexes.yaml` should be a symlink to `../etl/output/load/hexes/hexes.yaml`, following the same pattern as `assets/creatures.yaml`. The `etl/output/load/` directory contents are gitignored; the symlink in `assets/` is tracked. No additional `.gitignore` changes needed.

## Resolved Questions

1. **Hex ID format** — ✅ 4-digit zero-padded `DDDD` per `project-context.md` line 131. The `HexSchema` enforces this via regex. The CLI accepts 3-digit input and pads automatically.
2. **Total hex count** — ✅ Exactly 200 hexes on a 19×12 grid (columns 01–19, rows 01–12) with 28 missing hexes at the SE corner. The Python extractor validates this count.
3. **Primary terrain for encounter chance** — ✅ The hex's `encounterChance` is extracted directly from the DCB (each hex explicitly states its lost/encounter chance as 1, 2, or 3-in-6). The terrain difficulty table serves as a cross-reference, not the primary source.
4. **Foraging mechanics** — ✅ Foraging chance is terrain-derived (Light=1, Moderate=2, Difficult=3-in-6), NOT a per-hex value. Only 57/200 hexes have a `Foraging:` field in the DCB, and it describes **special foraging results** (e.g., bonus herbs), not the base chance. The `foragingChance` field has been removed from the hex schema; foraging is computed from terrain difficulty at display time.
5. **Multiple terrain types per hex** — ✅ Stored as an array of `{ type, count }`. The primary terrain (for display and difficulty classification) is the first entry or the one with the highest count.
6. **Dual-region hexes** — ✅ 20 hexes straddle two regions (e.g., `High Wold / Dwelmfurgh`). Stored as `regions: string[]`. The first region is the primary one used for encounter table lookup. Both regions are searchable via `HexRepository.getByRegion()`.
7. **Aquatic terrain** — ✅ 5 hexes have `Aquatic` as a terrain type. It is a terrain type, NOT a region (corrected from original plan). Aquatic has no parenthesized count and no difficulty mapping; these hexes use `encounterChance` directly.
8. **Terrain abbreviations** — ✅ The PDF contains abbreviated forms: `tang. forest` → `Tangled forest`, `Northern Scr.` → `Northern Scratch`, `High wold` → `High Wold`. The Python extractor normalizes these.
9. **Ley line data** — ✅ 48 hexes have ley line fields (Chell, Ywyr, Hoad, Lamm), 37 have Ring of Chell. Captured as `leyLines: string[]` for completeness. Not used in encounter generation.
10. **`travel <hex>` command** — ✅ Included in Phase H6 as a convenience wrapper. Combines hex resolution + encounter generation + session update.
11. **formatRegionName bug** — ✅ Fixed in Phase H5 by splitting on both hyphens and spaces. This resolves the latent mismatch between interactive mode (space-separated) and the generator (hyphen-expected).
12. **Lost/encounters text bleed** — ✅ The `Lost/encounters` field text can bleed into hex body content because the span stream doesn't have a hard delimiter. The Python extractor parses only the `N-in-6` prefix as structured data and captures the remainder as `encounterNotes` with a truncation heuristic.
