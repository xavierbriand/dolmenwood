---
title: 'ETL Pipeline Completion'
slug: 'etl-pipeline-completion'
created: '2026-02-13'
status: 'complete'
tech_stack:
  - Python (PyMuPDF/fitz)
  - TypeScript
  - Node.js
  - Zod
code_patterns:
  - ETL (Extract-Transform-Load)
  - Child process orchestration
  - Hexagonal Architecture
  - TDD
---

# ETL Pipeline Completion

## Overview

Three remaining gaps in the ETL pipeline prevent end-to-end operation:

**1. `extract` command** — The ETL CLI (`packages/etl/src/index.ts`) has `transform`, `load`, `verify`, and `all` commands, but no `extract` command to invoke the Python scripts. Users must manually run `python3 extract_dmb.py` and `python3 extract_dcb_treasure.py` before running the TypeScript pipeline.

**2. Treasure table loading** — The Python extractor produces `etl/output/extract/dcb-treasure-tables.json`, but there is no step to validate and load it into `etl/output/load/treasure-tables/treasure-tables.json` (symlinked from `assets/treasure-tables.json`). The CLI (`packages/cli/src/index.ts`) looks for `assets/treasure-tables.json` via `JsonTreasureTableRepository` and silently degrades to no-op when missing.

**3. Lair vs Wandering treasure** — Per the encounter rules (DMB §3: "Roll possessions for wandering encounters and hoard for lair encounters"), the current `EncounterGenerator` always rolls the full hoard regardless of encounter context. It should roll only possessions for wandering encounters and the full hoard for lair encounters.

---

## Phase 1: `extract` Command

Add an `extract` command to the ETL CLI that invokes the Python scripts as child processes.

**File:** `packages/etl/src/steps/extract.ts`

A new step module that:

1. Checks that `python3` is available via `execFileSync('python3', ['--version'])`.
2. Checks that the source PDFs exist at expected paths (configurable, documented in README).
3. Runs `extract_dmb.py` via `execFileSync('python3', [scriptPath], { cwd, stdio: 'inherit' })`.
4. Runs `extract_dcb_treasure.py` similarly.
5. Verifies that all expected output files exist in `etl/output/extract/` after extraction.
6. Returns a summary: number of files produced, total size.

**Config additions** (`packages/etl/src/config.ts`):

```typescript
// Python scripts
PY_EXTRACT_DMB: path.join(PROJECT_ROOT, 'packages/etl/scripts/extract_dmb.py'),
PY_EXTRACT_DCB_TREASURE: path.join(PROJECT_ROOT, 'packages/etl/scripts/extract_dcb_treasure.py'),

// Source PDFs (expected locations)
DMB_PDF: path.join(PROJECT_ROOT, 'etl/input/DMB.pdf'),
DCB_PDF: path.join(PROJECT_ROOT, 'etl/input/DCB.pdf'),
```

**CLI wiring** (`packages/etl/src/index.ts`):

```typescript
program
  .command('extract')
  .description('Run Python extractors on source PDFs')
  .action(async () => {
    console.log('Step 0: Extracting from PDFs...');
    await runExtraction();
    console.log('Extraction complete.');
  });
```

The `all` command gains extraction as step 0:

```typescript
// In 'all' command:
console.log('Step 0: Extracting from PDFs...');
await runExtraction();
// ... existing transform, load, verify steps
```

**Error handling:**

- Missing `python3`: clear error message with install instructions.
- Missing PDF: list expected paths, suggest placing files.
- Script failure: propagate exit code, show stderr.

### Tests

- Unit test `extract.spec.ts` with mocked `execFileSync`:
  - Verifies correct script paths passed to `execFileSync`.
  - Verifies PDF existence check runs before extraction.
  - Verifies error handling for missing python3.
  - Verifies error handling for missing PDFs.
  - Verifies post-extraction output file checks.

---

## Phase 2: Treasure Table Loading

Add a load step that validates the extracted treasure JSON and writes it to `etl/output/load/treasure-tables/` where it is symlinked from `assets/`.

**File:** `packages/etl/src/steps/load-treasure.ts`

```typescript
export async function loadTreasureTables(): Promise<void> {
  const raw = await fs.readFile(PATHS.PY_DCB_TREASURE_JSON, 'utf-8');
  const parsed = JSON.parse(raw);

  // Validate against TreasureTablesSchema
  const result = TreasureTablesSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Treasure table validation errors:', result.error.format());
    throw new Error('Treasure table validation failed');
  }

  // Write validated data to ETL load output (symlinked from assets/)
  await fs.writeFile(
    PATHS.TREASURE_TABLES_JSON,
    JSON.stringify(result.data, null, 2),
  );
  console.log(`Loaded treasure tables to ${PATHS.TREASURE_TABLES_JSON}`);
}
```

**Config addition:**

```typescript
TREASURE_TABLES_JSON: path.join(LOAD_DIR, 'treasure-tables', 'treasure-tables.json'),
```

**CLI wiring:** The `load` command and `all` command call `loadTreasureTables()` after `loadCreatures()`:

```typescript
// In 'load' command:
await loadCreatures();
await loadTreasureTables();
await validateReferences();

// In 'all' command:
// ... after transform
await loadCreatures();
await loadTreasureTables();
await validateReferences();
```

**Symlink:** Create `assets/treasure-tables.json` as a symlink to `../etl/output/load/treasure-tables/treasure-tables.json` (following the same pattern as `assets/creatures.yaml`). The `etl/output/load/treasure-tables/` directory contents are gitignored; the symlink in `assets/` is tracked. No additional `.gitignore` changes needed — `assets/` is already configured to track only symlinks to ETL outputs.

### Tests

- Unit test `load-treasure.spec.ts`:
  - Reads a synthetic treasure tables JSON fixture, validates and writes it.
  - Verifies Zod validation catches malformed data.
  - Verifies output file matches validated input.

---

## Phase 3: Lair vs Wandering Treasure Distinction

Modify `EncounterGenerator` to distinguish between wandering encounters (roll possessions only) and lair encounters (roll full hoard).

### Domain rules

From the encounter rules (DMB §3 and resolved question #3 in the previous plan):

- When a creature is encountered **wandering**, roll only **possessions** per individual.
- When a creature is encountered **in lair**, roll the full **hoard** (C/R/M codes).
- Base lair chance: 30% (or creature-specific if available from enrichment data).
- Lair encounters: up to 5× the number of individuals may be present.

### Schema changes

**File:** `packages/core/src/schemas/encounter.ts`

Add `isLair` to `GenerationContext` or return it as part of the result. Since lair determination happens during generation (it's a per-creature roll), it belongs on the result:

```typescript
export type EncounterResult =
  | {
      kind: 'creature';
      creature: Creature;
      count: number;
      name: string;
      isLair: boolean;
      treasure?: RolledTreasure;
      possessions?: string;
    }
  | { kind: 'text'; description: string; name: string };
```

### Generator changes

**File:** `packages/core/src/services/EncounterGenerator.ts`

The `resolveCreature` method changes:

1. **Determine lair status.** Roll percentile against base 30% chance (or creature-specific lair chance if the enrichment data provides one).

2. **If wandering:**
   - Roll number appearing from the encounter table's `count` or creature's `numberAppearing`.
   - Set `possessions` from the creature's `possessions` field (the free-text enrichment field, e.g. "2d4gp").
   - Do **not** roll hoard treasure.

3. **If lair:**
   - Multiply number appearing by `1d5` (i.e. `Math.floor(random.next() * 5) + 1`) per the DMB rule "up to 5 times as many."
   - Roll full hoard treasure via `TreasureGenerator.rollHoard()`.
   - Also include possessions per individual (if any).

Updated `rollTreasure` signature:

```typescript
private rollTreasure(creature: Creature, isLair: boolean): {
  treasure?: RolledTreasure;
  possessions?: string;
}
```

When `isLair` is false:

- Skip hoard codes (C/R/M) entirely.
- Return `possessions` from the creature's possessions field if present.

When `isLair` is true:

- Roll hoard as currently implemented.
- Also return possessions.

### CLI changes

**File:** `packages/cli/src/index.ts`

Display lair status in the encounter output:

```
🏠 Lair encounter (×3 individuals)
```

or simply:

```
[Wandering] 4 Goblins
[In Lair] 12 Goblins (×3)
```

### Tests

**File:** `packages/core/src/services/EncounterGenerator.spec.ts`

New test cases:

1. **Wandering encounter rolls no hoard treasure.** Seed random to fail the lair check (>30%). Verify `treasure` is undefined and `possessions` comes from creature data.
2. **Lair encounter rolls full hoard.** Seed random to pass the lair check (≤30%). Verify `treasure` is a `RolledTreasure` with coins/gems/etc.
3. **Lair encounter multiplies count.** Verify the count is within `[1×, 5×]` range of the base roll.
4. **Creature with no treasure field.** Verify both wandering and lair encounters produce no treasure.
5. **Creature with possessions but no hoard.** Verify wandering returns possessions, lair returns possessions only (no hoard to roll).

---

## Phasing & Dependencies

```
Phase 1 (extract command)
    │
    ▼
Phase 2 (treasure table loading) ─── depends on Phase 1 for end-to-end flow
    │                                 but can be developed independently
    ▼
Phase 3 (lair/wandering) ─── independent of Phases 1-2 (domain logic only)
```

- **Phases 1 and 2** complete the ETL pipeline — after both, `pnpm --filter @dolmenwood/etl start all` runs the full extract → transform → load → verify chain.
- **Phase 3** is pure domain logic in `packages/core` and can be developed in parallel with Phases 1-2.

## Testing Strategy

- **Phase 1:** Mocked child process tests (no real PDFs needed). Optionally, a manual integration test that runs against real PDFs (not in CI).
- **Phase 2:** Synthetic JSON fixture → Zod validation → file output. Fast, no external deps.
- **Phase 3:** Seeded `RandomProvider` tests in `EncounterGenerator.spec.ts`. Deterministic lair/wandering outcomes based on fixed random sequences.

## Completion Status

All three phases are implemented and passing (314 tests, build clean, lint clean):

- **Phase 1** (extract command): Committed in `df4176b`.
- **Phase 2** (treasure table loading): Committed in `e087595`.
- **Phase 3** (lair vs wandering treasure): Committed in `fd58f97`.

## Resolved Questions

1. **FactionParser cleanup** — ✅ Already resolved. Faction assignment is inline in `transform-v2.ts`. The stale LSP references to deleted files (`extract.ts`, `transform.ts`) are phantom errors from the editor index. Build passes cleanly.
2. **PDF paths** — ✅ Configurable via `PATHS` constants. Users place PDFs in `etl/input/` (gitignored).
3. **Possessions vs Hoard** — ✅ Addressed in Phase 3. Wandering = possessions only, lair = full hoard. Base 30% lair chance with creature-specific override when available.
