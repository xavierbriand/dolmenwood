import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type { GenerationContext } from '@dolmenwood/core';
import {
  useEncounterGen,
  type EncounterGenApi,
} from '../../src/hooks/useEncounterGen.js';
import {
  ServicesProvider,
  type Services,
} from '../../src/context/ServicesContext.js';
import { makeCreatureEncounter } from '../fixtures.js';

const tick = () => new Promise((r) => setTimeout(r, 10));

const CONTEXT: GenerationContext = {
  regionId: 'hexwood',
  timeOfDay: 'Day',
  terrain: 'Off-road',
  camping: false,
};

function Harness({ report }: { report: (api: EncounterGenApi) => void }) {
  report(useEncounterGen());
  return null;
}

function mountHook(generator: Partial<Services['generator']>) {
  const services = {
    generator: generator as Services['generator'],
    sessionService: {} as Services['sessionService'],
    tableRepo: {} as Services['tableRepo'],
  };
  let api!: EncounterGenApi;
  render(
    <ServicesProvider value={services}>
      <Harness report={(a) => (api = a)} />
    </ServicesProvider>,
  );
  return {
    get api() {
      return api;
    },
  };
}

describe('useEncounterGen', () => {
  it('starts idle', () => {
    const { api } = mountHook({ generateEncounter: vi.fn() });
    expect(api.encounter).toBeNull();
    expect(api.loading).toBe(false);
    expect(api.error).toBeNull();
  });

  it('sets loading while generating, then the encounter on success', async () => {
    const encounter = makeCreatureEncounter();
    let resolve!: (v: unknown) => void;
    const generateEncounter = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const h = mountHook({ generateEncounter });

    void h.api.generate(CONTEXT);
    await tick();
    expect(h.api.loading).toBe(true);

    resolve({ kind: 'success', data: encounter });
    await tick();
    expect(h.api.loading).toBe(false);
    expect(h.api.encounter).toEqual(encounter);
    expect(h.api.error).toBeNull();
    expect(generateEncounter).toHaveBeenCalledWith(CONTEXT);
  });

  it('resolves with the encounter on success', async () => {
    const encounter = makeCreatureEncounter();
    const h = mountHook({
      generateEncounter: vi
        .fn()
        .mockResolvedValue({ kind: 'success', data: encounter }),
    });
    await expect(h.api.generate(CONTEXT)).resolves.toEqual(encounter);
  });

  it('records the message on a failure Result and resolves null', async () => {
    const h = mountHook({
      generateEncounter: vi
        .fn()
        .mockResolvedValue({ kind: 'failure', error: new Error('no table') }),
    });
    await expect(h.api.generate(CONTEXT)).resolves.toBeNull();
    await tick();
    expect(h.api.loading).toBe(false);
    expect(h.api.encounter).toBeNull();
    expect(h.api.error).toBe('no table');
  });

  it('records a thrown error', async () => {
    const h = mountHook({
      generateEncounter: vi.fn().mockRejectedValue(new Error('boom')),
    });
    await h.api.generate(CONTEXT);
    await tick();
    expect(h.api.error).toBe('boom');
    expect(h.api.loading).toBe(false);
  });

  it('clear() resets everything', async () => {
    const h = mountHook({
      generateEncounter: vi
        .fn()
        .mockResolvedValue({ kind: 'success', data: makeCreatureEncounter() }),
    });
    await h.api.generate(CONTEXT);
    await tick();
    expect(h.api.encounter).not.toBeNull();

    h.api.clear();
    await tick();
    expect(h.api.encounter).toBeNull();
    expect(h.api.error).toBeNull();
    expect(h.api.loading).toBe(false);
  });
});
