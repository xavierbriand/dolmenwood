import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../src/components/StatusBar.js';

describe('<StatusBar>', () => {
  it('shows the top-level actions on home', () => {
    const { lastFrame } = render(<StatusBar view="home" />);
    const frame = lastFrame();
    expect(frame).toContain('[G]enerate');
    expect(frame).toContain('[S]essions');
    expect(frame).toContain('[Q]uit');
  });

  it('shows a back hint in form and session sub-views', () => {
    for (const view of ['encounter-form', 'sessions'] as const) {
      const { lastFrame } = render(<StatusBar view={view} />);
      expect(lastFrame()).toContain('[Esc] Back');
    }
  });

  it('shows reroll / new / home hints on the result view', () => {
    const { lastFrame } = render(<StatusBar view="encounter-result" />);
    const f = lastFrame() ?? '';
    expect(f).toContain('[G] Reroll');
    expect(f).toContain('[Enter] New encounter');
    expect(f).toContain('[Esc] Home');
  });
});
