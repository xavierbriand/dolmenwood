import { describe, it, expect } from 'vitest';
import { MortalSplitter } from '../../src/processors/MortalSplitter.js';

describe('MortalSplitter', () => {
  const splitter = new MortalSplitter();

  describe('split', () => {
    it('should return empty array for empty input', () => {
      expect(splitter.split('')).toEqual([]);
    });

    it('should split section into individual creature blocks by ALL CAPS headers', () => {
      const input = [
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'Some intro preamble text described briefly here.',
        'TOWN GUARD',
        'Loyal soldiers stationed at the gates.',
        'Duties: Guard the settlement.',
        'STREET VENDOR',
        'Merchants selling wares at market stalls.',
        'Wares: Roll on the trade goods table.',
      ].join('\n');

      const blocks = splitter.split(input);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].name).toBe('TOWN GUARD');
      expect(blocks[0].text).toContain('Loyal soldiers');
      expect(blocks[1].name).toBe('STREET VENDOR');
      expect(blocks[1].text).toContain('Merchants selling');
    });

    it('should strip page breaks from the text', () => {
      const input = [
        'Everyday Mortals',
        'Non-adventuring folk described briefly here.',
        'TOWN GUARD',
        'A loyal soldier.',
        'part three | appenDices',
        '111',
        'STREET VENDOR',
        'A roving merchant.',
      ].join('\n');

      const blocks = splitter.split(input);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].text).not.toContain('part three');
      expect(blocks[1].name).toBe('STREET VENDOR');
    });

    it('should strip the preamble before creature headers', () => {
      const input = [
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'All use the stat block listed below.',
        'TOWN GUARD',
        'A guard.',
      ].join('\n');

      const blocks = splitter.split(input);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].name).toBe('TOWN GUARD');
    });

    it('should filter to only TOC creature names when tocNames is provided', () => {
      const input = [
        'Everyday Mortals',
        'Non-adventuring folk described briefly here.',
        'TOWN GUARD',
        'A guard with duties.',
        'GUARD DUTIES',
        'd6Duty',
        '1Patrol the walls.',
        'STREET VENDOR',
        'A roving merchant.',
        'VENDOR WARES',
        'd6Ware',
        '1Potions.',
      ].join('\n');

      // Only TOWN GUARD and STREET VENDOR are in the TOC
      const blocks = splitter.split(input, ['Town Guard', 'Street Vendor']);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].name).toBe('TOWN GUARD');
      expect(blocks[0].text).toContain('GUARD DUTIES');
      expect(blocks[1].name).toBe('STREET VENDOR');
    });

    it('should exclude the shared stat block section', () => {
      const input = [
        'Everyday Mortals',
        'Non-adventuring folk described briefly here.',
        'TOWN GUARD',
        'A guard.',
        'Everyday Mortal Basic Details (Optional)',
        'Some table data here.',
        'BASIC DETAILS',
        '#SexAge',
        '1FemaleChild',
        'Everyday Mortal',
        'sMall/MeDiuM Mortal-sentient-any alignMent',
        'Level 1 AC 10 HP 1d4 (2) Saves D12 R13 H14 B15 S16',
        'Att Weapon (-1) Speed 40 Morale 6 XP 10',
        'Weapons: Club (d4), dagger (d4), or staff (d4).',
        'STREET VENDOR',
        'A merchant.',
      ].join('\n');

      const blocks = splitter.split(input, ['Town Guard', 'Street Vendor']);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].name).toBe('TOWN GUARD');
      expect(blocks[1].name).toBe('STREET VENDOR');
      // The stat block section should not appear in any block
      expect(blocks[0].text).not.toContain('sMall/MeDiuM');
      expect(blocks[1].text).not.toContain('sMall/MeDiuM');
    });
  });
});
