import { describe, it, expect } from 'vitest';
import { AnimalSplitter } from '../../src/processors/AnimalSplitter.js';

describe('AnimalSplitter', () => {
  const splitter = new AnimalSplitter();

  describe('split', () => {
    it('should split two creatures into separate blocks', () => {
      const input = [
        'FOREST SPRITE',
        'A small magical creature found in woodlands.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
        'GOBLIN SCOUT',
        'A wiry, green-skinned creature.',
        'sMall aniMal-seMi-intelligent-chaotic',
        'Level 2 AC 12 HP 2d8 (9) Saves D12 R13 H14 B15 S16',
        'Att Club (+1, 1d6) Speed 40 Morale 7 XP 20 Enc 3d4',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('FOREST SPRITE');
      expect(result[0].text).toContain('A small magical creature');
      expect(result[1].name).toBe('GOBLIN SCOUT');
      expect(result[1].text).toContain('A wiry, green-skinned creature');
    });

    it('should strip page breaks between creatures', () => {
      const input = [
        'FOREST SPRITE',
        'A small creature.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
        'part three | appenDices',
        '113',
        'GOBLIN SCOUT',
        'A wiry creature.',
        'sMall aniMal-seMi-intelligent-chaotic',
        'Level 2 AC 12 HP 2d8 (9) Saves D12 R13 H14 B15 S16',
        'Att Club (+1, 1d6) Speed 40 Morale 7 XP 20 Enc 3d4',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(2);
      expect(result[0].text).not.toContain('part three');
      expect(result[0].text).not.toContain('113');
      expect(result[1].name).toBe('GOBLIN SCOUT');
    });

    it('should handle creature names with commas', () => {
      const input = [
        'SPRITE, GIANT',
        'A large magical creature.',
        'MeDiuM aniMal-aniMal intelligence-neutral',
        'Level 3 AC 14 HP 3d8 (13) Saves D10 R11 H12 B13 S14',
        'Att Claw (+2, 1d6) Speed 40 Morale 8 XP 40 Enc 1d4',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('SPRITE, GIANT');
    });

    it('should handle creature names with hyphens', () => {
      const input = [
        'LIZARD-VIPER',
        'A venomous serpent.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 11 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 20 Morale 6 XP 10 Enc 1d6',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('LIZARD-VIPER');
    });

    it('should strip preamble text before first creature', () => {
      const input = [
        'Animals',
        'Mundane animals and their giant cousins commonly encountered in the Wood.',
        'Myriad animals of many different kinds-from the',
        'mundane to the gigantic to the magical-roam',
        'the forest. Those of extraordinary or magical',
        'nature are described in full in Part Two: Bestiary, p11.',
        'Mundane animals-including gigantic versions of normal',
        'animals-are described briefly here.',
        'FOREST SPRITE',
        'A small creature.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('FOREST SPRITE');
      expect(result[0].text).not.toContain('Mundane animals');
      expect(result[0].text).not.toContain('described briefly here');
    });

    it('should return empty array for empty input', () => {
      const result = splitter.split('');
      expect(result).toHaveLength(0);
    });

    it('should include full block text including the name line', () => {
      const input = [
        'FOREST SPRITE',
        'A small magical creature.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(1);
      // The block text should start with the creature name
      expect(result[0].text).toMatch(/^FOREST SPRITE/);
    });

    it('should handle creatures with special abilities after stats', () => {
      const input = [
        'FOREST SPRITE',
        'A magical creature with poison.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
        'Poison: Save Versus Doom or take 1d6 additional damage.',
        'GOBLIN SCOUT',
        'A wiry creature.',
        'sMall aniMal-seMi-intelligent-chaotic',
        'Level 2 AC 12 HP 2d8 (9) Saves D12 R13 H14 B15 S16',
        'Att Club (+1, 1d6) Speed 40 Morale 7 XP 20 Enc 3d4',
      ].join('\n');

      const result = splitter.split(input);

      expect(result).toHaveLength(2);
      expect(result[0].text).toContain('Poison: Save Versus Doom');
      expect(result[1].text).not.toContain('Poison');
    });
  });
});
