import { describe, it, expect } from 'vitest';
import { EncounterGenerator } from './EncounterGenerator.js';
import { TreasureGenerator } from './TreasureGenerator.js';
import { TableRepository } from '../ports/TableRepository.js';
import { CreatureRepository } from '../ports/CreatureRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { Result, success, failure } from '../utils/Result.js';
import { RegionTable } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';
import type { TreasureTables } from '../schemas/treasure.js';

// --- Mock helpers ---

class MockTableRepository implements TableRepository {
  private tables = new Map<string, RegionTable>();

  addTable(table: RegionTable) {
    this.tables.set(table.name, table);
  }

  async getTable(name: string): Promise<Result<RegionTable>> {
    const table = this.tables.get(name);
    return table ? success(table) : failure(new Error('Table not found'));
  }

  async listTables(): Promise<Result<RegionTable[]>> {
    return success(Array.from(this.tables.values()));
  }
}

class MockCreatureRepository implements CreatureRepository {
  private creatures = new Map<string, Creature>();

  addCreature(creature: Creature) {
    this.creatures.set(creature.name, creature);
  }

  async getByName(name: string): Promise<Result<Creature, string>> {
    const creature = this.creatures.get(name);
    return creature ? success(creature) : failure('Creature not found');
  }

  async getAll(): Promise<Result<Creature[], string>> {
    return success(Array.from(this.creatures.values()));
  }
}

/**
 * Returns values from a predetermined sequence, cycling if exhausted.
 * This allows precise control over every random.next() call.
 */
class SequenceRandom implements RandomProvider {
  private index = 0;
  constructor(private values: number[]) {
    if (values.length === 0)
      throw new Error('SequenceRandom needs at least one value');
  }
  next(): number {
    const val = this.values[this.index % this.values.length];
    this.index++;
    return val;
  }
}

/** Minimal treasure tables for testing */
function buildMinimalTreasureTables(): TreasureTables {
  return {
    coins: [
      {
        type: 'C1',
        averageValue: 25,
        copper: { chance: 100, quantity: '1d4 × 1,000' },
        silver: null,
        gold: null,
        pellucidium: null,
      },
    ],
    riches: [
      {
        type: 'R1',
        averageValue: 250,
        gems: { chance: 100, quantity: '1d4 gems' },
        artObjects: null,
      },
    ],
    magicItems: [
      {
        type: 'M1',
        averageValue: 670,
        chance: 100,
        items: '1 item (roll type)',
      },
    ],
    magicItemType: [{ min: 1, max: 100, type: 'Potion' }],
    treasureHoard: [
      { min: 1, max: 100, description: 'Coins', averageValue: 2500 },
    ],
    jewellery: [{ min: 1, max: 100, type: 'Ring' }],
    miscArtObjects: [{ min: 1, max: 100, type: 'Vase' }],
    coinAppearance: [{ roll: 1, head: 'Lord Test', tail: 'Acorn' }],
    gemValue: [{ min: 1, max: 100, category: 'Ornamental', value: 10 }],
    gemType: { Ornamental: ['Agate', 'Quartz'] },
    preciousMaterials: [{ roll: 1, value: 'Silver' }],
    embellishments: [{ roll: 1, value: 'Engraved' }],
    provenance: [{ roll: 1, value: 'Ancient' }],
    amulets: [{ name: 'Test Charm', value: 500, summary: 'A test charm' }],
    magicBalms: [{ name: 'Test Balm', value: 300, summary: 'A test balm' }],
    magicCrystals: [
      { name: 'Test Crystal', value: 400, summary: 'A test crystal' },
    ],
    magicGarments: [
      { name: 'Test Cloak', value: 600, summary: 'A test cloak' },
    ],
    magicRings: [{ name: 'Test Ring', value: 700, summary: 'A test ring' }],
    potions: [{ name: 'Test Potion', value: 200, summary: 'A test potion' }],
    wondrousItems: [{ name: 'Test Orb', value: 900, summary: 'A test orb' }],
    magicArmour: {},
    magicInstruments: {},
    magicWeapons: {},
    rodsStavesWands: {},
    scrollsBooks: {},
  };
}

function buildCreatureTable(): RegionTable {
  return {
    name: 'Test Table',
    die: '1d6',
    entries: [
      { min: 1, max: 6, type: 'Creature', ref: 'Forest Sprite', count: '1d4' },
    ],
  };
}

function buildCreature(overrides: Partial<Creature> = {}): Creature {
  return {
    name: 'Forest Sprite',
    level: 1,
    alignment: 'Neutral',
    xp: 10,
    numberAppearing: '1d4',
    armourClass: 10,
    movement: 30,
    hitDice: '1d6',
    attacks: ['Claw'],
    morale: 7,
    ...overrides,
  };
}

describe('EncounterGenerator - Lair vs Wandering', () => {
  describe('given a wandering encounter (lair check fails)', () => {
    it('should set isLair to false on the result', async () => {
      // Random sequence:
      //   1. Table roll (1d6): 0.5 -> 4 (hits entry)
      //   2. Count roll (1d4): 0.5 -> 3
      //   3. Lair check: 0.8 (> 0.3, so NOT a lair)
      const random = new SequenceRandom([0.5, 0.5, 0.8]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature({ treasure: 'C1' }));

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.isLair).toBe(false);
      }
    });

    it('should not roll hoard treasure for wandering encounters', async () => {
      // Random sequence:
      //   1. Table roll (1d6): 0.5 -> 4
      //   2. Count roll (1d4): 0.5 -> 3
      //   3. Lair check: 0.8 (NOT a lair)
      const random = new SequenceRandom([0.5, 0.5, 0.8]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature({ treasure: 'C1' }));

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeUndefined();
      }
    });

    it('should return possessions from extras for wandering encounters', async () => {
      // Random sequence:
      //   1. Table roll (1d6): 0.5 -> 4
      //   2. Count roll (1d4): 0.5 -> 3
      //   3. Lair check: 0.8 (NOT a lair)
      const random = new SequenceRandom([0.5, 0.5, 0.8]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(
        buildCreature({ treasure: 'C1 + 4d20 pots or jugs' }),
      );

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeUndefined();
        expect(result.data.possessions).toBe('4d20 pots or jugs');
      }
    });

    it('should not multiply the count for wandering encounters', async () => {
      // Random sequence:
      //   1. Table roll (1d6): 0.5 -> 4
      //   2. Count roll (1d4): 0.5 -> floor(0.5*4)+1 = 3
      //   3. Lair check: 0.8 (NOT a lair)
      const random = new SequenceRandom([0.5, 0.5, 0.8]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature());

      const generator = new EncounterGenerator(tableRepo, creatureRepo, random);

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.count).toBe(3);
      }
    });
  });

  describe('given a lair encounter (lair check passes)', () => {
    it('should set isLair to true on the result', async () => {
      // Random sequence:
      //   1. Table roll (1d6): 0.5 -> 4
      //   2. Count roll (1d4): 0.5 -> 3
      //   3. Lair check: 0.1 (< 0.3, IS a lair)
      //   4. Lair multiplier: 0.5 -> floor(0.5*5)+1 = 3
      //   5+: treasure rolls (cycling from start)
      const random = new SequenceRandom([0.5, 0.5, 0.1, 0.5]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature({ treasure: 'C1' }));

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.isLair).toBe(true);
      }
    });

    it('should roll full hoard treasure for lair encounters', async () => {
      // Random sequence:
      //   1. Table roll: 0.5
      //   2. Count roll: 0.5
      //   3. Lair check: 0.1 (IS a lair)
      //   4. Lair multiplier: 0.5
      //   5+: treasure rolls (cycling)
      const random = new SequenceRandom([0.5, 0.5, 0.1, 0.5]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature({ treasure: 'C1' }));

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeDefined();
        expect(result.data.treasure!.coins.copper).toBeGreaterThan(0);
      }
    });

    it('should multiply count by 1d5 for lair encounters', async () => {
      // Random sequence:
      //   1. Table roll: 0.5
      //   2. Count roll (1d4): 0.5 -> 3
      //   3. Lair check: 0.1 (IS a lair)
      //   4. Lair multiplier: 0.5 -> floor(0.5*5)+1 = 3
      //   => final count = 3 * 3 = 9
      const random = new SequenceRandom([0.5, 0.5, 0.1, 0.5]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature());

      const generator = new EncounterGenerator(tableRepo, creatureRepo, random);

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.count).toBe(9); // 3 base * 3 multiplier
      }
    });

    it('should include both hoard and possessions for lair encounters', async () => {
      const random = new SequenceRandom([0.5, 0.5, 0.1, 0.5]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(
        buildCreature({ treasure: 'C1 + 4d20 pots or jugs' }),
      );

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeDefined();
        expect(result.data.possessions).toBe('4d20 pots or jugs');
      }
    });
  });

  describe('given a creature with no treasure field', () => {
    it('should produce no treasure for either wandering or lair encounters', async () => {
      // Wandering case (lair check fails)
      const random = new SequenceRandom([0.5, 0.5, 0.8]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature()); // no treasure field

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeUndefined();
        expect(result.data.possessions).toBeUndefined();
      }
    });
  });

  describe('given a creature with possessions but no hoard codes', () => {
    it('should return possessions only for wandering encounters', async () => {
      const random = new SequenceRandom([0.5, 0.5, 0.8]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      // Treasure string with only extras, no C/R/M codes
      creatureRepo.addCreature(buildCreature({ treasure: '2d6 gold coins' }));

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeUndefined();
        expect(result.data.possessions).toBe('2d6 gold coins');
      }
    });
  });

  describe('given isLair is included in the Encounter schema', () => {
    it('should propagate isLair to the Encounter details', async () => {
      // Full generateEncounter flow — need secondary tables
      const random = new SequenceRandom([0.5, 0.5, 0.1, 0.5]);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable({
        name: 'Encounter Type - Daytime - Wild',
        die: '1d6',
        entries: [
          {
            min: 1,
            max: 6,
            type: 'Creature',
            ref: 'Forest Sprite',
            count: '1d4',
          },
        ],
      });
      tableRepo.addTable({
        name: 'Activity',
        die: '1d6',
        entries: [{ min: 1, max: 6, type: 'Text', ref: 'Foraging' }],
      });
      tableRepo.addTable({
        name: 'Reaction',
        die: '2d6',
        entries: [{ min: 2, max: 12, type: 'Text', ref: 'Neutral' }],
      });

      creatureRepo.addCreature(buildCreature({ treasure: 'C1' }));

      const treasureGen = new TreasureGenerator(
        buildMinimalTreasureTables(),
        random,
      );
      const generator = new EncounterGenerator(
        tableRepo,
        creatureRepo,
        random,
        treasureGen,
      );

      const result = await generator.generateEncounter({
        regionId: 'test-forest',
        timeOfDay: 'Day',
        terrain: 'Off-road',
        camping: false,
      });

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data.details.isLair).toBe(true);
      }
    });
  });
});
