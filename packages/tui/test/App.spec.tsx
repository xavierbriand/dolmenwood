import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../src/App.js';

const ESC = '\x1B';
const tick = () => new Promise((r) => setTimeout(r, 30));

describe('<App> shell', () => {
  it('shows the header and home keybind hints on startup', () => {
    const { lastFrame } = render(<App />);
    const frame = lastFrame();
    expect(frame).toContain('Dolmenwood Encounter Generator');
    expect(frame).toContain('[G]enerate');
    expect(frame).toContain('[S]essions');
    expect(frame).toContain('[Q]uit');
  });

  it('routes home -> encounter form on "g" and back on Esc', async () => {
    const { lastFrame, stdin } = render(<App />);
    await tick();

    stdin.write('g');
    await tick();
    expect(lastFrame()).toContain('Select Region');
    expect(lastFrame()).toContain('[Esc] Back');

    stdin.write(ESC);
    await tick();
    expect(lastFrame()).toContain('[G]enerate');
  });

  it('routes to sessions on "s"', async () => {
    const { lastFrame, stdin } = render(<App />);
    await tick();
    stdin.write('s');
    await tick();
    expect(lastFrame()).toContain('Sessions');
  });

  it('calls onExit on "q" from home', async () => {
    const onExit = vi.fn();
    const { stdin } = render(<App onExit={onExit} />);
    await tick();
    stdin.write('q');
    await tick();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('ignores "q" while in a sub-view', async () => {
    const onExit = vi.fn();
    const { stdin } = render(<App onExit={onExit} />);
    await tick();
    stdin.write('s');
    await tick();
    stdin.write('q');
    await tick();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('renders the active-session badge when given one', () => {
    const { lastFrame } = render(
      <App session={{ id: 'abcdef12-3456-7890', partyLevel: 3 }} />,
    );
    expect(lastFrame()).toContain('L3');
    expect(lastFrame()).toContain('abcdef12');
  });
});
