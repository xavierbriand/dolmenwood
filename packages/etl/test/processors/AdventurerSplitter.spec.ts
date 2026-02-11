import { describe, it, expect } from 'vitest';
import { AdventurerSplitter } from '../../src/processors/AdventurerSplitter.js';

describe('AdventurerSplitter', () => {
  const splitter = new AdventurerSplitter();

  describe('split', () => {
    it('should return empty array for empty input', () => {
      expect(splitter.split('')).toEqual([]);
    });

    it('should split section into individual class blocks by ALL CAPS headers', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and righteous questers.",
        'Example stat blocks for all classes.',
        'Details: Basic equipment provided.',
        'Non-adventurers: When using for non-adventurers, reduce stats. The average town guard captain does not have magic armaments.',
        'WARRIOR',
        'Level 1 Warrior (Recruit)',
        'size/type By KinDreD-sentient-any alignMent',
        'Level 1 AC 15 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Weapon (+1) Speed 20 Morale 7 XP 10 Enc 2d6',
        'MAGE',
        'Level 1 Mage (Apprentice)',
        'size/type By KinDreD-sentient-any alignMent',
        'Level 1 AC 10 HP 1d4 (2) Saves D13 R14 H13 B16 S15',
        'Att Weapon (+0) Speed 40 Morale 6 XP 15 Enc 1d6',
      ].join('\n');

      const blocks = splitter.split(input);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].name).toBe('WARRIOR');
      expect(blocks[0].text).toContain('Level 1 Warrior');
      expect(blocks[1].name).toBe('MAGE');
      expect(blocks[1].text).toContain('Level 1 Mage');
    });

    it('should strip page breaks from the text', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and questers. The average town guard captain does not have magic armaments.",
        'WARRIOR',
        'Level 1 Warrior (Recruit)',
        'A sturdy fighter.',
        'part three | appenDices',
        '105',
        'MAGE',
        'Level 1 Mage (Apprentice)',
        'A spell-caster.',
      ].join('\n');

      const blocks = splitter.split(input);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].text).not.toContain('part three');
      expect(blocks[1].name).toBe('MAGE');
    });

    it('should strip the preamble before class headers', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and righteous questers.",
        'Example stat blocks for all nine classes.',
        'Details: Basic equipment and spells provided.',
        'Non-adventurers: When using for guards, reduce stats. The average town guard captain does not have magic armaments.',
        'WARRIOR',
        'A warrior.',
      ].join('\n');

      const blocks = splitter.split(input);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].name).toBe('WARRIOR');
    });

    it('should filter to only TOC class names when tocNames is provided', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and questers. The average town guard captain does not have magic armaments.",
        'WARRIOR',
        'Level 1 Warrior (Recruit)',
        'A brave fighter.',
        'COMBAT TACTICS',
        'Various tactics used by warriors.',
        'MAGE',
        'Level 1 Mage (Apprentice)',
        'A spell-caster.',
        'KINDRED TRAITS',
        'Traits of various kindred.',
      ].join('\n');

      // Only WARRIOR and MAGE are in the TOC
      const blocks = splitter.split(input, ['Warrior', 'Mage']);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].name).toBe('WARRIOR');
      expect(blocks[0].text).toContain('COMBAT TACTICS');
      expect(blocks[1].name).toBe('MAGE');
      expect(blocks[1].text).toContain('KINDRED TRAITS');
    });

    it('should strip the trailing cross-reference table', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and questers. The average town guard captain does not have magic armaments.",
        'WARRIOR',
        'Level 1 Warrior (Recruit)',
        'A brave fighter.',
        'ADVENTURER CLASS BY KINDRED',
        'KindredWarriorMageCleric',
        'Human1-23-45-6',
        'Elf7-89-1011-12',
      ].join('\n');

      const blocks = splitter.split(input, ['Warrior']);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).not.toContain('ADVENTURER CLASS BY KINDRED');
    });

    it('should handle blocks with interstitial content between classes', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and questers. The average town guard captain does not have magic armaments.",
        'WARRIOR',
        'A fighter class.',
        'Possessions and Hoards',
        'Adventurers carry 2d8gp per Level.',
        'MAGE',
        'A magic class.',
      ].join('\n');

      const blocks = splitter.split(input, ['Warrior', 'Mage']);

      expect(blocks).toHaveLength(2);
      // The interstitial "Possessions and Hoards" text should be part of the WARRIOR block
      expect(blocks[0].text).toContain('Possessions and Hoards');
      expect(blocks[1].name).toBe('MAGE');
    });
  });
});
