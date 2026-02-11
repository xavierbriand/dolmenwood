# Deferred Creature References

## Overview

Some encounter table entries reference creatures that are **not found in the Dolmenwood Monster Book (DMB)**. These creatures originate from other source books and cannot be resolved until those sources are processed through the ETL pipeline.

Deferred refs are tracked in `packages/etl/src/steps/validate-refs.ts` via the `DEFERRED_REFS` allowlist. The validation step reports them as informational messages rather than errors.

## Deferred Creatures

### Wild Hunt

- **Source book:** Dolmenwood Campaign Book (DCB)
- **Referenced in:** `assets/regional-encounters.yaml` — Regional Aldweald encounter table, entry 18
- **Status:** Deferred until DCB source data is available for ETL processing
- **Resolution:** Once DCB creature data is parsed, remove `wild hunt` from `DEFERRED_REFS` and verify it resolves normally

## Adding New Deferred Refs

If new encounter tables reference creatures from unprocessed source books:

1. Add the lowercased creature name to the `DEFERRED_REFS` set in `validate-refs.ts`
2. Document the creature, its source book, and where it's referenced in this file
3. Remove the entry once the source book's ETL pipeline is implemented
