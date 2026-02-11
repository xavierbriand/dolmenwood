import { describe, it, expect } from 'vitest';
import { CreatureSchema, EncounterTypeSchema } from './encounter.js';
import { RegionTableSchema } from './tables.js';

describe('Encounter Schemas', () => {
  it('should validate a correct creature object', () => {
    const validCreature = {
      name: 'Goblin',
      level: 1,
      alignment: 'Chaotic',
      xp: 10,
      numberAppearing: '1d6',
      armourClass: 7,
      movement: 90,
      hitDice: '1d6',
      attacks: ['1 x weapon (1d6)'],
      morale: 7,
    };
    const result = CreatureSchema.safeParse(validCreature);
    expect(result.success).toBe(true);
  });

  it('should validate a creature with a faction array', () => {
    const creatureWithFaction = {
      name: 'Shadow Knight',
      level: 3,
      alignment: 'Chaotic',
      xp: 50,
      numberAppearing: '1d4',
      armourClass: 14,
      movement: 30,
      hitDice: '3d8',
      attacks: ['1 x sword (1d8)'],
      morale: 9,
      faction: ['Dark Order', 'Night Court'],
    };
    const result = CreatureSchema.safeParse(creatureWithFaction);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.faction).toEqual(['Dark Order', 'Night Court']);
    }
  });

  it('should allow creature without faction (optional field)', () => {
    const creatureNoFaction = {
      name: 'Wild Boar',
      level: 1,
      alignment: 'Neutral',
      xp: 10,
      numberAppearing: '1d6',
      armourClass: 11,
      movement: 40,
      hitDice: '1d8',
      attacks: ['1 x gore (1d6)'],
      morale: 7,
    };
    const result = CreatureSchema.safeParse(creatureNoFaction);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.faction).toBeUndefined();
    }
  });

  it('should reject an invalid creature object (missing AC)', () => {
    const invalidCreature = {
      name: 'Goblin',
      level: 1,
      alignment: 'Chaotic',
      xp: 10,
      numberAppearing: '1d6',
      // armourClass: 7, // Missing
      movement: 90,
      hitDice: '1d6',
      attacks: ['1 x weapon (1d6)'],
      morale: 7,
    };
    const result = CreatureSchema.safeParse(invalidCreature);
    expect(result.success).toBe(false);
  });

  it('should validate EncounterType enum', () => {
    const result = EncounterTypeSchema.safeParse('Creature');
    expect(result.success).toBe(true);
    expect(EncounterTypeSchema.safeParse('Invalid').success).toBe(false);
  });
  it('should validate a creature with variants', () => {
    const creatureWithVariants = {
      name: 'Warrior',
      level: 1,
      alignment: 'Any',
      xp: 10,
      numberAppearing: '2d6',
      armourClass: 15,
      movement: 20,
      hitDice: '1d8',
      attacks: ['Weapon (+0)'],
      morale: 7,
      variants: [
        {
          label: 'Level 3 Warrior (Veteran)',
          level: 3,
          xp: 40,
          armourClass: 17,
          movement: 20,
          hitDice: '3d8',
          attacks: ['Weapon (+2)'],
          morale: 8,
          numberAppearing: '1d4',
        },
        {
          label: 'Level 5 Warrior (Champion)',
          level: 5,
          xp: 260,
          armourClass: 19,
          movement: 20,
          hitDice: '5d8',
          attacks: ['Weapon (+3)'],
          morale: 9,
          numberAppearing: '1',
        },
      ],
    };
    const result = CreatureSchema.safeParse(creatureWithVariants);
    expect(result.success).toBe(true);
  });

  it('should validate a creature without variants', () => {
    const creatureNoVariants = {
      name: 'Forest Sprite',
      level: 2,
      alignment: 'Neutral',
      xp: 20,
      numberAppearing: '1d4',
      armourClass: 12,
      movement: 40,
      hitDice: '2d6',
      attacks: ['1 x spell (1d6)'],
      morale: 6,
    };
    const result = CreatureSchema.safeParse(creatureNoVariants);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants).toBeUndefined();
    }
  });
});

describe('Table Schemas', () => {
  it('should validate a correct region table structure', () => {
    const validTable = {
      name: 'Generic Forest',
      die: '1d6',
      entries: [
        { min: 1, max: 2, type: 'Creature', ref: 'Goblin' },
        { min: 3, max: 6, type: 'Lair', ref: 'Bandit Camp' },
      ],
    };
    const result = RegionTableSchema.safeParse(validTable);
    expect(result.success).toBe(true);
  });

  it('should reject invalid region table (missing entries)', () => {
    const invalidTable = {
      name: 'Generic Forest',
      die: '1d6',
      // entries missing
    };
    const result = RegionTableSchema.safeParse(invalidTable);
    expect(result.success).toBe(false);
  });

  it('should reject region table with gaps in range', () => {
    const invalidTable = {
      name: 'Gap Table',
      die: '1d6',
      entries: [
        { min: 1, max: 2, type: 'Creature', ref: 'Goblin' },
        // Gap 3
        { min: 4, max: 6, type: 'Lair', ref: 'Bandit Camp' },
      ],
    };
    const result = RegionTableSchema.safeParse(invalidTable);
    expect(result.success).toBe(false);
  });
});
