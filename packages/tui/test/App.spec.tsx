import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type { RegionTable } from '@dolmenwood/core';
import { App } from '../src/App.js';
import {
  ServicesProvider,
  type Services,
} from '../src/context/ServicesContext.js';
import { makeCreatureEncounter, makeSession } from './fixtures.js';

const ESC = '\x1B';
const tick = () => new Promise((r) => setTimeout(r, 30));

interface RenderOpts {
  props?: React.ComponentProps<typeof App>;
  sessions?: ReturnType<typeof makeSession>[];
}

function renderApp({ props = {}, sessions = [] }: RenderOpts = {}) {
  const generateEncounter = vi
    .fn()
    .mockResolvedValue({ kind: 'success', data: makeCreatureEncounter() });
  const listSessions = vi
    .fn()
    .mockResolvedValue({ kind: 'success', data: sessions });
  const services = {
    generator: { generateEncounter } as unknown as Services['generator'],
    sessionService: {
      listSessions,
      createSession: vi.fn(),
      addEncounter: vi.fn(),
    } as unknown as Services['sessionService'],
    tableRepo: {
      listTables: vi.fn().mockResolvedValue({
        kind: 'success',
        data: [{ name: 'Regional - Hexwood' }] as unknown as RegionTable[],
      }),
      getTable: vi.fn(),
    } as unknown as Services['tableRepo'],
  };
  return {
    ...render(
      <ServicesProvider value={services}>
        <App {...props} />
      </ServicesProvider>,
    ),
    generateEncounter,
    listSessions,
  };
}

describe('<App> shell', () => {
  it('shows the header and home keybind hints on startup', () => {
    const { lastFrame } = renderApp();
    const frame = lastFrame();
    expect(frame).toContain('Dolmenwood Encounter Generator');
    expect(frame).toContain('[G]enerate');
    expect(frame).toContain('[S]essions');
    expect(frame).toContain('[Q]uit');
  });

  it('routes home -> encounter form on "g" and back on Esc', async () => {
    const { lastFrame, stdin } = renderApp();
    await tick();

    stdin.write('g');
    await tick();
    expect(lastFrame()).toContain('Select region');
    expect(lastFrame()).toContain('[Esc] Back');

    stdin.write(ESC);
    await tick();
    expect(lastFrame()).toContain('[G]enerate');
  });

  it('routes to sessions on "s" and back home on Esc', async () => {
    const { lastFrame, stdin } = renderApp({ sessions: [makeSession()] });
    await tick();
    stdin.write('s');
    await tick();
    expect(lastFrame()).toContain('Sessions');
    expect(lastFrame()).toContain('[Esc] Back');

    stdin.write(ESC);
    await tick();
    expect(lastFrame()).toContain('[G]enerate');
  });

  it('calls onExit on "q" from home', async () => {
    const onExit = vi.fn();
    const { stdin } = renderApp({ props: { onExit } });
    await tick();
    stdin.write('q');
    await tick();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('ignores "q" while in a sub-view', async () => {
    const onExit = vi.fn();
    const { stdin } = renderApp({ props: { onExit } });
    await tick();
    stdin.write('s');
    await tick();
    stdin.write('q');
    await tick();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('shows the active-session badge from the session manager', async () => {
    const session = makeSession({
      context: { partyLevel: 3, timeOfDay: 'Day' },
    });
    const { lastFrame } = renderApp({ sessions: [session] });
    await tick();
    expect(lastFrame()).toContain('L3');
    expect(lastFrame()).toContain(session.id.slice(0, 8));
  });

  async function walkFormToResult(stdin: { write: (s: string) => void }) {
    stdin.write('g'); // -> form
    await tick();
    stdin.write('\r'); // region: Hexwood
    await tick();
    stdin.write('\r'); // time: Day
    await tick();
    stdin.write('\r'); // terrain: Off-road -> Day flow submits
    await tick();
  }

  it('generates and renders an encounter after the form is submitted', async () => {
    const { lastFrame, stdin, generateEncounter } = renderApp();
    await tick();
    await walkFormToResult(stdin);

    expect(generateEncounter).toHaveBeenCalledWith({
      regionId: 'hexwood',
      timeOfDay: 'Day',
      terrain: 'Off-road',
      camping: false,
    });
    const frame = lastFrame() ?? '';
    expect(frame).toContain('3 x Forest Sprite');
    expect(frame).toContain('[G] Reroll');
  });

  it('rerolls on "g" from the result view', async () => {
    const { stdin, generateEncounter } = renderApp();
    await tick();
    await walkFormToResult(stdin);
    expect(generateEncounter).toHaveBeenCalledTimes(1);

    stdin.write('g');
    await tick();
    expect(generateEncounter).toHaveBeenCalledTimes(2);
  });

  it('returns to the form on Enter and home on Esc from the result view', async () => {
    const { lastFrame, stdin } = renderApp();
    await tick();
    await walkFormToResult(stdin);

    stdin.write('\r'); // Enter -> back to form
    await tick();
    expect(lastFrame()).toContain('Select region');

    // submit again to get back to the result view
    stdin.write('\r');
    await tick();
    stdin.write('\r');
    await tick();
    stdin.write('\r');
    await tick();
    expect(lastFrame()).toContain('3 x Forest Sprite');

    stdin.write(ESC); // -> home
    await tick();
    expect(lastFrame()).toContain('[G]enerate');
  });
});
