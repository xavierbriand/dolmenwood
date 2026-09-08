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

  it('shows a back hint in every sub-view', () => {
    for (const view of [
      'encounter-form',
      'encounter-result',
      'sessions',
    ] as const) {
      const { lastFrame } = render(<StatusBar view={view} />);
      expect(lastFrame()).toContain('[Esc] Back');
    }
  });
});
