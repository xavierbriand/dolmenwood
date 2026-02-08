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
});

describe('Table Schemas', () => {
  it('should validate a correct region table structure', () => {
    const validTable = {
        name: "Generic Forest",
        die: "1d6",
        entries: [
            { min: 1, max: 2, type: "Creature", ref: "Goblin" },
            { min: 3, max: 6, type: "Lair", ref: "Bandit Camp" }
        ]
    };
    const result = RegionTableSchema.safeParse(validTable);
    expect(result.success).toBe(true);
  });

  it('should reject invalid region table (missing entries)', () => {
      const invalidTable = {
          name: "Generic Forest",
          die: "1d6",
          // entries missing
      };
      const result = RegionTableSchema.safeParse(invalidTable);
      expect(result.success).toBe(false);
  });

  it('should reject region table with gaps in range', () => {
    const invalidTable = {
        name: "Gap Table",
        die: "1d6",
        entries: [
            { min: 1, max: 2, type: "Creature", ref: "Goblin" },
            // Gap 3
            { min: 4, max: 6, type: "Lair", ref: "Bandit Camp" }
        ]
    };
    const result = RegionTableSchema.safeParse(invalidTable);
    expect(result.success).toBe(false);
  });
});
