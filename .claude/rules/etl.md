---
paths:
  - "packages/etl/**"
  - "etl/**"
---

# ETL is the only code that touches the real books

Its integration tests reference real source material by necessity, so
`packages/etl/` is exempt from the IP pre-commit scan (`scripts/ip-check.ts`).
That exemption is the whole reason the boundary exists — real content must not
leak out of `packages/etl/` into `core`, `data`, `cli`, or a fixture elsewhere.

# Nothing under `etl/` is committed

Source PDFs (`etl/input/`) and every derived output (`etl/output/**`) are
gitignored; only `.gitkeep` files hold the structure. The pipeline is
reproducible from the PDFs (see README), so the outputs never need tracking.
