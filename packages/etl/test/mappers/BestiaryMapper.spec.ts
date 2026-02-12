import { describe, it, expect } from 'vitest';
import { BestiaryMapper } from '../../src/mappers/BestiaryMapper.js';
import type { Creature } from '@dolmenwood/core';

describe('BestiaryMapper', () => {
  const mapper = new BestiaryMapper();

  const sampleInput = {
    name: 'Shadow Wraith',
    description: 'A spectral horror that haunts dark places.',
    meta: 'Medium Undead—Semi-Intelligent—Chaotic',
    stats: {
      level: '4',
      ac: '14',
      hp: '4d8 (18)',
      saves: 'D10 R11 H12 B13 S14',
      attacks: 'Clawed grasp (+3, 1d10 + life drain)',
      speed: '40',
      morale: '9',
      xp: '180',
      encounters: '2d4 (75% in lair)',
    },
    behaviour: 'Ruthless, hateful',
    speech: 'None. Understand Common',
    possessions: 'None',
    hoard: 'C4 + R4 + M1',
    abilities: [
      { name: 'Dark sight', text: 'Can see normally without light.' },
      { name: 'Life drain', text: 'Drains 1d3 Constitution on touch.' },
    ],
    sections: {
      TRAITS: [
        { roll: '1', text: 'Wields a scythe.' },
        { roll: '2', text: 'Skull wreathed in blue flame.' },
      ],
      ENCOUNTERS: [{ roll: '1', text: 'Dragging a victim through the mist.' }],
    },
    names: 'Aldric, Belthan, Caradoc',
  };

  describe('given a standard bestiary creature', () => {
    let result: Creature;

    it('should map without throwing', () => {
      result = mapper.map(sampleInput);
      expect(result).toBeDefined();
    });

    it('should map name', () => {
      result = mapper.map(sampleInput);
      expect(result.name).toBe('Shadow Wraith');
    });

    it('should map level as number', () => {
      result = mapper.map(sampleInput);
      expect(result.level).toBe(4);
    });

    it('should map armourClass', () => {
      result = mapper.map(sampleInput);
      expect(result.armourClass).toBe(14);
    });

    it('should strip HP average from hitDice', () => {
      result = mapper.map(sampleInput);
      expect(result.hitDice).toBe('4d8');
    });

    it('should map save', () => {
      result = mapper.map(sampleInput);
      expect(result.save).toBe('D10 R11 H12 B13 S14');
    });

    it('should map attacks as array', () => {
      result = mapper.map(sampleInput);
      expect(result.attacks).toEqual(['Clawed grasp (+3, 1d10 + life drain)']);
    });

    it('should map movement as number when speed-only', () => {
      result = mapper.map(sampleInput);
      expect(result.movement).toBe(40);
    });

    it('should map morale', () => {
      result = mapper.map(sampleInput);
      expect(result.morale).toBe(9);
    });

    it('should map xp', () => {
      result = mapper.map(sampleInput);
      expect(result.xp).toBe(180);
    });

    it('should strip lair percentage from numberAppearing', () => {
      result = mapper.map(sampleInput);
      expect(result.numberAppearing).toBe('2d4');
    });

    it('should map hoard to treasure', () => {
      result = mapper.map(sampleInput);
      expect(result.treasure).toBe('C4 + R4 + M1');
    });

    it('should set type to Bestiary', () => {
      result = mapper.map(sampleInput);
      expect(result.type).toBe('Bestiary');
    });

    it('should parse alignment from meta', () => {
      result = mapper.map(sampleInput);
      expect(result.alignment).toBe('Chaotic');
    });

    it('should parse kindred from meta', () => {
      result = mapper.map(sampleInput);
      expect(result.kindred).toBe('Undead');
    });

    it('should map behaviour', () => {
      result = mapper.map(sampleInput);
      expect(result.behaviour).toBe('Ruthless, hateful');
    });

    it('should map speech', () => {
      result = mapper.map(sampleInput);
      expect(result.speech).toBe('None. Understand Common');
    });

    it('should map possessions', () => {
      result = mapper.map(sampleInput);
      expect(result.possessions).toBe('None');
    });

    it('should map description (clean, without abilities)', () => {
      result = mapper.map(sampleInput);
      expect(result.description).toBe(
        'A spectral horror that haunts dark places.',
      );
    });

    it('should map creatureAbilities from abilities', () => {
      result = mapper.map(sampleInput);
      expect(result.creatureAbilities).toEqual([
        { name: 'Dark sight', text: 'Can see normally without light.' },
        { name: 'Life drain', text: 'Drains 1d3 Constitution on touch.' },
      ]);
    });

    it('should map sections (TRAITS, ENCOUNTERS)', () => {
      result = mapper.map(sampleInput);
      expect(result.sections).toEqual({
        TRAITS: [
          { roll: '1', text: 'Wields a scythe.' },
          { roll: '2', text: 'Skull wreathed in blue flame.' },
        ],
        ENCOUNTERS: [
          { roll: '1', text: 'Dragging a victim through the mist.' },
        ],
      });
    });

    it('should map names', () => {
      result = mapper.map(sampleInput);
      expect(result.names).toBe('Aldric, Belthan, Caradoc');
    });
  });

  describe('given a creature with composite movement', () => {
    it('should compose speed + fly as string', () => {
      const input = {
        ...sampleInput,
        stats: { ...sampleInput.stats, speed: '30', fly: '60' },
      };
      const result = mapper.map(input);
      expect(result.movement).toBe('30 Fly 60');
    });
  });

  describe('given a creature with multi-attack', () => {
    it('should split "or" attacks into array', () => {
      const input = {
        ...sampleInput,
        stats: {
          ...sampleInput.stats,
          attacks: 'Touch (+6, 1d8 + chill) or wail (death)',
        },
      };
      const result = mapper.map(input);
      expect(result.attacks).toEqual([
        'Touch (+6, 1d8 + chill)',
        'wail (death)',
      ]);
    });
  });

  describe('given a creature without optional enrichment fields', () => {
    it('should produce a valid creature with undefined enrichment fields', () => {
      const minimal = {
        name: 'Forest Critter',
        meta: 'Small Animal—Animal Intelligence—Neutral',
        stats: {
          level: '1',
          ac: '10',
          hp: '1d4 (2)',
          saves: 'D14 R15 H16 B17 S18',
          attacks: 'Bite (+0, 1d2)',
          speed: '20',
          morale: '5',
          xp: '5',
          encounters: '2d6',
        },
      };
      const result = mapper.map(minimal);
      expect(result.name).toBe('Forest Critter');
      expect(result.behaviour).toBeUndefined();
      expect(result.speech).toBeUndefined();
      expect(result.creatureAbilities).toBeUndefined();
      expect(result.sections).toBeUndefined();
      expect(result.names).toBeUndefined();
    });
  });

  describe('mapAll', () => {
    it('should map an array of raw creatures', () => {
      const results = mapper.mapAll([sampleInput]);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Shadow Wraith');
    });
  });
});
