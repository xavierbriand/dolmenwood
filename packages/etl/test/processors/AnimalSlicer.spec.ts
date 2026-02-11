import { describe, it, expect } from 'vitest';
import { AnimalSlicer } from '../../src/processors/AnimalSlicer.js';

describe('AnimalSlicer', () => {
  const slicer = new AnimalSlicer();

  describe('slice', () => {
    it('should extract text between Animals header and Monster Rumours', () => {
      const input = [
        'Some preamble text',
        'part three | appenDices',
        '112',
        'Animals',
        'Mundane animals and their giant cousins commonly encountered.',
        'Some creature descriptions here.',
        'FOREST SPRITE',
        'A magical creature.',
        'part three | appenDices',
        '120',
        'Monster Rumours',
        'Folklore and idle speculation.',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toContain('Animals');
      expect(result).toContain('Mundane animals');
      expect(result).toContain('FOREST SPRITE');
      expect(result).not.toContain('Monster Rumours');
      expect(result).not.toContain('Some preamble text');
    });

    it('should return empty string when Animals section is not found', () => {
      const input = [
        'Some random text',
        'No animals section here',
        'Monster Rumours',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toBe('');
    });

    it('should return text to EOF when Monster Rumours is not found', () => {
      const input = [
        'Animals',
        'Mundane animals and their giant cousins commonly encountered.',
        'FOREST SPRITE',
        'A magical creature.',
        'Last line of file',
      ].join('\n');

      const result = slicer.slice(input);

      expect(result).toContain('Animals');
      expect(result).toContain('FOREST SPRITE');
      expect(result).toContain('Last line of file');
    });

    it('should not match Animals in TOC or other contexts', () => {
      const input = [
        'Table of Contents',
        'Animals ..... 112',
        'Some other text',
        'Animals',
        'Mundane animals found in the wild.',
        'GOBLIN SCOUT',
        'A small creature.',
        'Monster Rumours',
      ].join('\n');

      const result = slicer.slice(input);

      // Should start from the "Animals\nMundane animals" pattern,
      // not the TOC line "Animals ..... 112"
      expect(result).toContain('GOBLIN SCOUT');
      expect(result).not.toContain('Table of Contents');
      expect(result).not.toContain('..... 112');
    });

    it('should trim whitespace from the result', () => {
      const input = [
        '',
        'Animals',
        'Mundane animals roam the woods.',
        'FOREST SPRITE',
        'A creature.',
        '',
        '',
        'Monster Rumours',
      ].join('\n');

      const result = slicer.slice(input);

      // Result should be trimmed
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });
});
