import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { SessionList } from '../../src/components/SessionList.js';
import type { SessionManagerApi } from '../../src/hooks/useSessionManager.js';
import { makeCreatureEncounter, makeSession } from '../fixtures.js';

const ENTER = '\r';
const ESC = '\x1B';
const tick = () => new Promise((r) => setTimeout(r, 20));

function fakeManager(over: Partial<SessionManagerApi> = {}): SessionManagerApi {
  return {
    sessions: [],
    activeSession: null,
    loading: false,
    error: null,
    loadSessions: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(makeSession()),
    saveEncounter: vi.fn().mockResolvedValue(true),
    ...over,
  };
}

function renderList(over: Partial<SessionManagerApi> = {}) {
  const manager = fakeManager(over);
  const onBack = vi.fn();
  return { manager, onBack, ...render(<SessionList manager={manager} onBack={onBack} />) };
}

describe('<SessionList>', () => {
  it('lists sessions with id, level and date', () => {
    const s = makeSession({ context: { partyLevel: 4, timeOfDay: 'Day' } });
    const { lastFrame } = renderList({ sessions: [s] });
    const f = lastFrame() ?? '';
    expect(f).toContain(s.id.slice(0, 8));
    expect(f).toContain('Level 4');
  });

  it('shows an empty state with no sessions', () => {
    const { lastFrame } = renderList({ sessions: [] });
    expect(lastFrame()).toContain('No sessions yet');
  });

  it('Esc from the list calls onBack', async () => {
    const { stdin, onBack } = renderList({ sessions: [makeSession()] });
    await tick();
    stdin.write(ESC);
    await tick();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('opens a session detail with its recent history', async () => {
    const session = makeSession({
      history: [
        {
          id: 'h1',
          timestamp: '2026-09-09T10:00:00.000Z',
          encounter: makeCreatureEncounter(),
          regionId: 'hexwood',
        },
      ],
    });
    const { stdin, lastFrame } = renderList({ sessions: [session] });
    await tick();
    stdin.write(ENTER); // open the (only, highlighted) session
    await tick();

    const f = lastFrame() ?? '';
    expect(f).toContain('History (1)');
    expect(f).toContain('3 x Forest Sprite');
    expect(f).toContain('hexwood');
    expect(f).toContain('[Esc] Back to list');
  });

  it('Esc from detail returns to the list', async () => {
    const { stdin, lastFrame, onBack } = renderList({
      sessions: [makeSession()],
    });
    await tick();
    stdin.write(ENTER);
    await tick();
    stdin.write(ESC);
    await tick();
    expect(lastFrame()).toContain('Sessions');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('creates a session from a valid party level', async () => {
    const { stdin, lastFrame, manager } = renderList({ sessions: [] });
    await tick();
    stdin.write('n');
    await tick();
    expect(lastFrame()).toContain('party level');

    stdin.write('3');
    await tick();
    stdin.write(ENTER);
    await tick();

    expect(manager.createSession).toHaveBeenCalledWith({ partyLevel: 3 });
  });

  it('rejects a non-numeric party level inline', async () => {
    const { stdin, lastFrame, manager } = renderList({ sessions: [] });
    await tick();
    stdin.write('n');
    await tick();
    stdin.write('abc');
    await tick();
    stdin.write(ENTER);
    await tick();

    expect(lastFrame()).toContain('whole number');
    expect(manager.createSession).not.toHaveBeenCalled();
  });
});
