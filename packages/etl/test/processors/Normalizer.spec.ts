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

  describe('fixDropCaps', () => {
    it('should merge single letter lines with following line (Lettrine artifact)', () => {
      const input = 'M\nonster book';
      const output = normalizer.fixDropCaps(input);
      expect(output).toBe('Monster book');
    });

    it('should handle multiple drop caps in text', () => {
      const input = 'T\nhis is a test.\nT\nhe end.';
      const output = normalizer.fixDropCaps(input);
      expect(output).toBe('This is a test.\nThe end.');
    });

    it('should NOT merge if first line is not a single letter', () => {
      const input = 'My\nbook';
      const output = normalizer.fixDropCaps(input);
      expect(output).toBe('My\nbook');
    });

    it('should NOT merge if second line is empty', () => {
      const input = 'A\n\nB';
      const output = normalizer.fixDropCaps(input);
      expect(output).toBe('A\n\nB');
    });
  });

  describe('fixKerning', () => {
    it('should fix specific dictionary terms (e.g., Bat, Va Mpir E)', () => {
      // Test the specific case from the PDF artifacts
      // Note: fixKerning expects normalized spaces (single space)
      const input = 'BAT, VA MPIR E';
      const output = normalizer.fixKerning(input);
      expect(output).toBe('BAT, VAMPIRE');
    });

    it('should fix GEL ATINOUS APE kerning artifact', () => {
      const input = 'GEL ATINOUS APE';
      const output = normalizer.fixKerning(input);
      expect(output).toBe('GELATINOUS APE');
    });

    it('should fix hu ng r y kerning artifact', () => {
      const input = 'when extremely hu ng r y.';
      const output = normalizer.fixKerning(input);
      expect(output).toBe('when extremely hungry.');
    });
  });

  describe('process (Integration)', () => {
    it('should run all steps in sequence', () => {
      const input = 'The BAT,   VA MPIR E is a mons-\nter.';
      const output = normalizer.process(input);
      expect(output).toBe('The BAT, VAMPIRE is a monster.');
    });
  });
});
