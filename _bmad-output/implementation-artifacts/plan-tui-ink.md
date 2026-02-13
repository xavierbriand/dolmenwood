---
title: 'TUI — Ink-based Interactive Interface'
slug: 'tui-ink'
created: '2026-02-13'
updated: '2026-09-08'
status: 'ready'
tech_stack:
  - TypeScript
  - React 18
  - Ink 5
  - '@inkjs/ui 2'
  - ink-testing-library 4
  - Vitest 4
  - Node.js 20
code_patterns:
  - Hexagonal Architecture
  - TDD
  - React Hooks (state management)
  - Component-based UI
---

# TUI — Ink-based Interactive Interface

## Overview

The current interactive mode (`packages/cli/src/services/InteractiveService.ts`) uses
Inquirer for sequential prompt-based interaction. It works but has real limitations:

1. **No persistent display** — encounter results scroll away as new prompts appear.
2. **Duplicated rendering** — the full encounter display lives inline in
   `packages/cli/src/index.ts:133-231` (with treasure, surprise colouring,
   alignment / level / XP, possessions) while
   `InteractiveService.printEncounter()` (`:213-246`) is a *second, incomplete*
   copy missing treasure, surprise colouring, alignment / level / XP, and
   possessions.
3. **No layout control** — no panels or split views.
4. **No keyboard navigation** — everything is sequential prompt / response.

This plan introduces a new `packages/tui` package built with **Ink 5 + React 18**
that replaces the interactive mode with a component-based terminal UI: persistent
panels, keyboard navigation, and an architecture that keeps rendering separate
from domain logic.

### Why a separate package?

The hexagonal architecture keeps primary adapters isolated. `packages/tui` becomes
a distinct primary adapter, parallel to `packages/cli`:

- **Future web UI** — the rendering-agnostic state hooks written here
  (`useEncounterForm`, `useEncounterGen`, `useSessionManager`) contain zero Ink
  imports and can be reused by a future `packages/web`. Dependency graph:
  `tui → core ← web`.
- **CLI stays scriptable** — `packages/cli` keeps its non-interactive subcommands
  (`deg encounter forest -t Night`, `deg session list`) for CI and piping. Only
  the *interactive* mode moves to the TUI.
- **Clean boundaries** — Ink / React never enter `packages/cli` or `packages/core`.

### Stack decision (revised 2026-09-08)

| Layer | Choice | Why |
| --- | --- | --- |
| Renderer | **Ink `^5.2.1`** | `ink-testing-library@4` (the test foundation) is built and versioned against Ink 5 / React 18. Ink 6/7 exist but `ink-testing-library` has not shipped a compatible release, and Ink 7 additionally requires Node ≥ 22 (project is on Node 20). |
| React | **`^18.3.1`** | Ink 5 peer. React 19 offers nothing a terminal app uses (no DOM, no RSC). |
| Widgets | **`@inkjs/ui` `^2.0.0`** | One maintained package for `Select`, `TextInput`, `ConfirmInput`, `Spinner`, `Badge`, `StatusMessage` — replaces the separate `ink-select-input` / `ink-text-input` / `ink-spinner` deps. Peer `ink >=5`, same mid-2024 vintage as Ink 5.2 and `ink-testing-library@4`. |
| Component tests | **`ink-testing-library` `^4.0.0`** | `render()` → `lastFrame()` / `stdin.write()`. |
| Runner / types | **`vitest ^4.0.18`, `@types/node ^25.3.5`, `typescript ^5.3.3`, `@types/react ^18.3.12`** | Match the workspace (root already on vitest 4 + `@types/node` 25 after the dependency batch update). |

**Future upgrade (not in scope):** move to Ink 6 + React 19 once
`ink-testing-library` ships an Ink-6-compatible release (or is replaced by a
maintained fork); move to Ink 7 when the project adopts Node 22. Both are
non-breaking for this package's public surface (`deg` / `deg-tui` bins).

---

## Resolved design questions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Should `deg` with no args launch the TUI? | **Yes — replace.** `deg` no-args boots the TUI. Once the TUI reaches parity (end of Phase 4), delete `InteractiveService.ts` and remove the `inquirer` dependency from `@dolmenwood/cli`. Explicit subcommands are untouched. A `deg-tui` bin is also exposed from `@dolmenwood/tui` for direct invocation. |
| 2 | React 18 JSX transform with Ink's renderer? | Use `"jsx": "react-jsx"` in `packages/tui/tsconfig.json`. No `jsxImportSource` needed (that is only for alternate runtimes like Emotion). Confirmed by the Ink 5 starter template. |
| 3 | Terminal minimum size handling? | Non-blocking. On mount, read columns via Ink's `useStdout()`; if `< 80`, render a single dim warning line above the app (`Terminal is narrow — resize to ≥ 80 columns for best layout`). Ink's Yoga layout still wraps; we do not gate rendering. |
| 4 | `ink-big-text` for the header? | Skip. Plain `<Text bold>` in `<Header>`. Revisit as pure polish later. |

---

## Architecture

### Package structure

```
packages/tui/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx                # Entry — async DI wiring, render(<App/>)
│   ├── App.tsx                  # Root — layout shell + view router + global keys
│   ├── components/
│   │   ├── Header.tsx           # Title + active-session badge
│   │   ├── StatusBar.tsx        # Context-sensitive keybind hints
│   │   ├── EncounterForm.tsx    # Region → time → terrain → (camping) steps
│   │   ├── EncounterResult.tsx  # THE encounter display (single source of truth)
│   │   ├── SessionList.tsx      # Session history + detail + create
│   │   └── NarrowWarning.tsx    # <80col hint (question 3)
│   ├── hooks/
│   │   ├── useEncounterForm.ts  # Pure state: region/time/terrain/camping → GenerationContext
│   │   ├── useEncounterGen.ts   # Wraps EncounterGenerator.generateEncounter
│   │   └── useSessionManager.ts # Wraps SessionService (list/create/addEncounter)
│   └── context/
│       └── ServicesContext.tsx  # React context carrying injected Core services
└── test/
    ├── App.spec.tsx
    ├── components/
    │   ├── EncounterForm.spec.tsx
    │   ├── EncounterResult.spec.tsx
    │   └── SessionList.spec.tsx
    └── hooks/
        ├── useEncounterForm.spec.ts
        ├── useEncounterGen.spec.tsx
        └── useSessionManager.spec.tsx
```

Tests live in `test/` (matching `packages/etl`); `packages/tui/package.json`
`test` script is `vitest run` with no config file, same as every other package.

### Dependency graph

```
packages/tui → packages/core   (services, ports, schemas/types)
packages/tui → packages/data   (repository implementations — DI wiring only, in index.tsx)
```

Same rule as `packages/cli`. Core never imports from tui.

### Component tree

```
<App>                             # useInput() global keys: g / s / q / Esc
  ├── <NarrowWarning />           # only when stdout.columns < 80
  ├── <Header />                  # "Dolmenwood Encounter Generator" + <Badge> session
  ├── <MainView>                  # switch on view state
  │   ├── <EncounterForm  onSubmit onCancel />   view === 'encounter-form'
  │   ├── <EncounterResult ... />                view === 'encounter-result'
  │   └── <SessionList onBack />                 view === 'sessions'
  └── <StatusBar view=… />        # "[G]enerate  [S]essions  [Q]uit" / "[Esc] Back"
```

`view: 'home' | 'encounter-form' | 'encounter-result' | 'sessions'` held in `App`.

### Services context (DI)

```tsx
// src/context/ServicesContext.tsx
import { createContext, useContext } from 'react';
import type {
  EncounterGenerator,
  SessionService,
  TableRepository,
} from '@dolmenwood/core';

export interface Services {
  generator: EncounterGenerator;
  sessionService: SessionService;
  tableRepo: TableRepository;
}

const Ctx = createContext<Services | null>(null);
export const ServicesProvider = Ctx.Provider;

export function useServices(): Services {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
```

### Entry point — async DI wiring

Mirrors `packages/cli/src/index.ts` exactly: treasure tables are optional, so the
`EncounterGenerator` is built after an async load.

```tsx
// src/index.tsx
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { render } from 'ink';
import {
  EncounterGenerator,
  DefaultRandomProvider,
  SessionService,
  TreasureGenerator,
} from '@dolmenwood/core';
import {
  YamlTableRepository,
  YamlCreatureRepository,
  JsonSessionRepository,
  JsonTreasureTableRepository,
} from '@dolmenwood/data';
import { App } from './App.js';
import { ServicesProvider } from './context/ServicesContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_PATH = path.resolve(__dirname, '../../../assets');
const SESSION_DIR = path.join(os.homedir(), '.dolmenwood', 'sessions');

const tableRepo = new YamlTableRepository(ASSETS_PATH);
const creatureRepo = new YamlCreatureRepository(ASSETS_PATH);
const sessionRepo = new JsonSessionRepository(SESSION_DIR);
const treasureTableRepo = new JsonTreasureTableRepository(
  path.join(ASSETS_PATH, 'treasure-tables.json'),
);
const random = new DefaultRandomProvider();
const sessionService = new SessionService(sessionRepo);

async function main() {
  const tt = await treasureTableRepo.getTreasureTables();
  const treasureGen =
    tt.kind === 'success' ? new TreasureGenerator(tt.data, random) : undefined;
  const generator = new EncounterGenerator(
    tableRepo,
    creatureRepo,
    random,
    treasureGen,
  );

  render(
    <ServicesProvider value={{ generator, sessionService, tableRepo }}>
      <App />
    </ServicesProvider>,
  );
}

main();
```

### Domain contracts this package consumes (verified against `main`)

- `Result<T, E>` is `{ kind: 'success'; data: T } | { kind: 'failure'; error: E }`.
- `TableRepository.listTables(): Promise<Result<RegionTable[]>>`. Regions are the
  entries whose `name` starts with `"Regional - "`; the id is
  `name.replace('Regional - ', '').toLowerCase()`.
- `EncounterGenerator` ctor: `(tableRepo, creatureRepo, random, treasureGenerator?)`.
  `generateEncounter(context: GenerationContext): Promise<Result<Encounter>>`.
- `GenerationContext = { regionId: string; timeOfDay: 'Day'|'Night'; terrain: 'Road'|'Off-road'; camping: boolean }`.
- `Encounter = { type; summary; details: { creature?, count?, isLair?, activity?, reaction?, distance?, surprise?, treasure?, possessions? } }`.
- `SessionService`: `createSession(ctx?: Partial<SessionContext>)`,
  `listSessions()`, `getLatestSession()`, `getSession(id)`,
  `addEncounter(sessionId, encounter, regionId)`. `SessionContext` has
  `partyLevel`, `timeOfDay`, `currentRegionId?`.

---

## Phase 1: Package scaffolding + app shell + compatibility spike

### Step 1.0: Toolchain compatibility spike (do this first)

Before writing feature code, prove the render+test loop works with the pinned
versions.

- [ ] Create `packages/tui` with the deps below and a throwaway
      `src/Probe.tsx` (`<Text>hello</Text>`).
- [ ] `test/probe.spec.tsx`:
  - `render(<Probe/>)` from `ink-testing-library`; `lastFrame()` contains `hello`.
  - Render a `@inkjs/ui` `<Select>` with 3 items; assert an item label appears in
    `lastFrame()`; `stdin.write('[B'); stdin.write('\r');` selects the
    second item (`onChange` called).
- [ ] Run `pnpm --filter @dolmenwood/tui test` under Vitest 4. **Gate:** both
      assertions pass. If `ink-testing-library@4` cannot drive Ink 5 under
      Vitest 4, stop and escalate (fallback: hand-rolled harness that captures
      `render(..., { stdout: fakeStream })`), before building any components.
- [ ] Delete `Probe.tsx` / `probe.spec.tsx` once green (or keep as `App` seed).

### Step 1.1: Package setup

- [ ] `packages/tui/package.json`:
  ```json
  {
    "name": "@dolmenwood/tui",
    "version": "0.0.1",
    "description": "Interactive terminal UI for the Dolmenwood Encounter Generator",
    "type": "module",
    "bin": { "deg-tui": "./dist/index.js" },
    "scripts": {
      "build": "tsc -b",
      "test": "vitest run",
      "lint": "eslint src",
      "start": "node ./dist/index.js"
    },
    "dependencies": {
      "@dolmenwood/core": "workspace:*",
      "@dolmenwood/data": "workspace:*",
      "@inkjs/ui": "^2.0.0",
      "ink": "^5.2.1",
      "react": "^18.3.1"
    },
    "devDependencies": {
      "@types/node": "^25.3.5",
      "@types/react": "^18.3.12",
      "ink-testing-library": "^4.0.0",
      "typescript": "^5.3.3",
      "vitest": "^4.0.18"
    }
  }
  ```
- [ ] `packages/tui/tsconfig.json`:
  ```json
  {
    "extends": "../../tsconfig.json",
    "compilerOptions": {
      "outDir": "./dist",
      "rootDir": "./src",
      "jsx": "react-jsx"
    },
    "include": ["src/**/*"],
    "references": [{ "path": "../core" }, { "path": "../data" }]
  }
  ```
- [ ] Root `package.json`: add `"start:tui": "pnpm --filter @dolmenwood/tui start"`.
- [ ] `pnpm install`; confirm no unmet peer warnings for `react` / `ink`.
- [ ] `pnpm build` — the new package compiles as part of `pnpm -r build`.

### Step 1.2: ESLint flat-config for TSX

`eslint.config.js` currently targets `.ts` only and has no React awareness.

- [ ] Add dev deps at the **root**: `eslint-plugin-react-hooks`,
      `eslint-plugin-react`.
- [ ] In `eslint.config.js`, append a block scoped to `packages/tui/**/*.{ts,tsx}`:
  - `languageOptions.parserOptions.ecmaFeatures.jsx = true`
  - `plugins: { react, 'react-hooks' }`
  - `rules`: `...react.configs.flat.recommended.rules`,
    `...reactHooks.configs.recommended.rules`,
    `'react/react-in-jsx-scope': 'off'` (new JSX transform),
    `'react/prop-types': 'off'` (TypeScript).
  - `settings.react.version = 'detect'`.
- [ ] `pnpm lint` stays green across all packages.

### Step 1.3: App shell + view router

- [ ] **Test** `test/App.spec.tsx` (via `ink-testing-library`):
  - `lastFrame()` contains `Dolmenwood Encounter Generator`.
  - `lastFrame()` contains `[G]enerate`, `[S]essions`, `[Q]uit`.
  - `stdin.write('g')` → frame contains the form's first prompt (`Select Region`).
  - From the form, `stdin.write('')` (Esc) → back to home hints.
  - `stdin.write('s')` → frame shows the session list header.
  - `stdin.write('q')` → `unmount` / exit callback fired (inject an `onExit`
    prop rather than calling `process.exit` directly, so it is testable).
- [ ] **Implement** `src/App.tsx`
  - `useState<View>('home')`.
  - `useInput` global handler: `g`→`encounter-form`, `s`→`sessions`, `q`→`onExit()`,
    `Esc`→`home`.
  - Vertical `<Box flexDirection="column">`: `<NarrowWarning/>`, `<Header/>`,
    `<MainView/>`, `<StatusBar view={view}/>`.
- [ ] **Implement** `src/components/Header.tsx` — `<Text bold>` title; when a
      session is active, a `@inkjs/ui` `<Badge color="green">L{partyLevel}</Badge>`
      with the short id. (Active session comes from `useSessionManager` lifted
      into `App`, or a small `useEffect` calling `getLatestSession()`.)
- [ ] **Implement** `src/components/StatusBar.tsx` — hints switch on `view`
      (`home` shows the three top-level keys; sub-views show `[Esc] Back`).
- [ ] **Implement** `src/components/NarrowWarning.tsx` — `useStdout()`;
      render nothing unless `stdout.columns < 80`.

**Phase gate:** `pnpm build && pnpm lint && pnpm test` all green; `pnpm start:tui`
shows the shell and `q` quits cleanly.

---

## Phase 2: Encounter form

### Step 2.1: `useEncounterForm` hook (no Ink imports)

- [ ] **Test** `test/hooks/useEncounterForm.spec.tsx` (render the hook through a
      1-line Ink probe component; assert on values passed out via a spy):
  - Initial: `regionId === null`, `timeOfDay === 'Day'`, `terrain === 'Off-road'`,
    `camping === false`.
  - `setRegion('forest')` / `setTimeOfDay('Night')` / `setTerrain('Road')` /
    `setCamping(true)` update their fields.
  - `toContext()` → `null` while `regionId` is null; a valid `GenerationContext`
    once set.
  - `reset()` returns to initial state.
- [ ] **Implement** `src/hooks/useEncounterForm.ts` — pure `useState`; returns
      `{ regionId, timeOfDay, terrain, camping, setRegion, setTimeOfDay,
      setTerrain, setCamping, toContext, reset }`.

### Step 2.2: `<EncounterForm>` component

- [ ] **Test** `test/components/EncounterForm.spec.tsx` with a mocked `tableRepo`
      in `ServicesProvider`:
  - Regions listed come from `tableRepo.listTables()` filtered to
    `"Regional - *"`, de-prefixed, sorted.
  - `[B` moves the `<Select>` highlight; `\r` advances Region → Time.
  - Time → Terrain; when Time = `Night`, a camping `<ConfirmInput>` step appears
    before submit; when `Day`, it is skipped.
  - Final step calls `onSubmit(context)` with the assembled `GenerationContext`.
  - `` (Esc) at any step calls `onCancel()`.
  - `listTables()` failure → an inline `<StatusMessage variant="error">`.
- [ ] **Implement** `src/components/EncounterForm.tsx`
  - `step: 'region' | 'time' | 'terrain' | 'camping' | 'done'`.
  - `@inkjs/ui` `<Select>` for region / time / terrain; `<ConfirmInput>` for
    camping. State via `useEncounterForm`.
  - `useEffect` loads regions once from `useServices().tableRepo`.

---

## Phase 3: Encounter result display

### Step 3.1: `useEncounterGen` hook

- [ ] **Test** `test/hooks/useEncounterGen.spec.tsx` with a mock generator:
  - `generate(ctx)` sets `loading = true`, then on success `encounter` set /
    `loading = false`; on `failure` `error` set / `loading = false`.
  - `clear()` resets `encounter` / `error` / `loading`.
- [ ] **Implement** `src/hooks/useEncounterGen.ts` — calls
      `services.generator.generateEncounter(ctx)`; maps the `Result` to state.

### Step 3.2: `<EncounterResult>` — single source of truth

This component **replaces** both `index.ts:133-231` and
`InteractiveService.printEncounter()`. It must cover every `Encounter.details`
field (superset of the two current renderers):

- [ ] **Test** `test/components/EncounterResult.spec.tsx` with fixture encounters:
  - Creature encounter → summary, `Type`, `[In Lair]` / `[Wandering]` when
    `isLair` set, distance, activity, reaction.
  - Creature block → name, `AC / HD / MV / Morale`, attacks joined, `Align / Level / XP`,
    italic description.
  - Treasure present → coins (only non-zero of cp/sp/gp/pp), gems
    `Type (Ngp)`, art `Material Type (Ngp)`, magic item names, `Total Value N gp`.
  - `possessions` string → possessions line.
  - Surprise colour: `Players surprised` → `yellow`, `Both` → `magenta`,
    else default. (Assert via `chalk`-independent means — check the text is
    present; colour assertions optional since `ink-testing-library` strips ANSI
    by default.)
  - `loading` → `@inkjs/ui` `<Spinner label="Rolling…" />`.
  - `error` → `<StatusMessage variant="error">`.
- [ ] **Implement** `src/components/EncounterResult.tsx`
  - `<Box borderStyle="round" flexDirection="column">` with an `Encounter` /
    `Treasure` sub-box. Compact stat line. Labels `<Text dimColor>`.

Target layout:

```
╭─ Encounter ────────────────────────────────────╮
│ 3 x Forest Sprite            [Wandering]        │
│ Type: Creature   Distance: 180 feet            │
│ Surprise: Players surprised                     │
│ Activity: Foraging   Reaction: Hostile          │
│                                                 │
│ Forest Sprite                                   │
│ AC 14  HD 2  MV 120'  Morale 7                  │
│ Attacks: Claw (1d4), Bite (1d6)                 │
│ Align Neutral   Level 2   XP 25                 │
│ A small fey creature of the deep woods.         │
│                                                 │
│ ── Treasure ──                                  │
│ Coins: 120 sp, 45 gp                           │
│ Gems: Amethyst (100gp), Pearl (50gp)           │
│ Total Value: 215 gp                             │
╰─────────────────────────────────────────────────╯
```

### Step 3.3: Wire form → result in `App`

- [ ] `EncounterForm.onSubmit(ctx)` → `useEncounterGen().generate(ctx)` →
      `view = 'encounter-result'`.
- [ ] From the result view: `g` generates again with the same context (reroll),
      `Esc` → `home`, `Enter` → back to the form.

---

## Phase 4: Session management

### Step 4.1: `useSessionManager` hook

- [ ] **Test** `test/hooks/useSessionManager.spec.tsx` with a mock `SessionService`:
  - `loadSessions()` populates `sessions` (sorted newest-first).
  - `activeSession` = most recently updated session (or `null`).
  - `createSession({ partyLevel: 3 })` calls through and prepends to `sessions`.
  - `saveEncounter(encounter, regionId)` → `addEncounter(activeSession.id, …)`;
    no-op (returns a failure/`null`) when there is no active session.
- [ ] **Implement** `src/hooks/useSessionManager.ts` — wraps `SessionService`;
      `{ sessions, activeSession, loading, loadSessions, createSession, saveEncounter }`.

### Step 4.2: `<SessionList>` component

- [ ] **Test** `test/components/SessionList.spec.tsx`:
  - Renders each session: short id, `Level N`, localized date.
  - `[B` / `[A` navigate; `\r` on a row → detail view with the last
    10 `history` entries (`[time] summary (regionId)`).
  - `n` → `<TextInput>` for party level; submitting an integer calls
    `createSession({ partyLevel })`; non-numeric input rejected inline.
  - `` from list → `onBack()`; from detail → back to list.
- [ ] **Implement** `src/components/SessionList.tsx` — `@inkjs/ui` `<Select>` for
      the list, `<TextInput>` for level entry, a detail `<Box>` for history.

---

## Phase 5: Integration, cutover, polish

### Step 5.1: Auto-save

- [ ] After a successful generate, if `activeSession` exists, call
      `saveEncounter(encounter, ctx.regionId)` automatically and show a transient
      `<Badge color="green">Saved</Badge>` in the result header (no prompt — the
      old flow's "Save this encounter?" confirm is dropped for speed).
- [ ] No active session → `<Text dimColor>[N] New session to start tracking</Text>`
      hint in the status bar.

### Step 5.2: Cutover — `deg` launches the TUI

- [ ] `packages/cli/src/index.ts`: replace the `process.argv.length <= 2` branch
      (`:245-256`) so it spawns the TUI. Preferred: `import('@dolmenwood/tui')`
      (add `@dolmenwood/tui: workspace:*` to `packages/cli/dependencies`) and call
      an exported `runTui()`; fallback: `child_process` spawn of the `deg-tui`
      bin. `runTui()` = the body of `src/index.tsx main()`, exported from
      `packages/tui/src/index.tsx`.
- [ ] Delete `packages/cli/src/services/InteractiveService.ts` and its import.
- [ ] Remove `inquirer` from `packages/cli/package.json` dependencies and
      `@types/inquirer` + `inquirer` from the root `package.json` devDependencies
      (root only had them for the CLI). `pnpm install`, `pnpm dedupe`.
- [ ] Grep the repo for remaining `inquirer` references (should be zero).
- [ ] `deg --help` / `deg encounter …` / `deg session …` unchanged.

### Step 5.3: Polish

- [ ] `@inkjs/ui` `<Spinner>` on every async boundary (generate, session load).
- [ ] Colour scheme aligned with the CLI: green = success, red = error,
      cyan = creature name, yellow = treasure, `dimColor` = labels.
- [ ] `<StatusBar>` shows active session + last encounter summary.
- [ ] Optional (only if cheap): when `stdout.columns > 100`, a right-hand
      `<Box width={30}>` sidebar with the active session's last 5 encounters.

### Step 5.4: Docs

- [ ] `README.md`: rewrite the "Interactive Mode" section (`:77`) to describe the
      TUI; update the package table (`:140`) — `@dolmenwood/cli` deps become
      `commander`, `chalk`; add a `@dolmenwood/tui` row (`ink`, `@inkjs/ui`,
      `react`).
- [ ] `AGENTS.md` / `_bmad-output/project-context.md`: note the new package and
      that interactive UX lives in `packages/tui`.

---

## Testing strategy

### Component tests — `ink-testing-library@4`

```tsx
import { render } from 'ink-testing-library';
import { App } from '../src/App.js';

const { lastFrame, stdin, rerender, unmount } = render(<App onExit={vi.fn()} />);
expect(lastFrame()).toContain('Dolmenwood Encounter Generator');
stdin.write('g');            // key
stdin.write('\r');           // Enter
stdin.write('');       // Esc
stdin.write('[B');     // Down arrow
```

`ink-testing-library` strips ANSI from `lastFrame()` by default — assert on
**text content**, not colour. If a colour assertion is ever needed, pass
`{ stripAnsi: false }` (v4 option) and match escape codes.

### Hook tests

Hooks touch React state only (no DOM), so a 1-line Ink probe component is the
harness — no `jsdom`, no `@testing-library/react`:

```tsx
function Probe<T>({ use, onValue }: { use: () => T; onValue: (v: T) => void }) {
  onValue(use());
  return null;
}
// render(<Probe use={() => useEncounterForm()} onValue={spy} />)
// act via spy.mock.calls[…] and stdin for anything input-driven
```

### Service mocks

Every component/hook test provides fakes through `ServicesProvider`:

```tsx
const generator = { generateEncounter: vi.fn().mockResolvedValue({ kind: 'success', data: fx }) };
const sessionService = { listSessions: vi.fn(), createSession: vi.fn(), getLatestSession: vi.fn(), addEncounter: vi.fn() };
const tableRepo = { listTables: vi.fn().mockResolvedValue({ kind: 'success', data: fxRegions }) };
render(<ServicesProvider value={{ generator, sessionService, tableRepo }}><EncounterForm onSubmit={vi.fn()} onCancel={vi.fn()} /></ServicesProvider>);
```

### Per-phase gate

| Phase | Gate |
| --- | --- |
| 1 | Spike passes; `pnpm build && pnpm lint && pnpm test` green; `pnpm start:tui` renders the shell, `q` exits |
| 2 | Form walks Region→Time→Terrain→(Camping) and emits a valid `GenerationContext` |
| 3 | `<EncounterResult>` renders every `Encounter.details` field; form→generate→result wired |
| 4 | Session list / detail / create work against a mock `SessionService` |
| 5 | `deg` (no args) launches the TUI; `InteractiveService.ts` and `inquirer` gone; README updated; full `pnpm build && pnpm lint && pnpm test` green |

---

## Phasing & dependencies

```
Phase 1  scaffolding + spike + shell
   │
   ├──────────────┐
   ▼              ▼
Phase 2  form    Phase 4  sessions      (independent after Phase 1)
   │
   ▼
Phase 3  result  (needs the form to supply a context)
   │
   ▼
Phase 5  cutover + polish  (needs 2, 3, 4)
```

Phases 2 and 4 can run in parallel once Phase 1 lands.

---

## Key decisions (summary)

1. **Ink 5 + React 18 + `@inkjs/ui` 2** — dictated by `ink-testing-library@4`
   (the TDD foundation) and Node 20. Upgrade to Ink 6/7 later, non-breaking.
2. **Separate `packages/tui`** — hexagonal boundary; CLI stays scriptable;
   paves the way for `packages/web`.
3. **Rendering-agnostic hooks** — `useEncounterForm` / `useEncounterGen` /
   `useSessionManager` have zero Ink imports.
4. **One `<EncounterResult>`** — kills the `index.ts` ⇄ `InteractiveService`
   duplication.
5. **`deg` no-args → TUI; delete `InteractiveService`; drop `inquirer`** — one
   interactive experience, one less dependency (Phase 5).
6. **Auto-save encounters** when a session is active — no confirm prompt.
7. **TDD throughout** — every hook and component gets a failing test first.

## Risks

| Risk | Mitigation |
| --- | --- |
| `ink-testing-library@4` incompatible with Ink 5 under Vitest 4 | Phase 1 Step 1.0 spike gates all further work; documented fallback harness |
| `@inkjs/ui@2` visual/behavioural quirks under Ink 5 | Spike also renders a `<Select>`; swap back to `ink-select-input`/`ink-text-input`/`ink-spinner` if needed (same API surface) |
| React 18 `act()` warnings from async `useEffect` in tests | Wrap interactions in `await` ticks; Vitest `--no-isolate` not required |
| `deg` → TUI via dynamic `import('@dolmenwood/tui')` creates a cli→tui dep edge | Acceptable: both are primary adapters over Core; tui does not depend on cli. Alternative spawn-the-bin path documented |
| Node 20 EOL (April 2026) | Out of scope here; a separate Node 22 bump unlocks Ink 7 |
