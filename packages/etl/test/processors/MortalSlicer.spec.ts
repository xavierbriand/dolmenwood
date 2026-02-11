import { describe, it, expect } from 'vitest';
import { MortalSlicer } from '../../src/processors/MortalSlicer.js';

describe('MortalSlicer', () => {
  const slicer = new MortalSlicer();

  describe('slice', () => {
    it('should extract text between Everyday Mortals header and Animals header', () => {
      const input = [
        'Some preamble text',
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'TOWN GUARD',
        'Loyal soldiers stationed at the gates.',
        'Animals',
        'Mundane animals and their giant cousins.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toContain('Everyday Mortals');
      expect(result).toContain('TOWN GUARD');
      expect(result).not.toContain('Animals');
      expect(result).not.toContain('Some preamble text');
    });

    it('should return empty string when Everyday Mortals section is not found', () => {
      const input = [
        'Some random text',
        'No mortals section here',
        'Animals',
        'Mundane animals roam.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toBe('');
    });

    it('should return text to EOF when Animals section is not found', () => {
      const input = [
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'TOWN GUARD',
        'A generic guard.',
        'Last line of file',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toContain('Everyday Mortals');
      expect(result).toContain('TOWN GUARD');
      expect(result).toContain('Last line of file');
    });

    it('should not match Everyday Mortals in TOC entries', () => {
      const input = [
        'Table of Contents',
        'Everyday Mortals 110',
        'Some other text',
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'TOWN GUARD',
        'A sturdy defender.',
        'Animals',
        'Mundane animals roam.',
      ].join('\n');

      const result = slicer.slice(input);

      // Should match the actual header followed by the prose line,
      // not the TOC entry "Everyday Mortals 110"
      expect(result).toContain('TOWN GUARD');
      expect(result).not.toContain('Table of Contents');
    });

    it('should trim whitespace from the result', () => {
      const input = [
        '',
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'TOWN GUARD',
        'A creature.',
        '',
        '',
        'Animals',
        'Mundane animals roam.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });
});
