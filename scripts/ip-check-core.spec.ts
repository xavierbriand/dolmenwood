
import { describe, it, expect } from 'vitest';
import { generateRegexForTerm } from './ip-check-core.js';

describe('IP Compliance Core', () => {
  describe('generateRegexForTerm', () => {
    it('should generate exact match regex for single words', () => {
      const regex = generateRegexForTerm('Goblin');
      // Case sensitive for single words
      expect(regex.test('Goblin')).toBe(true);
      expect(regex.test('goblin')).toBe(false); 
      expect(regex.test('SuperGoblin')).toBe(true); // Current logic allows substrings
    });

    it('should generate flexible regex for multi-word terms', () => {
      const regex = generateRegexForTerm('Elf-Wanderer');
      
      // Should match various separators
      expect(regex.test('Elf-Wanderer')).toBe(true);
      expect(regex.test('Elf Wanderer')).toBe(true);
      expect(regex.test('Elf_Wanderer')).toBe(true);
      expect(regex.test('Elf  Wanderer')).toBe(true); // Multiple spaces

      // Should be case insensitive for multi-word
      expect(regex.test('elf wanderer')).toBe(true);
      expect(regex.test('ELF WANDERER')).toBe(true);
    });

    it('should escape special characters in terms', () => {
      const regex = generateRegexForTerm('Mage (Level 1)');
      expect(regex.test('Mage (Level 1)')).toBe(true);
      expect(regex.test('Mage (Level 2)')).toBe(false);
    });
  });
});
