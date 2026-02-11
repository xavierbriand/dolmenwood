import { describe, it, expect } from 'vitest';
import { FactionParser } from '../../src/processors/FactionParser.js';

describe('FactionParser', () => {
  const parser = new FactionParser();

  describe('extractSection', () => {
    it('should extract the Creatures and Factions section', () => {
      const input = [
        'Some preamble text',
        'Creatures and Factions',
        'The following creatures are associated with one of the',
        'seven major factions.',
        'Dark Order: Shadow Knight, Skull Mage.',
        'Forest Court: Tree Sprite, Vine Walker.',
        'part one | Monsters of DolMenwooD',
        'Other content',
      ].join('\n');

      const result = parser.extractSection(input);

      expect(result).toContain('Creatures and Factions');
      expect(result).toContain('Dark Order');
      expect(result).toContain('Forest Court');
      expect(result).not.toContain('Other content');
    });

    it('should return empty string when section is not found', () => {
      const input = 'No faction section here\nJust random text.';

      const result = parser.extractSection(input);

      expect(result).toBe('');
    });

    it('should extract to EOF when end marker is not found', () => {
      const input = [
        'Creatures and Factions',
        'Dark Order: Shadow Knight.',
      ].join('\n');

      const result = parser.extractSection(input);

      expect(result).toContain('Dark Order');
    });
  });

  describe('parseFactions', () => {
    it('should parse a single faction with multiple creatures', () => {
      const section = [
        'Creatures and Factions',
        'The following creatures are associated with one of the',
        'seven major factions.',
        'Dark Order: Shadow Knight, Skull Mage, Night Wraith.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.get('Dark Order')).toEqual([
        'Shadow Knight',
        'Skull Mage',
        'Night Wraith',
      ]);
    });

    it('should parse multiple factions', () => {
      const section = [
        'Creatures and Factions',
        'Description text here.',
        'Dark Order: Shadow Knight, Skull Mage.',
        'Forest Court: Tree Sprite, Vine Walker.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.size).toBe(2);
      expect(result.get('Dark Order')).toEqual(['Shadow Knight', 'Skull Mage']);
      expect(result.get('Forest Court')).toEqual([
        'Tree Sprite',
        'Vine Walker',
      ]);
    });

    it('should strip parenthetical notes from creature names', () => {
      const section = [
        'Creatures and Factions',
        'Description.',
        'Dark Order: Shadow Knight (may serve the Dark Lord), Skull Mage.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.get('Dark Order')).toEqual(['Shadow Knight', 'Skull Mage']);
    });

    it('should normalize creature names to title case', () => {
      const section = [
        'Creatures and Factions',
        'Description.',
        'Dark Order: shadow knight, skull mage.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.get('Dark Order')).toEqual(['Shadow Knight', 'Skull Mage']);
    });

    it('should normalize hyphenated creature names', () => {
      const section = [
        'Creatures and Factions',
        'Description.',
        'Dark Order: centaur-bestial, unicorn-corrupt.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.get('Dark Order')).toEqual([
        'Centaur-Bestial',
        'Unicorn-Corrupt',
      ]);
    });

    it('should handle entries that wrap across lines', () => {
      const section = [
        'Creatures and Factions',
        'Description.',
        'Dark Order: Shadow Knight, Skull',
        'Mage, Night Wraith.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.get('Dark Order')).toEqual([
        'Shadow Knight',
        'Skull Mage',
        'Night Wraith',
      ]);
    });

    it('should handle a single creature in a faction', () => {
      const section = [
        'Creatures and Factions',
        'Description.',
        'Royal Guard: Knight.',
      ].join('\n');

      const result = parser.parseFactions(section);

      expect(result.get('Royal Guard')).toEqual(['Knight']);
    });

    it('should return empty map for empty input', () => {
      const result = parser.parseFactions('');

      expect(result.size).toBe(0);
    });
  });

  describe('buildCreatureFactionMap', () => {
    it('should build a reverse lookup from creature to factions', () => {
      const factions = new Map<string, string[]>([
        ['Dark Order', ['Shadow Knight', 'Skull Mage']],
        ['Forest Court', ['Tree Sprite', 'Shadow Knight']],
      ]);

      const result = parser.buildCreatureFactionMap(factions);

      expect(result.get('shadow knight')).toEqual([
        'Dark Order',
        'Forest Court',
      ]);
      expect(result.get('skull mage')).toEqual(['Dark Order']);
      expect(result.get('tree sprite')).toEqual(['Forest Court']);
    });

    it('should use lowercase keys for case-insensitive lookup', () => {
      const factions = new Map<string, string[]>([
        ['Dark Order', ['Shadow Knight']],
      ]);

      const result = parser.buildCreatureFactionMap(factions);

      expect(result.has('shadow knight')).toBe(true);
      expect(result.has('Shadow Knight')).toBe(false);
    });
  });

  describe('parse (end-to-end)', () => {
    it('should extract, parse, and build reverse map from full text', () => {
      const input = [
        'Some preamble text',
        'Creatures and Factions',
        'The following creatures are associated with one of the',
        'seven major factions.',
        'Dark Order: Shadow Knight, Skull Mage.',
        'Forest Court: Tree Sprite, Shadow Knight.',
        'part one | Monsters of DolMenwooD',
        'Other content',
      ].join('\n');

      const result = parser.parse(input);

      expect(result.get('shadow knight')).toEqual([
        'Dark Order',
        'Forest Court',
      ]);
      expect(result.get('skull mage')).toEqual(['Dark Order']);
      expect(result.get('tree sprite')).toEqual(['Forest Court']);
    });

    it('should return empty map when section is not present', () => {
      const result = parser.parse('No factions in this text.');

      expect(result.size).toBe(0);
    });
  });
});
