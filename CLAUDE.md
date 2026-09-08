# CLAUDE.md

Read before adding code. Two things live here: constraints this codebase
can't teach you by being read, and how a change actually gets made — nothing
else. No phases, no `docs/` folder, no process apparatus. Adding a line here
means finding one to cut; the ceiling is 100 lines.

The project's objective and its slow-moving constraints are in
[`PROJECT.md`](PROJECT.md); how to run it and the package layout are in
[`README.md`](README.md).

## Constraints not obvious from the code

- **This repo is public, and the game content it generates is copyrighted**
  (Dolmenwood, by Necrotic Gnome). No verbatim book content — stat blocks,
  table entries, descriptive prose — ever reaches source, tests, comments,
  commit messages, or PR bodies. Write synthetic test data ("Forest Sprite",
  "Goblin Scout"), never real creatures copied from the book. This is about
  content, not vocabulary: a creature's name is fine. A pre-commit hook
  (`scripts/ip-check.ts`) blocks any 40+ character passage found verbatim in
  the source PDFs — it's the backstop, not licence to get close.
- **The real data lives outside the tracked tree.** Source PDFs in
  `etl/input/`, everything ETL derives under `etl/output/`, the OCR'd
  `rules/`, and the hand-authored `assets/*.yaml` are all gitignored — only
  two symlink targets in `assets/` are tracked. Nothing proprietary belongs
  in a commit.
- **Never `git add -A`.** Proprietary source sits untracked all through the
  working tree; one stray add publishes it to a public repo. Stage explicit
  paths, and run `git status` at the start of a session, not just before a
  commit.
- **`packages/etl/` is the one place that touches the real books**, so its
  integration tests reference real source material by necessity and it is
  exempt from the IP scan above. The exemption stops at `etl/`.
- **`packages/core` is pure and deterministic** — no node builtins, no import
  of the outer packages, and randomness only through the `RandomProvider`
  port. Enforced by `src/purity.spec.ts` and the roll tests, not just
  documented. See [`.claude/rules/core.md`](.claude/rules/core.md).

## How a change happens here

1. Non-trivial work gets a short plan first — reviewed, not written silently.
2. Branch off `main`; one PR per coherent step. Never commit to `main`.
3. Self-review, and resolve every review thread or dismiss it with a reason.
   Findings and fixes go in the PR body, not a separate document.
4. **Definition of done:** `pnpm build && pnpm lint && pnpm test` green, and
   for anything user-facing you actually ran it once (`pnpm start`, or
   `pnpm start:tui`) — then say plainly what you did and didn't check.
5. Merge is the user's call, always — never the agent's, whatever CI says.
6. `README.md` / `PROJECT.md` / this file update in the same PR as the change
   they describe.
