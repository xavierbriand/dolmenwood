import { describe, it, expect } from 'vitest';
import { AdventurerSlicer } from '../../src/processors/AdventurerSlicer.js';

describe('AdventurerSlicer', () => {
  const slicer = new AdventurerSlicer();

  describe('slice', () => {
    it('should extract text between Adventurers header and Adventuring Parties header', () => {
      const input = [
        'Some preamble text',
        'Adventurers',
        "Ne'er-do-wells and righteous questers one might encounter.",
        'WARRIOR',
        'A brave soul who fights with honor.',
        'Adventuring Parties',
        'Parties of adventurers who may be encountered.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toContain('Adventurers');
      expect(result).toContain('WARRIOR');
      expect(result).not.toContain('Adventuring Parties');
      expect(result).not.toContain('Some preamble text');
    });

    it('should return empty string when Adventurers section is not found', () => {
      const input = [
        'Some random text',
        'No adventurers section here',
        'Adventuring Parties',
        'Parties encountered in the wild.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toBe('');
    });

    it('should return text to EOF when Adventuring Parties section is not found', () => {
      const input = [
        'Adventurers',
        "Ne'er-do-wells and righteous questers one might encounter.",
        'WARRIOR',
        'A generic warrior.',
        'Last line of file',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toContain('Adventurers');
      expect(result).toContain('WARRIOR');
      expect(result).toContain('Last line of file');
    });

    it('should not match Adventurers in TOC entries', () => {
      const input = [
        'Table of Contents',
        'Adventurers 104',
        'Some other text',
        'Adventurers',
        "Ne'er-do-wells and righteous questers one might encounter.",
        'WARRIOR',
        'A sturdy defender.',
        'Adventuring Parties',
        'Parties encountered in the wild.',
      ].join('\n');

      const result = slicer.slice(input);

      // Should match the actual header followed by the prose line,
      // not the TOC entry "Adventurers 104"
      expect(result).toContain('WARRIOR');
      expect(result).not.toContain('Table of Contents');
    });

    it('should trim whitespace from the result', () => {
      const input = [
        '',
        'Adventurers',
        "Ne'er-do-wells and righteous questers one might encounter.",
        'WARRIOR',
        'A creature.',
        '',
        '',
        'Adventuring Parties',
        'Parties encountered in the wild.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });
});
