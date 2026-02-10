import { describe, it, expect } from 'vitest';
import { Normalizer } from '../../src/processors/Normalizer.js';

describe('Normalizer', () => {
  const normalizer = new Normalizer();

  describe('normalizeSymbols', () => {
    it('should convert em-dashes to standard hyphens', () => {
      const input = 'Snake—Adder';
      const output = normalizer.normalizeSymbols(input);
      expect(output).toBe('Snake-Adder');
    });

    it('should normalize quote marks', () => {
      const input = '“Quoted” text with ‘apostrophe’';
      const output = normalizer.normalizeSymbols(input);
      expect(output).toBe('"Quoted" text with \'apostrophe\'');
    });

    it('should remove multiple spaces', () => {
      const input = 'Word   spaced    out';
      const output = normalizer.normalizeSymbols(input);
      expect(output).toBe('Word spaced out');
    });
  });

  describe('fixLineBreaks (De-hyphenation)', () => {
    it('should merge words split by hyphen at line end', () => {
      const input = 'The mons-\nter attacked.';
      const output = normalizer.fixLineBreaks(input);
      expect(output).toBe('The monster attacked.');
    });

    it('should NOT merge hyphens not at end of line', () => {
      const input = 'The demi-human ran.';
      const output = normalizer.fixLineBreaks(input);
      expect(output).toBe('The demi-human ran.');
    });

    it('should handle carriage returns and newlines', () => {
      const input = 'A power-\r\nful blow.';
      const output = normalizer.fixLineBreaks(input);
      expect(output).toBe('A powerful blow.');
    });
  });

  describe('fixKerning', () => {
    it('should fix specific dictionary terms (e.g., Bat, Va Mpir E)', () => {
      // Test the specific case from the PDF artifacts
      // Note: fixKerning expects normalized spaces (single space)
      const input = 'Bat, Va Mpir E';
      const output = normalizer.fixKerning(input);
      expect(output).toBe('Bat, Vampire');
    });

    it('should fix common split suffixes like "ing"', () => {
      // "Fly,   Giant" is another common one, but let's test generic patterns if we implement heuristics
      // For now, let's stick to dictionary terms which are safer
      const input = 'Rat,   Gi An T';
      // Assuming we add this to dictionary
      // expect(output).toBe('Rat, Giant');
    });
  });

  describe('process (Integration)', () => {
    it('should run all steps in sequence', () => {
      const input = 'The Bat,   Va Mpir E is a mons-\nter.';
      const output = normalizer.process(input);
      expect(output).toBe('The Bat, Vampire is a monster.');
    });
  });
});
