import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type { RegionTable } from '@dolmenwood/core';
import { App } from '../src/App.js';
import {
  ServicesProvider,
  type Services,
} from '../src/context/ServicesContext.js';

const ESC = '\x1B';
const tick = () => new Promise((r) => setTimeout(r, 30));

function renderApp(props: React.ComponentProps<typeof App> = {}) {
  const services = {
    generator: {} as Services['generator'],
    sessionService: {} as Services['sessionService'],
    tableRepo: {
      listTables: vi.fn().mockResolvedValue({
        kind: 'success',
        data: [{ name: 'Regional - Hexwood' }] as unknown as RegionTable[],
      }),
      getTable: vi.fn(),
    } as unknown as Services['tableRepo'],
  };
  return render(
    <ServicesProvider value={services}>
      <App {...props} />
    </ServicesProvider>,
  );
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

  it('routes to sessions on "s"', async () => {
    const { lastFrame, stdin } = renderApp();
    await tick();
    stdin.write('s');
    await tick();
    expect(lastFrame()).toContain('Sessions');
  });

  it('calls onExit on "q" from home', async () => {
    const onExit = vi.fn();
    const { stdin } = renderApp({ onExit });
    await tick();
    stdin.write('q');
    await tick();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('ignores "q" while in a sub-view', async () => {
    const onExit = vi.fn();
    const { stdin } = renderApp({ onExit });
    await tick();
    stdin.write('s');
    await tick();
    stdin.write('q');
    await tick();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('renders the active-session badge when given one', () => {
    const { lastFrame } = renderApp({
      session: { id: 'abcdef12-3456-7890', partyLevel: 3 },
    });
    expect(lastFrame()).toContain('L3');
    expect(lastFrame()).toContain('abcdef12');
  });

  it('shows the submitted context on the result view after the form', async () => {
    const { lastFrame, stdin } = renderApp();
    await tick();
    stdin.write('g'); // -> form
    await tick();
    stdin.write('\r'); // region: Hexwood
    await tick();
    stdin.write('\r'); // time: Day
    await tick();
    stdin.write('\r'); // terrain: Off-road -> Day flow submits
    await tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Encounter result');
    expect(frame).toContain('hexwood');
    expect(frame).toContain('Day');
    expect(frame).toContain('Off-road');
  });
});
