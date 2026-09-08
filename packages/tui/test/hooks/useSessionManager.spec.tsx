import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import {
  useSessionManager,
  type SessionManagerApi,
} from '../../src/hooks/useSessionManager.js';
import {
  ServicesProvider,
  type Services,
} from '../../src/context/ServicesContext.js';
import { makeCreatureEncounter, makeSession } from '../fixtures.js';

const tick = () => new Promise((r) => setTimeout(r, 10));

function Harness({ report }: { report: (api: SessionManagerApi) => void }) {
  report(useSessionManager());
  return null;
}

function mountHook(sessionService: Partial<Services['sessionService']>) {
  const services = {
    generator: {} as Services['generator'],
    sessionService: sessionService as Services['sessionService'],
    tableRepo: {} as Services['tableRepo'],
  };
  let api!: SessionManagerApi;
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

describe('useSessionManager', () => {
  it('auto-loads sessions newest-first on mount', async () => {
    const older = makeSession({ updatedAt: '2026-09-01T00:00:00.000Z' });
    const newer = makeSession({ updatedAt: '2026-09-09T00:00:00.000Z' });
    const h = mountHook({
      listSessions: vi
        .fn()
        .mockResolvedValue({ kind: 'success', data: [older, newer] }),
    });
    await tick();

    expect(h.api.sessions.map((s) => s.id)).toEqual([newer.id, older.id]);
    expect(h.api.activeSession?.id).toBe(newer.id);
  });

  it('activeSession is null when there are no sessions', async () => {
    const h = mountHook({
      listSessions: vi.fn().mockResolvedValue({ kind: 'success', data: [] }),
    });
    await tick();
    expect(h.api.activeSession).toBeNull();
  });

  it('createSession prepends and returns the new session', async () => {
    const created = makeSession({ updatedAt: '2026-09-09T00:00:00.000Z' });
    const h = mountHook({
      listSessions: vi.fn().mockResolvedValue({ kind: 'success', data: [] }),
      createSession: vi
        .fn()
        .mockResolvedValue({ kind: 'success', data: created }),
    });
    await tick();

    const result = await h.api.createSession({ partyLevel: 3 });
    await tick();
    expect(result?.id).toBe(created.id);
    expect(h.api.sessions[0]?.id).toBe(created.id);
    expect(h.api.activeSession?.id).toBe(created.id);
  });

  it('saveEncounter delegates to addEncounter for the active session', async () => {
    const active = makeSession({ updatedAt: '2026-09-09T00:00:00.000Z' });
    const updated = { ...active, updatedAt: '2026-09-10T00:00:00.000Z' };
    const addEncounter = vi
      .fn()
      .mockResolvedValue({ kind: 'success', data: updated });
    const h = mountHook({
      listSessions: vi
        .fn()
        .mockResolvedValue({ kind: 'success', data: [active] }),
      addEncounter,
    });
    await tick();

    const enc = makeCreatureEncounter();
    const ok = await h.api.saveEncounter(enc, 'hexwood');
    await tick();

    expect(ok).toBe(true);
    expect(addEncounter).toHaveBeenCalledWith(active.id, enc, 'hexwood');
  });

  it('saveEncounter is a no-op with no active session', async () => {
    const addEncounter = vi.fn();
    const h = mountHook({
      listSessions: vi.fn().mockResolvedValue({ kind: 'success', data: [] }),
      addEncounter,
    });
    await tick();

    const ok = await h.api.saveEncounter(makeCreatureEncounter(), 'hexwood');
    expect(ok).toBe(false);
    expect(addEncounter).not.toHaveBeenCalled();
  });

  it('surfaces a listSessions failure', async () => {
    const h = mountHook({
      listSessions: vi
        .fn()
        .mockResolvedValue({ kind: 'failure', error: new Error('disk gone') }),
    });
    await tick();
    expect(h.api.error).toBe('disk gone');
    expect(h.api.sessions).toEqual([]);
  });
});
