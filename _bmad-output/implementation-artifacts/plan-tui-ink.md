---
title: 'TUI — Ink-based Interactive Interface'
slug: 'tui-ink'
created: '2026-02-13'
status: 'draft'
tech_stack:
  - TypeScript
  - React 18
  - Ink 5
  - ink-testing-library 4
  - Node.js
code_patterns:
  - Hexagonal Architecture
  - TDD
  - React Hooks (state management)
  - Component-based UI
---

# TUI — Ink-based Interactive Interface

## Overview

The current interactive mode (`packages/cli/src/services/InteractiveService.ts`) uses Inquirer for sequential prompt-based interaction. This works but has significant limitations:

1. **No persistent display** — encounter results scroll away as new prompts appear.
2. **Duplicated rendering** — encounter display logic exists in both `index.ts:133-224` (full version with treasure, surprise coloring, alignment/level/XP) and `InteractiveService.printEncounter()` (incomplete version missing treasure, surprise coloring, alignment/level/XP).
3. **No layout control** — no sidebars, panels, or split views possible.
4. **No keyboard navigation** — everything is sequential prompt/response.

This plan introduces a new `packages/tui` package built with **Ink 5 + React 18** that replaces the interactive mode with a rich terminal UI featuring persistent panels, keyboard navigation, and a component architecture that enforces separation of rendering from domain logic.

### Why a separate package?

The hexagonal architecture demands that UI adapters are isolated. Creating `packages/tui` as a distinct primary adapter (parallel to `packages/cli`) achieves several goals:

- **Future web UI:** Rendering-agnostic state hooks extracted during TUI development can be reused by a future `packages/web` adapter. The dependency graph becomes `TUI -> Core <- Web`.
- **CLI stays useful:** `packages/cli` remains a thin, non-interactive interface for scripting and CI (`deg encounter forest --time Day`). The TUI replaces only the interactive mode.
- **Clean dependency boundaries:** Ink/React dependencies stay out of the CLI package.

### Why Ink 5 + React 18 (not Ink 6 / React 19)?

- Ink 6 is early-stage; many ecosystem packages (`ink-select-input`, `ink-text-input`, `ink-spinner`) have not been updated for it.
- Ink 5 is stable and battle-tested with a mature ecosystem.
- React 18 provides all needed features (hooks, concurrent mode).
- Migration to Ink 6 + React 19 can happen later as a non-breaking upgrade.

---

## Architecture

### Package Structure

```
packages/tui/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx              # Entry point — DI wiring, render(<App />)
│   ├── App.tsx                # Root component — layout shell, view router
│   ├── components/
│   │   ├── Header.tsx         # App title + session indicator
│   │   ├── StatusBar.tsx      # Keybind hints, active context summary
│   │   ├── EncounterForm.tsx  # Region/time/terrain selection
│   │   ├── EncounterResult.tsx # Rich encounter display panel
│   │   ├── SessionList.tsx    # Scrollable session history
│   │   └── Spinner.tsx        # Loading indicator
│   ├── hooks/
│   │   ├── useEncounterForm.ts  # Form state: region, time, terrain, camping
│   │   ├── useEncounterGen.ts   # Calls EncounterGenerator, manages result state
│   │   └── useSessionManager.ts # Session CRUD, active session tracking
│   └── context/
│       └── ServicesContext.tsx   # React context for injected services
└── test/
    ├── App.spec.tsx
    ├── components/
    │   ├── EncounterForm.spec.tsx
    │   ├── EncounterResult.spec.tsx
    │   └── SessionList.spec.tsx
    └── hooks/
        ├── useEncounterForm.spec.ts
        ├── useEncounterGen.spec.ts
        └── useSessionManager.spec.ts
```

### Dependency Graph

```
packages/tui  →  packages/core  (domain services, types, ports)
packages/tui  →  packages/data  (repository implementations for DI wiring)
```

Same dependency rule as `packages/cli`: TUI depends on Core and Data; Core knows nothing about TUI.

### Component Tree

```
<App>
  ├── <Header />                    # "Dolmenwood Encounter Generator" + session badge
  ├── <MainView>                    # Switches based on app state
  │   ├── <EncounterForm />         # When: selecting encounter parameters
  │   ├── <EncounterResult />       # When: displaying generated encounter
  │   └── <SessionList />           # When: managing sessions
  └── <StatusBar />                 # "[G]enerate  [S]essions  [Q]uit" keybind hints
```

### Services Context (Dependency Injection)

```typescript
// src/context/ServicesContext.tsx
import { createContext, useContext } from 'react';
import type {
  EncounterGenerator,
  SessionService,
  TableRepository,
} from '@dolmenwood/core';

interface Services {
  generator: EncounterGenerator;
  sessionService: SessionService;
  tableRepo: TableRepository;
}

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ServicesContext.Provider;

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
```

### Entry Point (DI Wiring)

```typescript
// src/index.tsx — mirrors packages/cli/src/index.ts DI pattern
import { render } from 'ink';
import { App } from './App.js';
import { ServicesProvider } from './context/ServicesContext.js';
// ... same DI setup as CLI: YamlTableRepository, YamlCreatureRepository, etc.

const services = { generator, sessionService, tableRepo };
render(
  <ServicesProvider value={services}>
    <App />
  </ServicesProvider>
);
```

---

## Phase 1: Package Scaffolding + App Shell

Set up the `packages/tui` package and render a minimal app with header, status bar, and keyboard navigation between views.

### Step 1.1: Package Setup

- [ ] Create `packages/tui/package.json`:
  ```json
  {
    "name": "@dolmenwood/tui",
    "version": "0.0.1",
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
      "ink": "^5.1.0",
      "react": "^18.3.1",
      "ink-select-input": "^6.0.0",
      "ink-spinner": "^5.0.0",
      "ink-text-input": "^6.0.0"
    },
    "devDependencies": {
      "@types/react": "^18.3.0",
      "typescript": "^5.3.3",
      "vitest": "^1.2.2",
      "ink-testing-library": "^4.0.0",
      "@types/node": "^20.11.0"
    }
  }
  ```
- [ ] Create `packages/tui/tsconfig.json` with `"jsx": "react-jsx"` and project references to `core` and `data`.
- [ ] Verify `pnpm install && pnpm build` succeeds.

### Step 1.2: App Shell with View Router

- [ ] **Test**: `test/App.spec.tsx`
  - Renders `<App />` via `ink-testing-library`.
  - `lastFrame()` contains the header text.
  - `lastFrame()` contains keybind hints in the status bar.
  - Pressing `g` switches to encounter form view.
  - Pressing `s` switches to session list view.
  - Pressing `q` exits the app.

- [ ] **Implement**: `src/App.tsx`
  - State: `view: 'home' | 'encounter-form' | 'encounter-result' | 'sessions'`
  - `useInput()` for global keyboard shortcuts (`g`, `s`, `q`).
  - Renders `<Header />`, `<MainView />`, `<StatusBar />` in a vertical `<Box>` layout.

- [ ] **Implement**: `src/components/Header.tsx`
  - Static component: bold title text, optional session indicator.
  - Uses `<Text bold>` from Ink.

- [ ] **Implement**: `src/components/StatusBar.tsx`
  - Displays context-sensitive keybind hints.
  - Changes based on current view (e.g., `[Esc] Back` when in a sub-view).

### Tests (ink-testing-library pattern)

```typescript
import { render } from 'ink-testing-library';
import { App } from '../src/App.js';

describe('App', () => {
  it('should display header on startup', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('Dolmenwood Encounter Generator');
  });

  it('should show keybind hints', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('[G]enerate');
    expect(lastFrame()).toContain('[S]essions');
    expect(lastFrame()).toContain('[Q]uit');
  });

  it('should switch to encounter form on G press', () => {
    const { lastFrame, stdin } = render(<App />);
    stdin.write('g');
    expect(lastFrame()).toContain('Select Region');
  });
});
```

---

## Phase 2: Encounter Form

Replace the Inquirer-based encounter prompts with Ink select inputs.

### Step 2.1: useEncounterForm Hook

- [ ] **Test**: `test/hooks/useEncounterForm.spec.ts`
  - Initial state: `regionId` is null, `timeOfDay` is 'Day', `terrain` is 'Off-road', `camping` is false.
  - `setRegion('forest')` updates `regionId`.
  - `setTimeOfDay('Night')` updates `timeOfDay`.
  - `toContext()` returns a valid `GenerationContext` when `regionId` is set.
  - `toContext()` returns null when `regionId` is unset.

- [ ] **Implement**: `src/hooks/useEncounterForm.ts`
  - Pure state hook — no rendering, no service calls.
  - Returns `{ regionId, timeOfDay, terrain, camping, setRegion, setTimeOfDay, setTerrain, setCamping, toContext, reset }`.

### Step 2.2: EncounterForm Component

- [ ] **Test**: `test/components/EncounterForm.spec.tsx`
  - Renders region list from mocked `tableRepo.listTables()`.
  - Arrow key navigation highlights different regions.
  - Enter on a region advances to time-of-day selection.
  - Enter on time-of-day advances to terrain selection.
  - When Night is selected, shows camping prompt before terrain.
  - Final Enter triggers `onSubmit(context)` callback.
  - Escape at any step calls `onCancel()` callback.

- [ ] **Implement**: `src/components/EncounterForm.tsx`
  - Multi-step form using `ink-select-input`.
  - Steps: Region → Time of Day → Terrain → (Camping if Night) → Submit.
  - Uses `useEncounterForm` hook for state.
  - Loads regions via `useServices().tableRepo.listTables()` in a `useEffect`.

### Region Loading

```typescript
// Inside EncounterForm
const { tableRepo } = useServices();
const [regions, setRegions] = useState<{ label: string; value: string }[]>([]);

useEffect(() => {
  tableRepo.listTables().then((res) => {
    if (res.kind === 'success') {
      setRegions(
        res.data
          .filter((t) => t.name.startsWith('Regional - '))
          .map((t) => ({
            label: t.name.replace('Regional - ', ''),
            value: t.name.replace('Regional - ', '').toLowerCase(),
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
    }
  });
}, []);
```

---

## Phase 3: Encounter Result Display

Rich, persistent encounter display with creature stats, treasure, and surprise coloring.

### Step 3.1: useEncounterGen Hook

- [ ] **Test**: `test/hooks/useEncounterGen.spec.ts`
  - `generate(context)` sets `loading` to true.
  - On success, sets `encounter` and `loading` to false.
  - On failure, sets `error` and `loading` to false.
  - `clear()` resets all state.

- [ ] **Implement**: `src/hooks/useEncounterGen.ts`
  - `{ encounter, loading, error, generate, clear }`
  - Calls `services.generator.generateEncounter(context)`.

### Step 3.2: EncounterResult Component

- [ ] **Test**: `test/components/EncounterResult.spec.tsx`
  - Given a creature encounter, displays: summary, type, stats (AC/HD/MV/Morale), attacks, alignment, level, XP, description.
  - Given treasure data, displays: coins, gems, art objects, magic items, total value.
  - Given possessions, displays possessions line.
  - Surprise text uses appropriate color (yellow for "Players surprised", magenta for "Both").
  - Shows distance, activity, reaction.
  - Shows loading spinner when `loading` is true.
  - Shows error message when `error` is set.

- [ ] **Implement**: `src/components/EncounterResult.tsx`
  - Single source of truth for encounter rendering (eliminates the duplication between `index.ts` and `InteractiveService`).
  - Uses `<Box>` with borders for visual separation.
  - Creature stats in a compact layout.
  - Treasure in a sub-panel.

### Encounter Display Layout

```
╭─ Encounter ────────────────────────────────────╮
│ 3 x Forest Sprite                              │
│ Type: Creature                                  │
│ Distance: 180 feet                              │
│ Surprise: Players surprised                     │
│ Activity: Foraging                              │
│ Reaction: Hostile                               │
│                                                 │
│ ── Forest Sprite ──                             │
│ AC 14  HD 2  MV 120'  Morale 7                  │
│ Attacks: Claw (1d4), Bite (1d6)                 │
│ Align: Neutral  Level: 2  XP: 25               │
│ A small fey creature of the deep woods.         │
│                                                 │
│ ── Treasure ──                                  │
│ Coins: 120 sp, 45 gp                           │
│ Gems: Amethyst (100gp), Pearl (50gp)           │
│ Total Value: 215 gp                             │
╰─────────────────────────────────────────────────╯
```

---

## Phase 4: Session Management

Scrollable session list with session creation and encounter history.

### Step 4.1: useSessionManager Hook

- [ ] **Test**: `test/hooks/useSessionManager.spec.ts`
  - `loadSessions()` populates `sessions` array.
  - `createSession({ partyLevel: 3 })` adds to sessions list.
  - `activeSession` tracks the most recent session.
  - `saveEncounter(encounter, regionId)` delegates to `SessionService.addEncounter()`.

- [ ] **Implement**: `src/hooks/useSessionManager.ts`
  - `{ sessions, activeSession, loading, loadSessions, createSession, saveEncounter }`
  - Wraps `SessionService` methods with React state.

### Step 4.2: SessionList Component

- [ ] **Test**: `test/components/SessionList.spec.tsx`
  - Renders list of sessions with ID, level, date.
  - Arrow keys navigate between sessions.
  - Enter on a session shows its encounter history (last 10 entries).
  - `N` key creates a new session (prompts for party level).
  - Escape returns to main menu.

- [ ] **Implement**: `src/components/SessionList.tsx`
  - Uses `ink-select-input` for session list.
  - Detail view shows session context + scrollable history.
  - `ink-text-input` for party level entry during creation.

---

## Phase 5: Polish & Integration

### Step 5.1: Auto-save to Session

- [ ] After generating an encounter, if an active session exists, automatically save and show a "Saved to session" indicator (no confirmation prompt — the TUI should be fast).
- [ ] If no session exists, show a subtle "[N] New session to start tracking" hint.

### Step 5.2: Encounter History Sidebar (Optional)

- [ ] If terminal width > 100 columns, show a narrow sidebar with the last 5 encounters from the active session.
- [ ] Uses `useStdout()` from Ink to detect terminal dimensions.
- [ ] Falls back to single-column layout on narrow terminals.

### Step 5.3: Visual Polish

- [ ] `ink-spinner` during encounter generation and session loading.
- [ ] Color scheme consistent with the existing CLI (green for success, red for errors, cyan for creature names, yellow for treasure, dim for labels).
- [ ] Context-sensitive status bar updates (current view, active session, last encounter summary).

### Step 5.4: Binary & Root Scripts

- [ ] Add `"start:tui": "pnpm --filter @dolmenwood/tui start"` to root `package.json`.
- [ ] Consider aliasing `deg` to launch TUI when no arguments given (currently launches Inquirer interactive mode). This would be a change to `packages/cli/src/index.ts` lines 238-249.

---

## Testing Strategy

### ink-testing-library

All component tests use `ink-testing-library@4`:

```typescript
import { render } from 'ink-testing-library';

const { lastFrame, stdin } = render(<MyComponent />);

// Assert on rendered text
expect(lastFrame()).toContain('Expected text');

// Simulate keyboard input
stdin.write('g');  // Single key
stdin.write('\r'); // Enter
stdin.write('\x1B'); // Escape
stdin.write('\x1B[B'); // Down arrow
```

### Hook Tests

Hooks are tested independently using a minimal test harness (React's `renderHook` from `@testing-library/react` or a simple wrapper component):

```typescript
function TestComponent({
  onResult,
}: {
  onResult: (hook: ReturnType<typeof useEncounterForm>) => void;
}) {
  const hook = useEncounterForm();
  onResult(hook);
  return null;
}
```

### Mocking Services

Tests provide mock implementations of Core services via `ServicesProvider`:

```typescript
const mockGenerator = {
  generateEncounter: vi.fn().mockResolvedValue(success(fakeEncounter)),
};
const mockSessionService = { /* ... */ };
const mockTableRepo = { /* ... */ };

render(
  <ServicesProvider value={{ generator: mockGenerator, sessionService: mockSessionService, tableRepo: mockTableRepo }}>
    <EncounterForm onSubmit={vi.fn()} onCancel={vi.fn()} />
  </ServicesProvider>
);
```

### What to verify at each phase

| Phase | Verification                                                               |
| ----- | -------------------------------------------------------------------------- |
| 1     | `pnpm build && pnpm lint && pnpm test` — new package builds, shell renders |
| 2     | Form navigates through all steps, produces valid `GenerationContext`       |
| 3     | Encounter display matches all fields from `Encounter` schema               |
| 4     | Session CRUD works, history displays correctly                             |
| 5     | Full integration: generate → display → save → history                      |

---

## Phasing & Dependencies

```
Phase 1 (scaffolding + shell)
    │
    ▼
Phase 2 (encounter form) ──── depends on Phase 1 (App shell, ServicesContext)
    │
    ▼
Phase 3 (encounter result) ── depends on Phase 2 (form provides context to generate)
    │
    ▼
Phase 4 (session management) ─ depends on Phase 1 (App shell), independent of 2-3
    │
    ▼
Phase 5 (polish) ──────────── depends on all above
```

Phases 2 and 4 can be developed in parallel after Phase 1 is complete. Phase 3 depends on Phase 2 (the form triggers generation). Phase 5 is integration and polish across all components.

---

## Key Decisions

1. **Ink 5 + React 18** — ecosystem compatibility over bleeding edge. Upgrade path to Ink 6 is straightforward.
2. **Separate `packages/tui` package** — enforces hexagonal architecture, keeps CLI clean for scripting, paves way for web UI.
3. **Rendering-agnostic hooks** — `useEncounterForm`, `useEncounterGen`, `useSessionManager` contain zero Ink imports. They manage pure state and could be reused in a web adapter.
4. **Single encounter rendering component** — eliminates the current duplication between `packages/cli/src/index.ts:133-224` and `InteractiveService.printEncounter()`.
5. **No Inquirer dependency** — the TUI replaces all interactive prompts with Ink components and `useInput()` keyboard handling.
6. **Auto-save encounters** — unlike the current interactive mode which prompts "Save this encounter to session history?", the TUI auto-saves when a session is active (faster workflow, undo can come later).

## Open Questions

1. **Replace `deg` interactive mode?** — Should running `deg` with no arguments launch the TUI instead of the Inquirer-based interactive mode? This changes the `packages/cli` default behavior. Alternative: ship `deg-tui` as a separate binary and let users choose.
2. **React 18 JSX transform** — Need to verify that `"jsx": "react-jsx"` in `tsconfig.json` works correctly with Ink 5's custom React renderer. May need `"jsxImportSource": "react"`.
3. **Terminal minimum size** — Should we detect terminal size and warn if too small (e.g., < 80 columns)? Ink's Yoga layout handles overflow, but encounter cards may wrap awkwardly.
4. **ink-big-text for header** — Worth the dependency? It's visually nice but adds ~15KB. Could use simple `<Text bold>` instead and add it later.
