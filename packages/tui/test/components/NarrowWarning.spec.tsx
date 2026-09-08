import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { NarrowWarning } from '../../src/components/NarrowWarning.js';

describe('<NarrowWarning>', () => {
  // ink-testing-library's fake stdout reports 100 columns, so the wide-terminal
  // path (render nothing) is the one we can exercise here. The narrow path is
  // covered by manual QA / the Phase 1 gate (`pnpm start:tui` in a small window).
  it('renders nothing at a normal terminal width', () => {
    const { lastFrame } = render(<NarrowWarning />);
    expect(lastFrame()).toBe('');
  });
});
