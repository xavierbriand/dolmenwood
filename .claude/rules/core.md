---
paths:
  - "packages/core/**"
---

# `packages/core` stays pure

No fs, path, process, or other node builtins; no importing `@dolmenwood/data`,
`cli`, `tui`, or `etl`. Enforced by `src/purity.spec.ts`, not just documented —
the domain is a pure function of its arguments, and `data`/`cli` are the I/O
layer on purpose.

# Randomness is injected, never read directly

Every roll takes a `RandomProvider` (`ports/RandomProvider.ts`). Domain code
never calls `Math.random()` directly; a test passes a deterministic provider so
an outcome is fixed. `DefaultRandomProvider` is the only place the real RNG is
read.

# Runtime dependencies are `ts-pattern` and `zod`, added deliberately

`package.json` is the source of truth for the count. A new runtime dependency
in the domain is worth a second look before it lands.
