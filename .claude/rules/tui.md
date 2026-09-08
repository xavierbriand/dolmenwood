---
paths:
  - "packages/tui/**"
---

# Ink 5 and React 18 are pinned deliberately

`ink@5` + `react@18` + `@inkjs/ui@2`, not the latest majors — don't bump them
to chase a version. The rationale and the migration path are in the TUI plan
(`_bmad-output/implementation-artifacts/plan-tui-ink.md`).

# The view layer has tests

Components are covered with `ink-testing-library` (`packages/tui/test/`). For
anything visual, also run it — `pnpm start:tui` — since a passing render test
confirms structure, not that the screen reads well.
