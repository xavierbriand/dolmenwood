import { useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { GenerationContext } from '@dolmenwood/core';
import { Header, type HeaderSession } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { NarrowWarning } from './components/NarrowWarning.js';
import { EncounterForm } from './components/EncounterForm.js';
import { EncounterResult } from './components/EncounterResult.js';
import { useEncounterGen } from './hooks/useEncounterGen.js';
import type { View } from './types.js';

export interface AppProps {
  /** Called when the user quits. Defaults to Ink's `useApp().exit`. */
  onExit?: () => void;
  /** Starting screen. Defaults to `'home'`. Used by tests. */
  initialView?: View;
  /** Active session for the header badge. Wired to `SessionService` in Phase 4. */
  session?: HeaderSession | null;
}

export function App({ onExit, initialView = 'home', session = null }: AppProps) {
  const app = useApp();
  const { isRawModeSupported } = useStdin();
  const [view, setView] = useState<View>(initialView);
  const [lastContext, setLastContext] = useState<GenerationContext | null>(null);
  const gen = useEncounterGen();

  const exit = onExit ?? (() => app.exit());

  useInput(
    (input, key) => {
      if (view === 'home') {
        if (input === 'g') setView('encounter-form');
        else if (input === 's') setView('sessions');
        else if (input === 'q') exit();
        return;
      }

      if (view === 'encounter-result') {
        if (input === 'g' && lastContext) {
          void gen.generate(lastContext);
        } else if (key.return) {
          gen.clear();
          setView('encounter-form');
        } else if (key.escape) {
          gen.clear();
          setView('home');
        }
        return;
      }

      // EncounterForm owns Esc while it is mounted (back one step / cancel).
      if (key.escape && view !== 'encounter-form') setView('home');
    },
    // Keyboard input needs a TTY in raw mode; render statically otherwise
    // (piped stdin, CI) instead of crashing. Coerce to a real boolean — Ink's
    // `useInput` only short-circuits on `isActive === false`, not undefined.
    { isActive: Boolean(isRawModeSupported) },
  );

  const handleFormSubmit = (context: GenerationContext) => {
    setLastContext(context);
    void gen.generate(context);
    setView('encounter-result');
  };

  return (
    <Box flexDirection="column">
      <NarrowWarning />
      <Header session={session} />
      <Box marginY={1}>
        {view === 'encounter-form' ? (
          <EncounterForm
            onSubmit={handleFormSubmit}
            onCancel={() => setView('home')}
          />
        ) : view === 'encounter-result' ? (
          <EncounterResult
            encounter={gen.encounter}
            loading={gen.loading}
            error={gen.error}
          />
        ) : (
          <MainView view={view} />
        )}
      </Box>
      <StatusBar view={view} />
    </Box>
  );
}

/** View router for the remaining placeholder screens (Phase 4 replaces these). */
function MainView({ view }: { view: View }) {
  switch (view) {
    case 'sessions':
      return <Text>Sessions (Phase 4)</Text>;
    default:
      return (
        <Text dimColor>
          Press [G] to generate an encounter, or [S] to manage sessions.
        </Text>
      );
  }
}
