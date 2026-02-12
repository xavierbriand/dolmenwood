import { describe, it, expect } from 'vitest';
import { CreatureSchema, EncounterTypeSchema } from './encounter.js';
import { RegionTableSchema } from './tables.js';
import { DTableEntrySchema, AbilitySchema } from './creature.js';

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

describe('DTableEntrySchema', () => {
  it('should validate a d-table entry with roll and text', () => {
    const entry = { roll: '1', text: 'Seductive, youthful beauty.' };
    const result = DTableEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roll).toBe('1');
      expect(result.data.text).toBe('Seductive, youthful beauty.');
    }
  });

  it('should validate a d-table entry with range roll', () => {
    const entry = { roll: '1-2', text: 'Some outcome for a range.' };
    const result = DTableEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should reject a d-table entry missing text', () => {
    const entry = { roll: '3' };
    const result = DTableEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});

describe('AbilitySchema', () => {
  it('should validate an ability with name and text', () => {
    const ability = {
      name: 'Dark Sight',
      text: 'Can see normally without light.',
    };
    const result = AbilitySchema.safeParse(ability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Dark Sight');
      expect(result.data.text).toBe('Can see normally without light.');
    }
  });

  it('should reject an ability missing name', () => {
    const ability = { text: 'Some text' };
    const result = AbilitySchema.safeParse(ability);
    expect(result.success).toBe(false);
  });
});

describe('Creature Schema (enrichment fields)', () => {
  const baseCreature = {
    name: 'Shadow Wraith',
    level: 5,
    alignment: 'Chaotic',
    xp: 300,
    numberAppearing: '1d4',
    armourClass: 16,
    movement: 40,
    hitDice: '5d8',
    attacks: ['1 x claw (1d8)'],
    morale: 9,
  };

  it('should validate a creature with all enrichment fields', () => {
    const enrichedCreature = {
      ...baseCreature,
      behaviour: 'Coldly brilliant, vengeful',
      speech: 'Rasping whisper',
      possessions: 'Tattered cloak, ancient ring',
      treasure: 'C6 + R7',
      creatureAbilities: [
        { name: 'Incorporeal', text: 'Can pass through solid objects.' },
        { name: 'Dark Sight', text: 'Can see without light.' },
      ],
      sections: {
        TRAITS: [
          { roll: '1', text: 'Flickering shadow form.' },
          { roll: '2', text: 'Scent of cold earth.' },
        ],
        ENCOUNTERS: [
          { roll: '1', text: 'Drifting silently through the mist.' },
        ],
      },
      names: 'Aldric, Belthan, Caradoc, Darnoth',
    };
    const result = CreatureSchema.safeParse(enrichedCreature);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.behaviour).toBe('Coldly brilliant, vengeful');
      expect(result.data.speech).toBe('Rasping whisper');
      expect(result.data.possessions).toBe('Tattered cloak, ancient ring');
      expect(result.data.creatureAbilities).toHaveLength(2);
      expect(result.data.creatureAbilities![0].name).toBe('Incorporeal');
      expect(result.data.sections).toBeDefined();
      expect(result.data.sections!['TRAITS']).toHaveLength(2);
      expect(result.data.sections!['ENCOUNTERS']).toHaveLength(1);
      expect(result.data.names).toBe('Aldric, Belthan, Caradoc, Darnoth');
    }
  });

  it('should validate a creature without enrichment fields (backward compat)', () => {
    const result = CreatureSchema.safeParse(baseCreature);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.behaviour).toBeUndefined();
      expect(result.data.speech).toBeUndefined();
      expect(result.data.possessions).toBeUndefined();
      expect(result.data.creatureAbilities).toBeUndefined();
      expect(result.data.sections).toBeUndefined();
      expect(result.data.names).toBeUndefined();
    }
  });

  it('should reject creature with invalid sections shape', () => {
    const badSections = {
      ...baseCreature,
      sections: {
        TRAITS: 'not an array',
      },
    };
    const result = CreatureSchema.safeParse(badSections);
    expect(result.success).toBe(false);
  });

  it('should reject creature with invalid creatureAbilities shape', () => {
    const badAbilities = {
      ...baseCreature,
      creatureAbilities: [{ name: 'Missing text field' }],
    };
    const result = CreatureSchema.safeParse(badAbilities);
    expect(result.success).toBe(false);
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

  it('should validate a table entry with a qualifier', () => {
    const table = {
      name: 'Test Table',
      die: '1d4',
      entries: [
        {
          min: 1,
          max: 2,
          type: 'Creature',
          ref: 'Rogue',
          qualifier: 'Bandit',
          count: '3d10',
        },
        { min: 3, max: 4, type: 'Creature', ref: 'Guard' },
      ],
    };
    const result = RegionTableSchema.safeParse(table);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0].qualifier).toBe('Bandit');
      expect(result.data.entries[1].qualifier).toBeUndefined();
    }
  });

  it('should validate a table entry with an array ref (either/or creature)', () => {
    const table = {
      name: 'Test Table',
      die: '1d4',
      entries: [
        {
          min: 1,
          max: 2,
          type: 'Creature',
          ref: ['Forest Guard', 'Forest Knight'],
          count: '1d4',
        },
        { min: 3, max: 4, type: 'Creature', ref: 'Scout' },
      ],
    };
    const result = RegionTableSchema.safeParse(table);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0].ref).toEqual([
        'Forest Guard',
        'Forest Knight',
      ]);
      expect(result.data.entries[1].ref).toBe('Scout');
    }
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
