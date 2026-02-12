import { describe, it, expect } from 'vitest';
import { TreasureCodeParser } from './TreasureCodeParser.js';

describe('TreasureCodeParser', () => {
  const parser = new TreasureCodeParser();

  describe('given "None"', () => {
    it('should return null (no treasure)', () => {
      const result = parser.parse('None');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('given a simple single code', () => {
    it('should parse "C1"', () => {
      const result = parser.parse('C1');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toEqual({
          codes: [{ tier: 'C', level: 1 }],
          extras: [],
        });
      }
    });
  });

  describe('given standard multi-code strings', () => {
    it('should parse "C4 + R4 + M1"', () => {
      const result = parser.parse('C4 + R4 + M1');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toEqual({
          codes: [
            { tier: 'C', level: 4 },
            { tier: 'R', level: 4 },
            { tier: 'M', level: 1 },
          ],
          extras: [],
        });
      }
    });

    it('should parse "C6 + R7 + M4"', () => {
      const result = parser.parse('C6 + R7 + M4');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 6 },
          { tier: 'R', level: 7 },
          { tier: 'M', level: 4 },
        ]);
        expect(result.data!.extras).toEqual([]);
      }
    });

    it('should parse "C10 + R8 + M11" (two-digit levels)', () => {
      const result = parser.parse('C10 + R8 + M11');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 10 },
          { tier: 'R', level: 8 },
          { tier: 'M', level: 11 },
        ]);
      }
    });
  });

  describe('given codes with extra spacing', () => {
    it('should parse "C3 + R 3 + M3" (space between R and 3)', () => {
      const result = parser.parse('C3 + R 3 + M3');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 3 },
          { tier: 'R', level: 3 },
          { tier: 'M', level: 3 },
        ]);
      }
    });

    it('should parse "C9 + R 5 + M10"', () => {
      const result = parser.parse('C9 + R 5 + M10');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 9 },
          { tier: 'R', level: 5 },
          { tier: 'M', level: 10 },
        ]);
      }
    });
  });

  describe('given codes with extras', () => {
    it('should parse "C4 + R4 + M1 + 4d20 pots or jugs"', () => {
      const result = parser.parse('C4 + R4 + M1 + 4d20 pots or jugs');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 4 },
          { tier: 'R', level: 4 },
          { tier: 'M', level: 1 },
        ]);
        expect(result.data!.extras).toEqual(['4d20 pots or jugs']);
      }
    });

    it('should parse codes with parenthesised extra containing dice', () => {
      const result = parser.parse('C3 + R 3 + M3 + rare minerals (2d6 × 50gp)');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 3 },
          { tier: 'R', level: 3 },
          { tier: 'M', level: 3 },
        ]);
        expect(result.data!.extras).toEqual(['rare minerals (2d6 × 50gp)']);
      }
    });

    it('should parse codes with a free-text extra', () => {
      const result = parser.parse('C1 + R1 + assorted trade goods');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 1 },
          { tier: 'R', level: 1 },
        ]);
        expect(result.data!.extras).toEqual(['assorted trade goods']);
      }
    });

    it('should parse "C4 + 4d4 gems"', () => {
      const result = parser.parse('C4 + 4d4 gems');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([{ tier: 'C', level: 4 }]);
        expect(result.data!.extras).toEqual(['4d4 gems']);
      }
    });

    it('should parse "C5 + R 2 + M8 + collection"', () => {
      const result = parser.parse('C5 + R 2 + M8 + collection');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 5 },
          { tier: 'R', level: 2 },
          { tier: 'M', level: 8 },
        ]);
        expect(result.data!.extras).toEqual(['collection']);
      }
    });

    it('should parse "C5 + R 2 + M8 + magical"', () => {
      const result = parser.parse('C5 + R 2 + M8 + magical');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 5 },
          { tier: 'R', level: 2 },
          { tier: 'M', level: 8 },
        ]);
        expect(result.data!.extras).toEqual(['magical']);
      }
    });
  });

  describe('given parenthetical notes on last code', () => {
    it('should parse "C3 + R 3 + M3 (remains of victims)"', () => {
      const result = parser.parse('C3 + R 3 + M3 (remains of victims)');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 3 },
          { tier: 'R', level: 3 },
          { tier: 'M', level: 3 },
        ]);
        expect(result.data!.extras).toEqual(['(remains of victims)']);
      }
    });
  });

  describe('given multiplied codes', () => {
    it('should expand "C9 + R 5 + M10 + (R1 × 3)" into 3 separate R1 codes', () => {
      const result = parser.parse('C9 + R 5 + M10 + (R1 × 3)');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 9 },
          { tier: 'R', level: 5 },
          { tier: 'M', level: 10 },
          { tier: 'R', level: 1 },
          { tier: 'R', level: 1 },
          { tier: 'R', level: 1 },
        ]);
        expect(result.data!.extras).toEqual([]);
      }
    });
  });

  describe('given multiple same-tier codes', () => {
    it('should parse "C3 + R 3 + M3 + M6"', () => {
      const result = parser.parse('C3 + R 3 + M3 + M6');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 3 },
          { tier: 'R', level: 3 },
          { tier: 'M', level: 3 },
          { tier: 'M', level: 6 },
        ]);
      }
    });

    it('should parse "R1 + R6"', () => {
      const result = parser.parse('R1 + R6');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'R', level: 1 },
          { tier: 'R', level: 6 },
        ]);
      }
    });

    it('should parse "C4 + R4 + M1 + M5"', () => {
      const result = parser.parse('C4 + R4 + M1 + M5');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 4 },
          { tier: 'R', level: 4 },
          { tier: 'M', level: 1 },
          { tier: 'M', level: 5 },
        ]);
      }
    });
  });

  describe('given special text-only treasure strings', () => {
    it('should treat "Ivory" as extras-only', () => {
      const result = parser.parse('Ivory');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toEqual({ codes: [], extras: ['Ivory'] });
      }
    });

    it('should treat "Magical honey" as extras-only', () => {
      const result = parser.parse('Magical honey');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toEqual({ codes: [], extras: ['Magical honey'] });
      }
    });

    it('should treat "Gold or crystals (see below)" as extras-only', () => {
      const result = parser.parse('Gold or crystals (see below)');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toEqual({
          codes: [],
          extras: ['Gold or crystals (see below)'],
        });
      }
    });

    it('should treat "Wealth of dwelling\'s" as extras-only', () => {
      const result = parser.parse("Wealth of dwelling's");
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data).toEqual({
          codes: [],
          extras: ["Wealth of dwelling's"],
        });
      }
    });
  });

  describe('given pure dice/special strings', () => {
    it('should treat "2d100sp + 1-in-4 chance of 1 gem" as extras-only', () => {
      const result = parser.parse('2d100sp + 1-in-4 chance of 1 gem');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([]);
        expect(result.data!.extras).toEqual([
          '2d100sp + 1-in-4 chance of 1 gem',
        ]);
      }
    });

    it('should treat "1d4 magical fruits in" as extras-only', () => {
      const result = parser.parse('1d4 magical fruits in');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([]);
        expect(result.data!.extras).toEqual(['1d4 magical fruits in']);
      }
    });
  });

  describe('given "R1 + M5" (no coins tier)', () => {
    it('should parse correctly', () => {
      const result = parser.parse('R1 + M5');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'R', level: 1 },
          { tier: 'M', level: 5 },
        ]);
        expect(result.data!.extras).toEqual([]);
      }
    });
  });

  describe('given "C2 + R1" (no magic tier)', () => {
    it('should parse correctly', () => {
      const result = parser.parse('C2 + R1');
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data!.codes).toEqual([
          { tier: 'C', level: 2 },
          { tier: 'R', level: 1 },
        ]);
      }
    });
  });

  describe('edge cases', () => {
    it('should return failure for empty string', () => {
      const result = parser.parse('');
      expect(result.kind).toBe('failure');
    });

    it('should return failure for whitespace-only', () => {
      const result = parser.parse('   ');
      expect(result.kind).toBe('failure');
    });
  });
});
