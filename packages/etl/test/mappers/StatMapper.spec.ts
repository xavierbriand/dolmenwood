import { describe, it, expect } from 'vitest';
import {
  parseLevel,
  parseArmourClass,
  parseHitDice,
  parseAttacks,
  parseMovement,
  parseMorale,
  parseXp,
  parseNumberAppearing,
  parseMeta,
} from '../../src/mappers/StatMapper.js';

describe('StatMapper', () => {
  describe('parseLevel', () => {
    it('should parse integer level', () => {
      expect(parseLevel('4')).toBe(4);
    });

    it('should parse fractional level as string', () => {
      expect(parseLevel('½')).toBe('½');
    });

    it('should parse "1+1" as string', () => {
      expect(parseLevel('1+1')).toBe('1+1');
    });
  });

  describe('parseArmourClass', () => {
    it('should parse integer AC', () => {
      expect(parseArmourClass('14')).toBe(14);
    });
  });

  describe('parseHitDice', () => {
    it('should strip the average from parentheses', () => {
      expect(parseHitDice('4d8 (18)')).toBe('4d8');
    });

    it('should handle plain dice notation', () => {
      expect(parseHitDice('1d6')).toBe('1d6');
    });

    it('should handle hp with modifiers', () => {
      expect(parseHitDice('3d8+3 (16)')).toBe('3d8+3');
    });
  });

  describe('parseAttacks', () => {
    it('should return a single attack as a one-element array', () => {
      expect(parseAttacks('Bite (+3, 2d6)')).toEqual(['Bite (+3, 2d6)']);
    });

    it('should split attacks on " or " outside parentheses', () => {
      expect(parseAttacks('Touch (+6, 1d8 + chill) or wail (death)')).toEqual([
        'Touch (+6, 1d8 + chill)',
        'wail (death)',
      ]);
    });

    it('should split attacks on " and " outside parentheses', () => {
      expect(parseAttacks('Bite (+5, 1d10) and gaze (petrification)')).toEqual([
        'Bite (+5, 1d10)',
        'gaze (petrification)',
      ]);
    });

    it('should not split on "and" inside parentheses', () => {
      expect(parseAttacks('Weapon (+2, 1d8 and 1d6)')).toEqual([
        'Weapon (+2, 1d8 and 1d6)',
      ]);
    });
  });

  describe('parseMovement', () => {
    it('should parse simple speed as walk rate', () => {
      expect(parseMovement({ speed: '40' })).toEqual({ walk: 40 });
    });

    it('should keep speed + fly as separate modes', () => {
      expect(parseMovement({ speed: '30', fly: '60' })).toEqual({
        walk: 30,
        fly: 60,
      });
    });

    it('should keep speed + swim as separate modes', () => {
      expect(parseMovement({ speed: '40', swim: '40' })).toEqual({
        walk: 40,
        swim: 40,
      });
    });

    it('should keep speed + burrow as separate modes', () => {
      expect(parseMovement({ speed: '60', burrow: '20' })).toEqual({
        walk: 60,
        burrow: 20,
      });
    });

    it('should handle fly-only', () => {
      expect(parseMovement({ fly: '160' })).toEqual({ fly: 160 });
    });

    it('should handle swim-only', () => {
      expect(parseMovement({ swim: '40' })).toEqual({ swim: 40 });
    });

    it('should handle webs as an alternate mode', () => {
      expect(parseMovement({ speed: '20', webs: '40' })).toEqual({
        walk: 20,
        webs: 40,
      });
    });

    it('should split a "when mounted" qualifier into walk + mounted', () => {
      expect(parseMovement({ speed: '30 (80 when mounted)' })).toEqual({
        walk: 30,
        mounted: 80,
      });
    });

    it('should keep an unparseable rate verbatim in notes', () => {
      expect(parseMovement({ speed: 'special' })).toEqual({ notes: 'special' });
    });

    it('should return an empty object when no rates are present', () => {
      expect(parseMovement({})).toEqual({});
    });
  });

  describe('parseMorale', () => {
    it('should parse simple integer morale', () => {
      expect(parseMorale('9')).toBe(9);
    });

    it('should extract base morale from complex string', () => {
      expect(parseMorale('7 (8 with a longhorn)')).toBe(7);
    });

    it('should extract base morale from comma-separated', () => {
      expect(parseMorale('7 abroad, 9 in lair')).toBe(7);
    });

    it('should extract base morale from parenthetical "or"', () => {
      expect(parseMorale('10 (or 8, see Fear of fire )')).toBe(10);
    });

    it('should handle morale with conditional in parentheses', () => {
      expect(parseMorale('8 (9 in a group of 4+)')).toBe(8);
    });

    it('should handle morale like "7 (12 in melee)"', () => {
      expect(parseMorale('7 (12 in melee)')).toBe(7);
    });
  });

  describe('parseXp', () => {
    it('should parse integer XP', () => {
      expect(parseXp('180')).toBe(180);
    });

    it('should strip commas from XP', () => {
      expect(parseXp('1,200')).toBe(1200);
    });
  });

  describe('parseNumberAppearing', () => {
    it('should strip lair percentage from encounters', () => {
      expect(parseNumberAppearing('2d4 (75% in lair)')).toBe('2d4');
    });

    it('should strip "(no lair)" from encounters', () => {
      expect(parseNumberAppearing('1d4 (no lair)')).toBe('1d4');
    });

    it('should pass through plain dice notation', () => {
      expect(parseNumberAppearing('3d4')).toBe('3d4');
    });

    it('should pass through plain number', () => {
      expect(parseNumberAppearing('1')).toBe('1');
    });
  });

  describe('parseMeta', () => {
    it('should parse standard meta line into alignment and kindred', () => {
      const result = parseMeta('Medium Undead—Semi-Intelligent—Chaotic');
      expect(result.alignment).toBe('Chaotic');
      expect(result.kindred).toBe('Undead');
    });

    it('should parse multi-word kindred', () => {
      const result = parseMeta('Large Demi-Fey—Sentient—Lawful');
      expect(result.alignment).toBe('Lawful');
      expect(result.kindred).toBe('Demi-Fey');
    });

    it('should handle "Any Alignment"', () => {
      const result = parseMeta('Medium Fairy—Sentient—Any Alignment');
      expect(result.alignment).toBe('Any');
      expect(result.kindred).toBe('Fairy');
    });

    it('should handle "Alignment by Season"', () => {
      const result = parseMeta('Medium Construct—Sentient—Alignment by Season');
      expect(result.alignment).toBe('Alignment by Season');
    });

    it('should handle multi-size meta', () => {
      const result = parseMeta(
        'Sm./Med./Lg. Plant—Animal Intelligence—Neutral',
      );
      expect(result.alignment).toBe('Neutral');
      expect(result.kindred).toBe('Plant');
    });

    it('should handle slash sizes like "Small/Medium"', () => {
      const result = parseMeta('Small/Medium Mortal—Sentient—Any Alignment');
      expect(result.alignment).toBe('Any');
      expect(result.kindred).toBe('Mortal');
    });

    it('should handle "Neutral or Chaotic" alignment', () => {
      const result = parseMeta('Small Demi-Fey—Sentient—Neutral or Chaotic');
      expect(result.alignment).toBe('Neutral or Chaotic');
    });

    it('should handle "Alignment By Individual"', () => {
      const result = parseMeta('Medium Mortal—Genius—Alignment By Individual');
      expect(result.alignment).toBe('Alignment By Individual');
    });

    it('should handle adventurer meta "Size/Type By Kindred"', () => {
      const result = parseMeta('Size/Type By Kindred—Sentient—Any Alignment');
      expect(result.alignment).toBe('Any');
      expect(result.kindred).toBe('Mortal');
    });

    it('should handle adventurer meta with specific alignment', () => {
      const result = parseMeta(
        'Size/Type By Kindred—Sentient—Lawful or Neutral',
      );
      expect(result.alignment).toBe('Lawful or Neutral');
      expect(result.kindred).toBe('Mortal');
    });
  });
});
