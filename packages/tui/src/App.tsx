import { useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import { Header, type HeaderSession } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { NarrowWarning } from './components/NarrowWarning.js';
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

  const exit = onExit ?? (() => app.exit());

  useInput(
    (input, key) => {
      if (view === 'home') {
        if (input === 'g') setView('encounter-form');
        else if (input === 's') setView('sessions');
        else if (input === 'q') exit();
        return;
      }
      if (key.escape) setView('home');
    },
    // Keyboard input needs a TTY in raw mode; render statically otherwise
    // (piped stdin, CI) instead of crashing. Coerce to a real boolean — Ink's
    // `useInput` only short-circuits on `isActive === false`, not undefined.
    { isActive: Boolean(isRawModeSupported) },
  );

  return (
    <Box flexDirection="column">
      <NarrowWarning />
      <Header session={session} />
      <Box marginY={1}>
        <MainView view={view} />
      </Box>
      <StatusBar view={view} />
    </Box>
  );
}

/**
 * View router. Phases 2–4 replace each placeholder with the real component
 * (`<EncounterForm>`, `<EncounterResult>`, `<SessionList>`).
 */
function MainView({ view }: { view: View }) {
  switch (view) {
    case 'encounter-form':
      return <Text>Select Region — encounter form (Phase 2)</Text>;
    case 'encounter-result':
      return <Text>Encounter result (Phase 3)</Text>;
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
