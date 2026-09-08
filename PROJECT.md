# Dolmenwood Encounter Generator — project frame

The high-level *what* and *why*. Operational rules for making a change live in
[`CLAUDE.md`](CLAUDE.md); how to run it and the package layout live in
[`README.md`](README.md). This frame is deliberately short and slow-moving —
it changes when the project's intent changes, not when the code does.

## Objective

Give a Dolmenwood game master a fast, faithful random encounter at the table.
Pick region, time of day, terrain, and camping status, and get a complete
encounter: the right creatures for that context, rolled with the correct odds,
with full B/X stat blocks and any treasure already resolved.

## What it is

A TypeScript monorepo behind a terminal interface — a dice-and-tables engine at
the core, a CLI today with an interactive TUI (Ink) alongside it, and an ETL
pipeline that turns the owner's own Dolmenwood PDFs into the data the engine
reads. It is a local tool for one GM's own books: not a service, not hosted, no
accounts.

## Durable constraints

These outlive any single feature and shape most decisions.

- **The game content is copyrighted (Necrotic Gnome) and the repo is public.**
  This is the constraint the product is built around: it generates *from* the
  books without ever reproducing them. Real content stays in gitignored,
  local-only data; the code and its history carry none of it.
- **The engine is a pure, deterministic function of its inputs.** The same
  tables and the same rolls produce the same encounter. Randomness and I/O sit
  at the edges (`RandomProvider`, the data adapters) so the domain stays
  testable and reproducible.
- **Data is derived, not hand-authored where a book already states it.** The
  ETL pipeline is the source of the creature data; hand-authored files cover
  only what structures the rolls — encounter, terrain, reaction, activity
  tables.
- **Faithfulness to the rules as written is the product.** The failure that
  matters most here is a plausible wrong number — a mis-resolved table, the
  wrong odds — not a crash. Correctness of the roll is what earns trust.

## Non-goals (for now)

Hosting, accounts, or multi-user. A graphical UI. Shipping any Dolmenwood data
with the repo. Supporting any setting other than Dolmenwood.
