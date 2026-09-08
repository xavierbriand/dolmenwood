import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Header } from '../../src/components/Header.js';

describe('<Header>', () => {
  it('renders the title with no session', () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain('Dolmenwood Encounter Generator');
    expect(lastFrame()).not.toContain('L');
  });

  it('renders a level badge and short id for an active session', () => {
    const { lastFrame } = render(
      <Header session={{ id: 'deadbeef-1111-2222-3333', partyLevel: 5 }} />,
    );
    expect(lastFrame()).toContain('L5');
    expect(lastFrame()).toContain('deadbeef');
    expect(lastFrame()).not.toContain('deadbeef-1111');
  });
});
