import { useState } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import type { GenerationContext } from '@dolmenwood/core';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { NarrowWarning } from './components/NarrowWarning.js';
import { EncounterForm } from './components/EncounterForm.js';
import { EncounterResult } from './components/EncounterResult.js';
import { SessionList } from './components/SessionList.js';
import { useEncounterGen } from './hooks/useEncounterGen.js';
import { useSessionManager } from './hooks/useSessionManager.js';
import type { View } from './types.js';

export interface AppProps {
  /** Called when the user quits. Defaults to Ink's `useApp().exit`. */
  onExit?: () => void;
  /** Starting screen. Defaults to `'home'`. Used by tests. */
  initialView?: View;
}

export function App({ onExit, initialView = 'home' }: AppProps) {
  const app = useApp();
  const { isRawModeSupported } = useStdin();
  const [view, setView] = useState<View>(initialView);
  const [lastContext, setLastContext] = useState<GenerationContext | null>(null);
  const gen = useEncounterGen();
  const sessions = useSessionManager();

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
      }
      // 'encounter-form' and 'sessions' own their own Esc handling.
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

  const active = sessions.activeSession;

  return (
    <Box flexDirection="column">
      <NarrowWarning />
      <Header
        session={
          active
            ? { id: active.id, partyLevel: active.context.partyLevel }
            : null
        }
      />
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
        ) : view === 'sessions' ? (
          <SessionList manager={sessions} onBack={() => setView('home')} />
        ) : (
          <Text dimColor>
            Press [G] to generate an encounter, or [S] to manage sessions.
          </Text>
        )}
      </Box>
      <StatusBar view={view} />
    </Box>
  );
}
