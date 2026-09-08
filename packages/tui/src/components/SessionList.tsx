import { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Select, StatusMessage, TextInput } from '@inkjs/ui';
import type { SessionState } from '@dolmenwood/core';
import type { SessionManagerApi } from '../hooks/useSessionManager.js';

export interface SessionListProps {
  manager: SessionManagerApi;
  onBack: () => void;
}

const HISTORY_LIMIT = 10;

function sessionLabel(s: SessionState): string {
  const date = new Date(s.updatedAt).toLocaleDateString();
  return `${s.id.slice(0, 8)}  Level ${s.context.partyLevel}  ${date}`;
}

/** Session history browser: list -> detail, plus a create step. */
export function SessionList({ manager, onBack }: SessionListProps) {
  const { isRawModeSupported } = useStdin();
  const [mode, setMode] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (mode === 'list') {
        if (input === 'n') {
          setCreateError(null);
          setMode('create');
        } else if (key.escape) {
          onBack();
        }
        return;
      }
      if (key.escape) {
        setCreateError(null);
        setMode('list');
      }
    },
    { isActive: Boolean(isRawModeSupported) },
  );

  if (mode === 'create') {
    const submit = (raw: string) => {
      const value = raw.trim();
      if (!/^\d+$/.test(value) || Number(value) < 1) {
        setCreateError('Enter a whole number ≥ 1.');
        return;
      }
      void manager.createSession({ partyLevel: Number(value) }).then((s) => {
        if (s) setMode('list');
      });
    };
    return (
      <Box flexDirection="column">
        <Text>New session — party level:</Text>
        <TextInput placeholder="1" onSubmit={submit} />
        {createError && (
          <StatusMessage variant="error">{createError}</StatusMessage>
        )}
        <Text dimColor>[Esc] Cancel</Text>
      </Box>
    );
  }

  if (mode === 'detail') {
    const session = manager.sessions.find((s) => s.id === selectedId);
    if (!session) {
      return <Text dimColor>Session not found.</Text>;
    }
    const recent = session.history.slice(-HISTORY_LIMIT).reverse();
    return (
      <Box flexDirection="column">
        <Text bold>{session.id.slice(0, 8)}</Text>
        <Text dimColor>
          Level {session.context.partyLevel} · {session.context.timeOfDay} ·{' '}
          {session.context.currentRegionId ?? 'no region'}
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>History ({session.history.length})</Text>
          {recent.length === 0 ? (
            <Text dimColor>— none yet —</Text>
          ) : (
            recent.map((h) => (
              <Text key={h.id}>
                [{new Date(h.timestamp).toLocaleTimeString()}]{' '}
                {h.encounter.summary} ({h.regionId})
              </Text>
            ))
          )}
        </Box>
        <Text dimColor>[Esc] Back to list</Text>
      </Box>
    );
  }

  if (manager.sessions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No sessions yet.</Text>
        <Text dimColor>[N] New session [Esc] Back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>Sessions</Text>
      <Select
        options={manager.sessions.map((s) => ({
          label: sessionLabel(s),
          value: s.id,
        }))}
        onChange={(id) => {
          setSelectedId(id);
          setMode('detail');
        }}
      />
      <Text dimColor>[N] New session [Enter] Open [Esc] Back</Text>
    </Box>
  );
}
