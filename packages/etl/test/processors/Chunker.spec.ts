import { describe, it, expect } from 'vitest';
import { Chunker } from '../../src/processors/Chunker.js';

describe('Chunker', () => {
  const chunker = new Chunker();

  describe('extractBestiarySection', () => {
    it('should extract text between Part Two and Part Three', () => {
      const input = `
Table of Contents
...
Part One
Monsters of Dolmenwood
...
Part Two
Bestiary
Here is the bestiary content.
Part Three
Appendices
...
`;
      const output = chunker.extractBestiarySection(input);
      // The slice captures newlines, so we trim for test
      expect(output.trim()).toBe('Here is the bestiary content.');
    });

    it('should return full text if start marker is missing', () => {
      const input = 'Just some text without Part Two';
      const output = chunker.extractBestiarySection(input);
      expect(output).toBe(input);
    });

    it('should go to end if end marker is missing', () => {
      const input = `
Part Two
Bestiary
Content until the end.
`;
      const output = chunker.extractBestiarySection(input);
      expect(output.trim()).toBe('Content until the end.');
    });
  });

  describe('splitBestiaryPages', () => {
    it('should split by header', () => {
      const input = `
Page 1 content
part two | Bestiary
Page 2 content
part two | Bestiary
Page 3 content
`;
      const pages = chunker.splitBestiaryPages(input);
      expect(pages).toHaveLength(3);
      expect(pages[0]).toContain('Page 1 content');
      expect(pages[1]).toContain('Page 2 content');
      expect(pages[2]).toContain('Page 3 content');
    });
  });

  describe('TOC Parsing', () => {
    const mockTOC = `
Table of Contents
4 Monsters of DolMenwooD
Denizens of the Deep, Dank Woods 6
Monster Statistics 8
11 Bestiary
Creature One 12
Creature Two 13
102 appenDices
Adventurers 104
    `;

    const fullDocMock = `
${mockTOC}
Part One
Monsters of
`;

    it('should extract TOC section', () => {
      const toc = chunker.extractTOC(fullDocMock);
      expect(toc).toContain('11 Bestiary');
      expect(toc).toContain('Creature One 12');
      expect(toc).not.toContain('Part One');
    });

    it('should parse Bestiary list correctly', () => {
      const toc = chunker.extractTOC(fullDocMock);
      const creatures = chunker.parseBestiaryList(toc);

      expect(creatures.length).toBe(2);
      expect(creatures[0]).toEqual({ name: 'Creature One', page: 12 });
      expect(creatures[1]).toEqual({ name: 'Creature Two', page: 13 });
    });

    it('should stop parsing at next section', () => {
      const toc = `
11 Bestiary
Creature A 10
Creature B 20
102 Appendices
Creature C 30
`;
      const creatures = chunker.parseBestiaryList(toc);
      expect(creatures).toHaveLength(2);
      expect(creatures.map((c) => c.name)).toEqual([
        'Creature A',
        'Creature B',
      ]);
    });
  });

  describe('filterValidPages', () => {
    it('should keep pages starting with a number and newline', () => {
      const pages = ['12\nCreature Name...', '105\nAnother Creature...'];
      const filtered = chunker.filterValidPages(pages);
      expect(filtered).toHaveLength(2);
    });

    it('should remove pages starting with text', () => {
      const pages = ['Intro text here...', '12\nValid Page'];
      const filtered = chunker.filterValidPages(pages);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toContain('Valid Page');
    });

    it('should remove pages starting with number but no newline immediately', () => {
      const pages = [
        '12.5 Section Header', // Text on same line
        '12\nValid Page',
      ];
      const filtered = chunker.filterValidPages(pages);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toContain('Valid Page');
    });
  });
});
