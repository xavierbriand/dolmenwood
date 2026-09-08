import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  useEncounterForm,
  type EncounterFormApi,
} from '../../src/hooks/useEncounterForm.js';

const tick = () => new Promise((r) => setTimeout(r, 10));

/** Renders the hook and hands the latest value back through `report`. */
function Harness({ report }: { report: (api: EncounterFormApi) => void }) {
  report(useEncounterForm());
  return null;
}

function mountHook() {
  let api!: EncounterFormApi;
  render(<Harness report={(a) => (api = a)} />);
  return {
    get api() {
      return api;
    },
  };
}

describe('useEncounterForm', () => {
  it('starts with no region and sensible defaults', () => {
    const { api } = mountHook();
    expect(api.regionId).toBeNull();
    expect(api.timeOfDay).toBe('Day');
    expect(api.terrain).toBe('Off-road');
    expect(api.camping).toBe(false);
  });

  it('toContext() is null until a region is set', async () => {
    const h = mountHook();
    expect(h.api.toContext()).toBeNull();

    h.api.setRegion('forest');
    await tick();

    expect(h.api.toContext()).toEqual({
      regionId: 'forest',
      timeOfDay: 'Day',
      terrain: 'Off-road',
      camping: false,
    });
  });

  it('setters update each field', async () => {
    const h = mountHook();
    h.api.setRegion('highglen');
    h.api.setTimeOfDay('Night');
    h.api.setTerrain('Road');
    h.api.setCamping(true);
    await tick();

    expect(h.api.toContext()).toEqual({
      regionId: 'highglen',
      timeOfDay: 'Night',
      terrain: 'Road',
      camping: true,
    });
  });

  it('reset() returns to the initial state', async () => {
    const h = mountHook();
    h.api.setRegion('mulchgrove');
    h.api.setTimeOfDay('Night');
    h.api.setCamping(true);
    await tick();
    expect(h.api.regionId).toBe('mulchgrove');

    h.api.reset();
    await tick();
    expect(h.api.regionId).toBeNull();
    expect(h.api.timeOfDay).toBe('Day');
    expect(h.api.terrain).toBe('Off-road');
    expect(h.api.camping).toBe(false);
  });
});
