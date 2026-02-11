import { describe, it, expect } from 'vitest';
import { CompactStatParser } from '../../src/processors/CompactStatParser.js';
import { CreatureSchema } from '@dolmenwood/core';

describe('CompactStatParser', () => {
  const parser = new CompactStatParser();

  describe('normalizeName', () => {
    it('should convert ALL CAPS to Title Case', () => {
      expect(parser.normalizeName('FOREST SPRITE')).toBe('Forest Sprite');
    });

    it('should handle names with commas', () => {
      expect(parser.normalizeName('SPRITE, GIANT')).toBe('Sprite, Giant');
    });

    it('should handle names with hyphens', () => {
      expect(parser.normalizeName('LIZARD-ADDER')).toBe('Lizard-Adder');
    });

    it('should handle single word names', () => {
      expect(parser.normalizeName('BEAST')).toBe('Beast');
    });

    it('should handle multi-word names with spaces', () => {
      expect(parser.normalizeName('FOREST TREE SPRITE')).toBe(
        'Forest Tree Sprite',
      );
    });
  });

  describe('parse', () => {
    it('should parse a simple creature block', () => {
      const block = [
        'FOREST SPRITE',
        'A small magical creature found in woodlands.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
      ].join('\n');

      const result = parser.parse('FOREST SPRITE', block);

      expect(result.name).toBe('Forest Sprite');
      expect(result.level).toBe(1);
      expect(result.armourClass).toBe(10);
      expect(result.hitDice).toBe('1d8');
      expect(result.save).toBe('D12 R13 H14 B15 S16');
      expect(result.attacks).toEqual(['Bite (+0, 1d4)']);
      expect(result.movement).toBe(30);
      expect(result.morale).toBe(6);
      expect(result.xp).toBe(10);
      expect(result.numberAppearing).toBe('2d6');
      expect(result.alignment).toBe('Neutral');
      expect(result.type).toBe('Animal');
      expect(result.kindred).toBe('Animal');
      expect(result.description).toContain(
        'A small magical creature found in woodlands.',
      );
    });

    it('should parse a creature with multiple attacks using "and"', () => {
      const block = [
        'WILD BRUTE',
        'A large brute in the forest.',
        'MeDiuM aniMal-aniMal intelligence-neutral',
        'Level 4 AC 13 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Att 2 claws (+3, 1d3) and bite (+3, 1d6) Speed 40',
        'Morale 7 XP 130 Enc 1d4',
      ].join('\n');

      const result = parser.parse('WILD BRUTE', block);

      expect(result.attacks).toEqual(['2 claws (+3, 1d3)', 'bite (+3, 1d6)']);
      expect(result.movement).toBe(40);
      expect(result.morale).toBe(7);
      expect(result.xp).toBe(130);
    });

    it('should parse a creature with "or" attacks', () => {
      const block = [
        'SWAMP TOAD',
        'A warty toad that spits.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 11 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        "Att Bite (+0, 1d4) or spray (+0, stench, range 10')",
        'Speed 30 Morale 7 XP 15 Enc 3d6',
      ].join('\n');

      const result = parser.parse('SWAMP TOAD', block);

      expect(result.attacks).toEqual([
        'Bite (+0, 1d4)',
        "spray (+0, stench, range 10')",
      ]);
    });

    it('should parse Fly movement', () => {
      const block = [
        'NIGHT BAT',
        'A black-furred bat with a wide wingspan.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 2 AC 13 HP 2d8 (9) Saves D12 R13 H14 B15 S16',
        'Att Bite (+1, 1d4) Speed 10 Fly 60 Morale 8 XP 20 Enc 1d10',
      ].join('\n');

      const result = parser.parse('NIGHT BAT', block);

      expect(result.movement).toBe('10 Fly 60');
    });

    it('should parse Swim movement without Speed', () => {
      const block = [
        'RIVER FISH',
        'A giant fish that lurks in rivers.',
        'large aniMal-aniMal intelligence-neutral',
        'Level 8 AC 15 HP 8d8 (36) Saves D8 R9 H10 B11 S12',
        'Att Bite (+7, 2d8) and 4 barbels (+7, 1d4) Swim 30',
        'Morale 8 XP 1,040 Enc 1d2',
      ].join('\n');

      const result = parser.parse('RIVER FISH', block);

      expect(result.movement).toBe('Swim 30');
      expect(result.xp).toBe(1040);
    });

    it('should parse Burrow movement', () => {
      const block = [
        'TUNNEL WORM',
        'A gigantic worm that burrows underground.',
        'large Bug-aniMal intelligence-neutral',
        'Level 7 AC 13 HP 7d8 (31) Saves D8 R9 H10 B11 S12',
        'Att Bite (+6, 1d4) Speed 20 Burrow 20',
        'Morale 8 XP 780 Enc 1d3',
      ].join('\n');

      const result = parser.parse('TUNNEL WORM', block);

      expect(result.movement).toBe('20 Burrow 20');
    });

    it('should parse Webs movement', () => {
      const block = [
        'WEB SPIDER',
        'A large spider that spins webs.',
        'MeDiuM Bug-seMi-intelligent-chaotic',
        'Level 3 AC 13 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        "Att Bite (+2, 1d6) or web (+2, entangle, range 20')",
        'Speed 20 Webs 40 Morale 8 XP 90 Enc 1d3',
      ].join('\n');

      const result = parser.parse('WEB SPIDER', block);

      expect(result.movement).toBe('20 Webs 40');
    });

    it('should parse Hoard field', () => {
      const block = [
        'CRYSTAL SPRITE',
        'A creature that hoards gold.',
        'MeDiuM Bug-aniMal intelligence-neutral',
        'Level 4 AC 16 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Att Bite (+3, 2d6) Speed 60 Morale 7 XP 80 Enc 3d4 Hoard Gold or crystals',
      ].join('\n');

      const result = parser.parse('CRYSTAL SPRITE', block);

      expect(result.treasure).toBe('Gold or crystals');
    });

    it('should return undefined treasure when Hoard is absent', () => {
      const block = [
        'WILD HOG',
        'A wild boar.',
        'MeDiuM aniMal-aniMal intelligence-neutral',
        'Level 3 AC 12 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        'Att Tusk (+2, 2d4) Speed 50 Morale 9 XP 40 Enc 1d6',
      ].join('\n');

      const result = parser.parse('WILD HOG', block);

      expect(result.treasure).toBeUndefined();
    });

    it('should parse XP with comma (thousands separator)', () => {
      const block = [
        'RIVER FISH',
        'A giant fish.',
        'large aniMal-aniMal intelligence-neutral',
        'Level 8 AC 15 HP 8d8 (36) Saves D8 R9 H10 B11 S12',
        'Att Bite (+7, 2d8) Swim 30 Morale 8 XP 1,040 Enc 1d2',
      ].join('\n');

      const result = parser.parse('RIVER FISH', block);

      expect(result.xp).toBe(1040);
    });

    it('should extract only the first number from Morale (ignore parenthetical)', () => {
      const block = [
        'CRYSTAL SPRITE',
        'A creature with conditional morale.',
        'MeDiuM Bug-aniMal intelligence-neutral',
        'Level 4 AC 16 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Att Bite (+3, 2d6) Speed 60 Morale 7 (12 in melee) XP 80 Enc 3d4',
      ].join('\n');

      const result = parser.parse('CRYSTAL SPRITE', block);

      expect(result.morale).toBe(7);
    });

    it('should handle wrapped stat lines via blob pre-join', () => {
      const block = [
        'FUZZY MOOSE',
        'A gentle, fluffy creature.',
        'large aniMal-aniMal intelligence-neutral',
        'Level 4 AC 11 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Att 2 hooves (+3, 1d6) Speed 40 Morale 6 XP 80 Enc',
        '3d8',
      ].join('\n');

      const result = parser.parse('FUZZY MOOSE', block);

      expect(result.numberAppearing).toBe('3d8');
      expect(result.xp).toBe(80);
    });

    it('should parse Possessions as treasure', () => {
      const block = [
        'TUSKED BEAST',
        'A large creature with valuable tusks.',
        'large aniMal-aniMal intelligence-neutral',
        'Level 12 AC 16 HP 12d8 (54) Saves D5 R6 H7 B8 S9',
        'Att 2 tusks (+9, 2d6) or trample (+9, 4d8) Speed 40',
        'Morale 8 XP 2,100 Enc 2d8 Possessions Ivory',
      ].join('\n');

      const result = parser.parse('TUSKED BEAST', block);

      expect(result.treasure).toBe('Ivory');
      expect(result.xp).toBe(2100);
    });

    it('should parse special abilities into description', () => {
      const block = [
        'FOREST SPRITE',
        'A small creature with venom.',
        'sMall Bug-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d4 (2) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1 + poison) Speed 20 Morale 7 XP 15 Enc 1d8',
        'Poison: Save Versus Doom or become sick for 10 days.',
      ].join('\n');

      const result = parser.parse('FOREST SPRITE', block);

      expect(result.description).toContain('A small creature with venom.');
      expect(result.description).toContain(
        'Poison: Save Versus Doom or become sick for 10 days.',
      );
    });

    it('should parse meta line with semi-intelligent chaotic alignment', () => {
      const block = [
        'DARK SPIDER',
        'A cunning spider.',
        'MeDiuM Bug-seMi-intelligent-chaotic',
        'Level 3 AC 13 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        'Att Bite (+2, 1d6) Speed 20 Morale 8 XP 40 Enc 1d3',
      ].join('\n');

      const result = parser.parse('DARK SPIDER', block);

      expect(result.alignment).toBe('Chaotic');
      expect(result.kindred).toBe('Bug');
    });

    it('should parse meta line with lawful alignment', () => {
      const block = [
        'GENTLE CREATURE',
        'A kind, translucent creature.',
        'sMall aniMal-seMi-intelligent-lawful',
        'Level 1 AC 10 HP 1d4 (2) Saves D12 R13 H14 B15 S16',
        'Att Punch (+0, 1d2) Speed 30 Morale 6 XP 10 Enc 3d6',
      ].join('\n');

      const result = parser.parse('GENTLE CREATURE', block);

      expect(result.alignment).toBe('Lawful');
    });

    it('should produce output that validates against CreatureSchema', () => {
      const block = [
        'FOREST SPRITE',
        'A small magical creature found in woodlands.',
        'sMall aniMal-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1d4) Speed 30 Morale 6 XP 10 Enc 2d6',
      ].join('\n');

      const result = parser.parse('FOREST SPRITE', block);
      const validation = CreatureSchema.safeParse(result);

      expect(validation.success).toBe(true);
    });

    it('should handle creature with many special abilities', () => {
      const block = [
        'BUG SWARM',
        'A seething swarm of tiny bugs.',
        'MeDiuM Bug-aniMal intelligence-neutral',
        'Level 3 AC 12 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        'Att Swarm (+2, 2 or 4) Speed 10 Fly 20 Morale 11 XP 90 Enc 1d3',
        'Immunities: Only harmed by fire or magical cold.',
        'Smoke: Drives off a swarm.',
        'Swarm attack: Automatically damages characters.',
      ].join('\n');

      const result = parser.parse('BUG SWARM', block);

      expect(result.attacks).toEqual(['Swarm (+2, 2 or 4)']);
      expect(result.movement).toBe('10 Fly 20');
      expect(result.description).toContain('Immunities: Only harmed');
      expect(result.description).toContain('Smoke: Drives off');
      expect(result.description).toContain('Swarm attack:');
    });

    it('should handle HP as 1d4 dice format', () => {
      const block = [
        'TINY BUG',
        'A tiny creature.',
        'sMall Bug-aniMal intelligence-neutral',
        'Level 1 AC 10 HP 1d4 (2) Saves D12 R13 H14 B15 S16',
        'Att Bite (+0, 1) Speed 20 Morale 7 XP 15 Enc 1d8',
      ].join('\n');

      const result = parser.parse('TINY BUG', block);

      expect(result.hitDice).toBe('1d4');
    });

    it('should handle large size meta line', () => {
      const block = [
        'BIG CREATURE',
        'A very large creature.',
        'large aniMal-aniMal intelligence-neutral',
        'Level 8 AC 15 HP 8d8 (36) Saves D8 R9 H10 B11 S12',
        'Att Bite (+7, 2d8) Speed 40 Morale 8 XP 800 Enc 1d4',
      ].join('\n');

      const result = parser.parse('BIG CREATURE', block);

      expect(result.level).toBe(8);
      expect(result.armourClass).toBe(15);
    });
  });
});
