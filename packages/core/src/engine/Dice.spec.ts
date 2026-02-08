import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiceRoll, Die } from './Dice.js';
import { RandomProvider } from '../ports/RandomProvider.js';

describe('Die', () => {
  let mockRandom: RandomProvider;

  beforeEach(() => {
    mockRandom = { next: vi.fn() };
  });

  it('should construct correctly', () => {
    const die = new Die(6);
    expect(die.sides).toBe(6);
  });

  it('should throw on invalid sides', () => {
    expect(() => new Die(0)).toThrow();
  });

  it('should roll within range', () => {
    const die = new Die(6);
    mockRandom.next = vi.fn().mockReturnValue(0.999);
    expect(die.roll(mockRandom)).toBe(6);

    mockRandom.next = vi.fn().mockReturnValue(0.0);
    expect(die.roll(mockRandom)).toBe(1);
  });
});

describe('DiceRoll', () => {
  let mockRandom: RandomProvider;

  beforeEach(() => {
    mockRandom = { next: vi.fn().mockReturnValue(0.5) };
  });

  describe('parse', () => {
    it('should parse "1d6"', () => {
      const dice = DiceRoll.parse('1d6');
      expect(dice.count).toBe(1);
      expect(dice.die.sides).toBe(6);
      expect(dice.modifier).toBe(0);
    });

    it('should parse "2d4+1"', () => {
      const dice = DiceRoll.parse('2d4+1');
      expect(dice.count).toBe(2);
      expect(dice.die.sides).toBe(4);
      expect(dice.modifier).toBe(1);
    });

    it('should parse "d8" as "1d8"', () => {
      const dice = DiceRoll.parse('d8');
      expect(dice.count).toBe(1);
      expect(dice.die.sides).toBe(8);
      expect(dice.modifier).toBe(0);
    });

    it('should parse "3d6-2"', () => {
      const dice = DiceRoll.parse('3d6-2');
      expect(dice.count).toBe(3);
      expect(dice.die.sides).toBe(6);
      expect(dice.modifier).toBe(-2);
    });
    
    it('should parse "1d100"', () => {
       const dice = DiceRoll.parse('1d100');
       expect(dice.die.sides).toBe(100);
    });

    it('should throw error for invalid strings', () => {
      expect(() => DiceRoll.parse('invalid')).toThrow();
      expect(() => DiceRoll.parse('1d')).toThrow();
      expect(() => DiceRoll.parse('d')).toThrow();
    });
  });

  describe('roll', () => {
    it('should roll 1d6 with mock value', () => {
      // 0.999 * 6 = 5.994 -> floor -> 5 -> +1 = 6
      mockRandom.next = vi.fn().mockReturnValue(0.999); 
      const dice = DiceRoll.parse('1d6');
      const result = dice.roll(mockRandom);
      expect(result).toBe(6);
    });

    it('should roll 1d6 with low value', () => {
      // 0.0 * 6 = 0 -> floor -> 0 -> +1 = 1
      mockRandom.next = vi.fn().mockReturnValue(0.0);
      const dice = DiceRoll.parse('1d6');
      const result = dice.roll(mockRandom);
      expect(result).toBe(1);
    });

    it('should apply modifiers', () => {
      // 0.5 * 4 = 2 -> +1 = 3. Roll is 3. Mod is +1. Result 4.
      mockRandom.next = vi.fn().mockReturnValue(0.5); 
      const dice = DiceRoll.parse('1d4+1');
      const result = dice.roll(mockRandom);
      expect(result).toBe(3 + 1);
    });
    
    it('should handle multiple dice', () => {
        // Mock returns sequence
        mockRandom.next = vi.fn()
            .mockReturnValueOnce(0.0) // 1st die: 1
            .mockReturnValueOnce(0.99); // 2nd die: 6
        
        const dice = DiceRoll.parse('2d6');
        const result = dice.roll(mockRandom);
        expect(result).toBe(1 + 6);
    });
  });
});
