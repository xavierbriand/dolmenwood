import { useCallback, useEffect, useState } from 'react';
import type {
  Encounter,
  SessionContext,
  SessionState,
} from '@dolmenwood/core';
import { useServices } from '../context/ServicesContext.js';

export interface SessionManagerApi {
  sessions: SessionState[];
  /** Most recently updated session, or `null` when there are none. */
  activeSession: SessionState | null;
  loading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  createSession: (
    context?: Partial<SessionContext>,
  ) => Promise<SessionState | null>;
  /** Appends to the active session's history. Returns `false` when none is active. */
  saveEncounter: (encounter: Encounter, regionId: string) => Promise<boolean>;
}

function byUpdatedDesc(a: SessionState, b: SessionState): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/** React state around `SessionService`. No Ink imports. */
export function useSessionManager(): SessionManagerApi {
  const { sessionService } = useServices();
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sessionService.listSessions();
      if (res.kind === 'success') {
        setSessions([...res.data].sort(byUpdatedDesc));
      } else {
        setError(res.error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionService]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(
    async (context?: Partial<SessionContext>) => {
      const res = await sessionService.createSession(context);
      if (res.kind === 'failure') {
        setError(res.error.message);
        return null;
      }
      setSessions((prev) => [res.data, ...prev].sort(byUpdatedDesc));
      return res.data;
    },
    [sessionService],
  );

  const saveEncounter = useCallback(
    async (encounter: Encounter, regionId: string) => {
      const active = [...sessions].sort(byUpdatedDesc)[0] ?? null;
      if (!active) return false;
      const res = await sessionService.addEncounter(
        active.id,
        encounter,
        regionId,
      );
      if (res.kind === 'failure') {
        setError(res.error.message);
        return false;
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === res.data.id ? res.data : s)).sort(byUpdatedDesc),
      );
      return true;
    },
    [sessionService, sessions],
  );

  return {
    sessions,
    activeSession: sessions[0] ?? null,
    loading,
    error,
    loadSessions,
    createSession,
    saveEncounter,
  };
}
