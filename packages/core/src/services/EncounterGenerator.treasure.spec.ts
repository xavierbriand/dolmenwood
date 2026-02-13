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

class FixedRandom implements RandomProvider {
  constructor(private value = 0.5) {}
  next(): number {
    return this.value;
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
      { min: 1, max: 6, type: 'Creature', ref: 'Forest Sprite', count: '1' },
    ],
  };
}

function buildCreature(overrides: Partial<Creature> = {}): Creature {
  return {
    name: 'Forest Sprite',
    level: 1,
    alignment: 'Neutral',
    xp: 10,
    numberAppearing: '1',
    armourClass: 10,
    movement: 30,
    hitDice: '1d6',
    attacks: ['Claw'],
    morale: 7,
    ...overrides,
  };
}

describe('EncounterGenerator - Treasure Integration', () => {
  describe('given a TreasureGenerator is provided', () => {
    it('should include rolled treasure when creature has a treasure field', async () => {
      // Use 0.1 so the lair check passes (0.1 < 0.3) — hoard is only rolled in lair
      const random = new FixedRandom(0.1);
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
        expect(result.data.treasure!.totalValue).toBeGreaterThan(0);
      }
    });

    it('should not include treasure when creature has no treasure field', async () => {
      const random = new FixedRandom(0.5);
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
      }
    });

    it('should not include treasure when creature has treasure "None"', async () => {
      const random = new FixedRandom(0.5);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature({ treasure: 'None' }));

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

    it('should include possessions (extras) from treasure code parsing', async () => {
      // Use 0.1 so the lair check passes (0.1 < 0.3) — hoard + possessions in lair
      const random = new FixedRandom(0.1);
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

    it('should include treasure in generateEncounter output', async () => {
      // Use 0.1 so the lair check passes (0.1 < 0.3) — hoard is only rolled in lair
      const random = new FixedRandom(0.1);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      // Need encounter type table and secondary tables for generateEncounter
      tableRepo.addTable({
        name: 'Encounter Type - Daytime - Wild',
        die: '1d6',
        entries: [
          {
            min: 1,
            max: 6,
            type: 'Creature',
            ref: 'Forest Sprite',
            count: '1',
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
        expect(result.data.details.treasure).toBeDefined();
        expect(result.data.details.treasure!.coins.copper).toBeGreaterThan(0);
      }
    });
  });

  describe('given no TreasureGenerator is provided', () => {
    it('should not include treasure even if creature has a treasure field', async () => {
      const random = new FixedRandom(0.5);
      const tableRepo = new MockTableRepository();
      const creatureRepo = new MockCreatureRepository();

      tableRepo.addTable(buildCreatureTable());
      creatureRepo.addCreature(buildCreature({ treasure: 'C1' }));

      const generator = new EncounterGenerator(tableRepo, creatureRepo, random);

      const result = await generator.generate('Test Table');

      expect(result.kind).toBe('success');
      if (result.kind === 'success' && result.data.kind === 'creature') {
        expect(result.data.treasure).toBeUndefined();
      }
    });
  });
});
