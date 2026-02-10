# Phase 7: Hardened ETL Pipeline (Reboot)

## Step 1: Clean Slate

- [X] **Remove Legacy Code**: Delete `packages/etl/src/steps/transform.ts` and the entire `packages/etl/src/parsers/` directory.
- [X] **Create Directory Structure**: Create `packages/etl/src/processors/` to house our new modular stages.

## Step 2: Stage 1 - The Normalizer (Text Standardization)

- [X] **Create Test Suite**: Create `packages/etl/test/processors/Normalizer.spec.ts`.
  - _Test Case A (Symbols)_: Verify `—` (em-dash) becomes `-`.
  - _Test Case B (De-hyphenation)_: Verify `mons-\nter` becomes `monster`.
  - _Test Case C (Kerning)_: Verify `Va Mpir E` becomes `Vampire` using a dictionary.
- [X] **Implement Normalizer**: Create `packages/etl/src/processors/Normalizer.ts`.
  - Implement `normalizeSymbols()`
  - Implement `fixLineBreaks()` (De-hyphenation)
  - Implement `fixKerning()` (Dictionary-based)
- [X] **Verify**: Run tests to ensure `Bat, Va Mpir E` and split words are handled correctly.
