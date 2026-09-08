import { useCallback, useState } from 'react';
import type { Encounter, GenerationContext } from '@dolmenwood/core';
import { useServices } from '../context/ServicesContext.js';

export interface EncounterGenApi {
  encounter: Encounter | null;
  loading: boolean;
  error: string | null;
  /** Roll an encounter for `context`. Never rejects — failures land in `error`. */
  generate: (context: GenerationContext) => Promise<void>;
  clear: () => void;
}

/**
 * Wraps `EncounterGenerator.generateEncounter` in React state. No Ink imports —
 * a web adapter can reuse this with its own `<ServicesProvider>`.
 */
export function useEncounterGen(): EncounterGenApi {
  const { generator } = useServices();
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (context: GenerationContext) => {
      setLoading(true);
      setError(null);
      try {
        const result = await generator.generateEncounter(context);
        if (result.kind === 'success') {
          setEncounter(result.data);
        } else {
          setEncounter(null);
          setError(result.error.message);
        }
      } catch (err) {
        setEncounter(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [generator],
  );

  const clear = useCallback(() => {
    setEncounter(null);
    setError(null);
    setLoading(false);
  }, []);

  return { encounter, loading, error, generate, clear };
}
