import { useCallback, useState } from 'react';
import type { GenerationContext } from '@dolmenwood/core';

export type TimeOfDay = 'Day' | 'Night';
export type Terrain = 'Road' | 'Off-road';

export interface EncounterFormApi {
  regionId: string | null;
  timeOfDay: TimeOfDay;
  terrain: Terrain;
  camping: boolean;
  setRegion: (id: string) => void;
  setTimeOfDay: (t: TimeOfDay) => void;
  setTerrain: (t: Terrain) => void;
  setCamping: (c: boolean) => void;
  /** A valid `GenerationContext`, or `null` until a region is chosen. */
  toContext: () => GenerationContext | null;
  reset: () => void;
}

const DEFAULT_TIME: TimeOfDay = 'Day';
const DEFAULT_TERRAIN: Terrain = 'Off-road';

/**
 * Rendering-agnostic state for the encounter parameter form. Contains no Ink
 * imports so a future web adapter can reuse it verbatim.
 */
export function useEncounterForm(): EncounterFormApi {
  const [regionId, setRegionId] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(DEFAULT_TIME);
  const [terrain, setTerrain] = useState<Terrain>(DEFAULT_TERRAIN);
  const [camping, setCamping] = useState(false);

  const reset = useCallback(() => {
    setRegionId(null);
    setTimeOfDay(DEFAULT_TIME);
    setTerrain(DEFAULT_TERRAIN);
    setCamping(false);
  }, []);

  const toContext = useCallback((): GenerationContext | null => {
    if (!regionId) return null;
    return { regionId, timeOfDay, terrain, camping };
  }, [regionId, timeOfDay, terrain, camping]);

  return {
    regionId,
    timeOfDay,
    terrain,
    camping,
    setRegion: setRegionId,
    setTimeOfDay,
    setTerrain,
    setCamping,
    toContext,
    reset,
  };
}
