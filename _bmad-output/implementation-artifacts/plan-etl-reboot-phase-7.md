# Phase 7: Hardened ETL Pipeline (Reboot)

## Step 1: Clean Slate

- [ ] **Remove Legacy Code**: Delete `packages/etl/src/steps/transform.ts` and the entire `packages/etl/src/parsers/` directory.
- [ ] **Create Directory Structure**: Create `packages/etl/src/processors/` to house our new modular stages.

## Step 2: Stage 1 - The Normalizer (Text Standardization)

- [ ] **Create Test Suite**: Create `packages/etl/test/processors/Normalizer.spec.ts`.
  - _Test Case A (Symbols)_: Verify `—` (em-dash) becomes `-`.
  - _Test Case B (De-hyphenation)_: Verify `mons-\nter` becomes `monster`.
  - _Test Case C (Kerning)_: Verify `Va Mpir E` becomes `Vampire` using a dictionary.
- [ ] **Implement Normalizer**: Create `packages/etl/src/processors/Normalizer.ts`.
  - Implement `normalizeSymbols()`
  - Implement `fixLineBreaks()` (De-hyphenation)
  - Implement `fixKerning()` (Dictionary-based)
- [ ] **Verify**: Run tests to ensure `Bat, Va Mpir E` and split words are handled correctly.

## Step 3: Stage 2 - The Contextual Chunker (Structure)

- [ ] **Create Test Suite**: Create `packages/etl/test/processors/Chunker.spec.ts`.
  - _Test Case_: Verify page detection (using `\f` or headers).
  - _Test Case_: Verify creature header detection (ALL CAPS line followed by 'AC').
- [ ] **Implement Chunker**: Create `packages/etl/src/processors/Chunker.ts`.
  - Implement `splitByPage()`
  - Implement `identifyCreatureBlocks()`
- [ ] **Verify**: Ensure we can reliably isolate "Rat, Giant" as a distinct block from its page context.

## Step 4: Integration

- [ ] **Re-implement `transform.ts`**: Create a new, thin `transform.ts` that strictly orchestrates: `Normalizer` -> `Chunker` -> `Mapper` (Future).
- [ ] **Run Pipeline**: Execute the CLI to generate the intermediate files (`01-normalized.txt`, `02-blocks.json`) and inspect them manually to confirm quality.
