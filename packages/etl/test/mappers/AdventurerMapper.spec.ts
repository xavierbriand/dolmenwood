import { describe, it, expect } from 'vitest';
import { AdventurerMapper } from '../../src/mappers/AdventurerMapper.js';
import type { Creature } from '@dolmenwood/core';

describe('AdventurerMapper', () => {
  const mapper = new AdventurerMapper();

  const sampleInput = {
    name: 'Bard',
    variants: [
      {
        label: 'Level 1 Bard (Rhymer)',
        meta: 'Size/Type By Kindred—Sentient—Any Alignment',
        stats: {
          level: '1',
          ac: '12',
          hp: '1d6 (3)',
          saves: 'D13 R14 H13 B15 S15',
          attacks: 'Weapon (+0)',
          speed: '30',
          morale: '7',
          xp: '15',
          encounters: '1d6',
        },
        abilities: [
          { name: 'Gear', text: 'Leather armour. Shortsword (1d6).' },
          { name: 'Magic', text: 'Counter charm (1/day).' },
          { name: 'Skills', text: 'Legerdemain 6, Listen 5.' },
        ],
      },
      {
        label: 'Level 3 Bard (Troubadour)',
        meta: 'Size/Type By Kindred—Sentient—Any Alignment',
        stats: {
          level: '3',
          ac: '14',
          hp: '3d6 (10)',
          saves: 'D12 R13 H12 B14 S14',
          attacks: 'Weapon (+1)',
          speed: '20',
          morale: '8',
          xp: '65',
          encounters: '1d3',
        },
        abilities: [
          {
            name: 'Gear',
            text: 'Chainmail. Shortsword (1d6). Silver dagger (1d4).',
          },
          { name: 'Magic', text: 'Counter charm (3/day).' },
          { name: 'Skills', text: 'Legerdemain 6, Listen 5.' },
          { name: 'Companions', text: '1d4 rhymers.' },
        ],
      },
      {
        label: 'Level 5 Bard (Lore-Master)',
        meta: 'Size/Type By Kindred—Sentient—Any Alignment',
        stats: {
          level: '5',
          ac: '15',
          hp: '5d6 (17)',
          saves: 'D11 R12 H11 B13 S13',
          attacks: 'Weapon (+2)',
          speed: '20',
          morale: '9',
          xp: '360',
          encounters: '1',
        },
        abilities: [
          {
            name: 'Gear',
            text: 'Chainmail + shield. Arcane Shortsword (1d6+2).',
          },
          { name: 'Magic', text: 'Counter charm (5/day).' },
          { name: 'Skills', text: 'Legerdemain 5, Listen 4.' },
          { name: 'Companions', text: '1d4 troubadours.' },
        ],
      },
    ],
  };

  describe('given a standard adventurer with 3 variants', () => {
    let result: Creature;

    it('should map without throwing', () => {
      result = mapper.map(sampleInput);
      expect(result).toBeDefined();
    });

    it('should use the class name', () => {
      result = mapper.map(sampleInput);
      expect(result.name).toBe('Bard');
    });

    it('should use Level 1 variant stats as base creature', () => {
      result = mapper.map(sampleInput);
      expect(result.level).toBe(1);
      expect(result.armourClass).toBe(12);
      expect(result.hitDice).toBe('1d6');
      expect(result.morale).toBe(7);
      expect(result.xp).toBe(15);
    });

    it('should map numberAppearing from Level 1 encounters', () => {
      result = mapper.map(sampleInput);
      expect(result.numberAppearing).toBe('1d6');
    });

    it('should set type to Adventurer', () => {
      result = mapper.map(sampleInput);
      expect(result.type).toBe('Adventurer');
    });

    it('should set kindred to Mortal', () => {
      result = mapper.map(sampleInput);
      expect(result.kindred).toBe('Mortal');
    });

    it('should parse alignment from variant meta', () => {
      result = mapper.map(sampleInput);
      expect(result.alignment).toBe('Any');
    });

    it('should build L1 description from Level 1 variant abilities', () => {
      result = mapper.map(sampleInput);
      expect(result.description).toBe(
        'Gear: Leather armour. Shortsword (1d6). Magic: Counter charm (1/day). Skills: Legerdemain 6, Listen 5.',
      );
    });

    it('should produce 2 variants (Level 3 and Level 5)', () => {
      result = mapper.map(sampleInput);
      expect(result.variants).toHaveLength(2);
    });

    it('should map Level 3 variant stats', () => {
      result = mapper.map(sampleInput);
      const v3 = result.variants![0];
      expect(v3.label).toBe('Level 3 Bard (Troubadour)');
      expect(v3.level).toBe(3);
      expect(v3.armourClass).toBe(14);
      expect(v3.hitDice).toBe('3d6');
      expect(v3.morale).toBe(8);
      expect(v3.xp).toBe(65);
      expect(v3.numberAppearing).toBe('1d3');
    });

    it('should map Level 5 variant stats', () => {
      result = mapper.map(sampleInput);
      const v5 = result.variants![1];
      expect(v5.label).toBe('Level 5 Bard (Lore-Master)');
      expect(v5.level).toBe(5);
      expect(v5.armourClass).toBe(15);
      expect(v5.xp).toBe(360);
      expect(v5.numberAppearing).toBe('1');
    });

    it('should build Level 3 variant description from its abilities', () => {
      result = mapper.map(sampleInput);
      const v3 = result.variants![0];
      expect(v3.description).toBe(
        'Gear: Chainmail. Shortsword (1d6). Silver dagger (1d4). Magic: Counter charm (3/day). Skills: Legerdemain 6, Listen 5. Companions: 1d4 rhymers.',
      );
    });

    it('should build Level 5 variant description from its abilities', () => {
      result = mapper.map(sampleInput);
      const v5 = result.variants![1];
      expect(v5.description).toBe(
        'Gear: Chainmail + shield. Arcane Shortsword (1d6+2). Magic: Counter charm (5/day). Skills: Legerdemain 5, Listen 4. Companions: 1d4 troubadours.',
      );
    });

    it('should include save on variants', () => {
      result = mapper.map(sampleInput);
      expect(result.save).toBe('D13 R14 H13 B15 S15');
      expect(result.variants![0].save).toBe('D12 R13 H12 B14 S14');
      expect(result.variants![1].save).toBe('D11 R12 H11 B13 S13');
    });
  });

  describe('given an adventurer with specific alignment', () => {
    it('should parse alignment like "Lawful or Neutral"', () => {
      const input = {
        ...sampleInput,
        variants: sampleInput.variants.map((v) => ({
          ...v,
          meta: 'Size/Type By Kindred—Sentient—Lawful or Neutral',
        })),
      };
      const result = mapper.map(input);
      expect(result.alignment).toBe('Lawful or Neutral');
    });
  });

  describe('mapAll', () => {
    it('should map an array of raw adventurers', () => {
      const results = mapper.mapAll([sampleInput]);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bard');
      expect(results[0].type).toBe('Adventurer');
    });
  });
});
