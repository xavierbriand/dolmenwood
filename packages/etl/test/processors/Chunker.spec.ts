import { describe, it, expect } from 'vitest';
import { Chunker } from '../../src/processors/Chunker.js';

describe('Chunker', () => {
  const chunker = new Chunker();

  describe('splitByPage', () => {
    it('should split text by form feed character', () => {
      const input = 'Page 1 content\n\f\nPage 2 content';
      const pages = chunker.splitByPage(input);
      expect(pages).toHaveLength(2);
      expect(pages[0].trim()).toBe('Page 1 content');
      expect(pages[1].trim()).toBe('Page 2 content');
    });

    it('should handle text without form feeds as single page', () => {
      const input = 'Just one page';
      const pages = chunker.splitByPage(input);
      expect(pages).toHaveLength(1);
    });
  });

  describe('identifyCreatureBlocks', () => {
    it('should identify a standard creature block', () => {
      const pageText = `
Some intro text.

RAT, GIANT
AC 7, HD 1+1, Att 1 × bite (1d3 + disease), THAC0 18 [+1], MV 120’ (40’) /
60’ (20’) swim, SV D12 W13 P14 B15 S16 (1), ML 8, AL Neutral, XP 15, NA
2d6 (2d10), TT C
Disease: Save vs poison or die in 1d6 days.
      `.trim();

      const blocks = chunker.identifyCreatureBlocks(pageText, 1);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].name).toBe('RAT, GIANT');
      expect(blocks[0].page).toBe(1);
      // The block should contain the full text starting from the name
      expect(blocks[0].raw).toContain('RAT, GIANT');
      expect(blocks[0].raw).toContain('Disease: Save vs poison');
    });

    it('should ignore false positives (headers without AC)', () => {
      const pageText = `
BASIC DETAILS
This section describes the monster.

AC 7, HD 1 (Fake stat block alone)
      `.trim();

      const blocks = chunker.identifyCreatureBlocks(pageText, 1);
      expect(blocks).toHaveLength(0);
    });

    it('should handle multiple creatures on one page', () => {
      const pageText = `
BAT, VAMPIRE
AC 6, HD 2
Details...

DOG, WILD
AC 7, HD 1+1
Details...
      `.trim();

      const blocks = chunker.identifyCreatureBlocks(pageText, 1);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].name).toBe('BAT, VAMPIRE');
      expect(blocks[1].name).toBe('DOG, WILD');
    });

    it('should include the content up to the next creature or end of page', () => {
      const pageText = `
FIRST BEAST
AC 9
Description one.

SECOND BEAST
AC 8
Description two.
      `.trim();

      const blocks = chunker.identifyCreatureBlocks(pageText, 1);

      expect(blocks[0].raw).toContain('FIRST BEAST');
      expect(blocks[0].raw).toContain('Description one.');
      expect(blocks[0].raw).not.toContain('SECOND BEAST');

      expect(blocks[1].raw).toContain('SECOND BEAST');
      expect(blocks[1].raw).toContain('Description two.');
    });
  });
});
