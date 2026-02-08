import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dice } from './Dice.js';
import { RandomProvider } from '../ports/RandomProvider.js';

describe('Dice', () => {
  let mockRandom: RandomProvider;

  beforeEach(() => {
    // Mock RandomProvider that returns a predictable value
    // Let's say we want to control the "roll".
    // A simple mock that allows setting the next value
    const nextVal = 0.5; // Default middle
    mockRandom = {
      next: vi.fn().mockReturnValue(nextVal),
    };
  });

  describe('parse', () => {
    it('should parse "1d6"', () => {
      const dice = Dice.parse('1d6');
      expect(dice.count).toBe(1);
      expect(dice.sides).toBe(6);
      expect(dice.modifier).toBe(0);
    });

    it('should parse "2d4+1"', () => {
      const dice = Dice.parse('2d4+1');
      expect(dice.count).toBe(2);
      expect(dice.sides).toBe(4);
      expect(dice.modifier).toBe(1);
    });

    it('should parse "d8" as "1d8"', () => {
      const dice = Dice.parse('d8');
      expect(dice.count).toBe(1);
      expect(dice.sides).toBe(8);
      expect(dice.modifier).toBe(0);
    });

    it('should parse "3d6-2"', () => {
      const dice = Dice.parse('3d6-2');
      expect(dice.count).toBe(3);
      expect(dice.sides).toBe(6);
      expect(dice.modifier).toBe(-2);
    });
    
    it('should parse "1d100"', () => {
       const dice = Dice.parse('1d100');
       expect(dice.sides).toBe(100);
    });

    it('should throw error for invalid strings', () => {
      expect(() => Dice.parse('invalid')).toThrow();
      expect(() => Dice.parse('1d')).toThrow();
      expect(() => Dice.parse('d')).toThrow();
    });
  });

  describe('roll', () => {
    it('should roll 1d6 with mock value', () => {
      // 0.999 * 6 = 5.994 -> floor -> 5 -> +1 = 6
      mockRandom.next = vi.fn().mockReturnValue(0.999); 
      const dice = Dice.parse('1d6');
      const result = dice.roll(mockRandom);
      expect(result).toBe(6);
    });

    it('should roll 1d6 with low value', () => {
      // 0.0 * 6 = 0 -> floor -> 0 -> +1 = 1
      mockRandom.next = vi.fn().mockReturnValue(0.0);
      const dice = Dice.parse('1d6');
      const result = dice.roll(mockRandom);
      expect(result).toBe(1);
    });

    it('should apply modifiers', () => {
      // 0.5 * 4 = 2 -> +1 = 3. Roll is 3. Mod is +1. Result 4.
      mockRandom.next = vi.fn().mockReturnValue(0.5); 
      const dice = Dice.parse('1d4+1');
      const result = dice.roll(mockRandom);
      expect(result).toBe(3 + 1);
    });
    
    it('should handle multiple dice', () => {
        // Mock returns sequence
        mockRandom.next = vi.fn()
            .mockReturnValueOnce(0.0) // 1st die: 1
            .mockReturnValueOnce(0.99); // 2nd die: 6
        
        const dice = Dice.parse('2d6');
        const result = dice.roll(mockRandom);
        expect(result).toBe(1 + 6);
    });
  });
});
