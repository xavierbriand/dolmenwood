import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  EncounterResult,
  surpriseColor,
} from '../../src/components/EncounterResult.js';
import { makeCreatureEncounter, makeTreasure } from '../fixtures.js';

const idle = { loading: false, error: null };

describe('surpriseColor', () => {
  it('maps the surprise text to a colour', () => {
    expect(surpriseColor('Players surprised')).toBe('yellow');
    expect(surpriseColor('Both sides surprised')).toBe('magenta');
    expect(surpriseColor('Neither')).toBeUndefined();
  });
});

describe('<EncounterResult>', () => {
  it('shows a spinner while loading', () => {
    const { lastFrame } = render(
      <EncounterResult encounter={null} loading error={null} />,
    );
    expect(lastFrame()).toContain('Rolling');
  });

  it('shows an error message', () => {
    const { lastFrame } = render(
      <EncounterResult encounter={null} loading={false} error="no table" />,
    );
    expect(lastFrame()).toContain('no table');
  });

  it('renders the core encounter fields', () => {
    const { lastFrame } = render(
      <EncounterResult encounter={makeCreatureEncounter()} {...idle} />,
    );
    const f = lastFrame() ?? '';
    expect(f).toContain('3 x Forest Sprite');
    expect(f).toContain('Type:');
    expect(f).toContain('Creature');
    expect(f).toContain('180 feet');
    expect(f).toContain('Players surprised');
    expect(f).toContain('Foraging');
    expect(f).toContain('Hostile');
    expect(f).toContain('[Wandering]');
  });

  it('marks a lair encounter', () => {
    const { lastFrame } = render(
      <EncounterResult
        encounter={makeCreatureEncounter({ isLair: true })}
        {...idle}
      />,
    );
    expect(lastFrame()).toContain('[In Lair]');
    expect(lastFrame()).not.toContain('[Wandering]');
  });

  it('renders the creature stat block', () => {
    const { lastFrame } = render(
      <EncounterResult encounter={makeCreatureEncounter()} {...idle} />,
    );
    const f = lastFrame() ?? '';
    expect(f).toContain('Forest Sprite');
    expect(f).toMatch(/AC\s+14/);
    expect(f).toMatch(/HD\s+2/);
    expect(f).toMatch(/Morale\s+7/);
    expect(f).toContain('Claw (1d4), Bite (1d6)');
    expect(f).toContain('Neutral');
    expect(f).toMatch(/Level\s+2/);
    expect(f).toMatch(/XP\s+25/);
    expect(f).toContain('deep woods');
  });

  it('renders treasure: only non-zero coins, gems, art, magic, total', () => {
    const { lastFrame } = render(
      <EncounterResult
        encounter={makeCreatureEncounter({ treasure: makeTreasure() })}
        {...idle}
      />,
    );
    const f = lastFrame() ?? '';
    expect(f).toContain('Treasure');
    expect(f).toContain('120 sp');
    expect(f).toContain('45 gp');
    expect(f).not.toContain('0 cp');
    expect(f).not.toContain('0 pp');
    expect(f).toContain('Amethyst (100gp)');
    expect(f).toContain('silver chalice (60gp)');
    expect(f).toContain('Potion of Healing');
    expect(f).toContain('Total Value:');
    expect(f).toContain('265 gp');
  });

  it('renders a possessions line when present', () => {
    const { lastFrame } = render(
      <EncounterResult
        encounter={makeCreatureEncounter({ possessions: 'a rusty key' })}
        {...idle}
      />,
    );
    expect(lastFrame()).toContain('Possessions:');
    expect(lastFrame()).toContain('a rusty key');
  });

  it('omits optional sections that are absent', () => {
    const bare = {
      type: 'Regional' as const,
      summary: 'Strange weather',
      details: {},
    };
    const { lastFrame } = render(<EncounterResult encounter={bare} {...idle} />);
    const f = lastFrame() ?? '';
    expect(f).toContain('Strange weather');
    expect(f).not.toContain('Distance:');
    expect(f).not.toContain('Treasure');
    expect(f).not.toContain('Possessions:');
  });
});
