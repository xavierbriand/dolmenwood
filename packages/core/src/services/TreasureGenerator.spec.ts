import { describe, it, expect } from 'vitest';
import { TreasureGenerator } from './TreasureGenerator.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import type {
  TreasureTables,
  TreasureSpec,
  RolledMagicItem,
} from '../schemas/treasure.js';

/**
 * A deterministic RandomProvider that returns pre-configured values.
 * Each call to next() pops the first value from the queue.
 * If the queue is exhausted, returns 0.
 */
class SequenceRandom implements RandomProvider {
  private queue: number[];

  constructor(values: number[]) {
    this.queue = [...values];
  }

  next(): number {
    return this.queue.shift() ?? 0;
  }
}

/**
 * Helper: convert a desired d100 result (1-100) to a RandomProvider.next() value.
 * Die.roll does: Math.floor(random.next() * sides) + 1
 * So for a d100 roll of R: next() should return (R - 1) / 100
 */
function d100(result: number): number {
  return (result - 1) / 100;
}

/** Helper: convert a desired dN result to a next() value */
function dN(result: number, sides: number): number {
  return (result - 1) / sides;
}

/**
 * Minimal test fixture for TreasureTables.
 * Only populates the fields needed for each test; unused arrays are empty.
 */
function makeMinimalTables(
  overrides: Partial<TreasureTables> = {},
): TreasureTables {
  return {
    coins: [],
    riches: [],
    magicItems: [],
    magicItemType: [],
    treasureHoard: [],
    jewellery: [],
    miscArtObjects: [],
    coinAppearance: [],
    gemValue: [],
    gemType: {},
    preciousMaterials: [],
    embellishments: [],
    provenance: [],
    amulets: [],
    magicBalms: [],
    magicCrystals: [],
    magicGarments: [],
    magicRings: [],
    potions: [],
    wondrousItems: [],
    magicArmour: {},
    magicInstruments: {},
    magicWeapons: {},
    rodsStavesWands: {},
    scrollsBooks: {},
    ...overrides,
  };
}

describe('TreasureGenerator', () => {
  describe('given an empty spec (no codes)', () => {
    it('should return zero treasure', () => {
      const tables = makeMinimalTables();
      const random = new SequenceRandom([]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = { codes: [], extras: [] };
      const result = gen.rollHoard(spec);

      expect(result.coins).toEqual({
        copper: 0,
        silver: 0,
        gold: 0,
        pellucidium: 0,
      });
      expect(result.gems).toEqual([]);
      expect(result.artObjects).toEqual([]);
      expect(result.magicItems).toEqual([]);
      expect(result.totalValue).toBe(0);
    });
  });

  describe('given a C tier code', () => {
    const coinsTier = {
      type: 'C1',
      averageValue: 25,
      copper: { chance: 50, quantity: '1d4 × 1,000' },
      silver: { chance: 25, quantity: '1d3 × 100' },
      gold: null,
      pellucidium: null,
    };

    it('should produce no coins when all d100 rolls miss', () => {
      const tables = makeMinimalTables({ coins: [coinsTier] });
      // d100 for copper: 51 (miss, chance=50), d100 for silver: 26 (miss, chance=25)
      const random = new SequenceRandom([d100(51), d100(26)]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.coins.copper).toBe(0);
      expect(result.coins.silver).toBe(0);
      expect(result.coins.gold).toBe(0);
      expect(result.coins.pellucidium).toBe(0);
    });

    it('should roll coins when d100 hits the chance', () => {
      const tables = makeMinimalTables({ coins: [coinsTier] });
      // d100 for copper: 50 (hit, chance=50) → roll 1d4: result 3 → 3 × 1000 = 3000
      // d100 for silver: 25 (hit, chance=25) → roll 1d3: result 2 → 2 × 100 = 200
      const random = new SequenceRandom([
        d100(50), // copper chance hit
        dN(3, 4), // 1d4 → 3
        d100(25), // silver chance hit
        dN(2, 3), // 1d3 → 2
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.coins.copper).toBe(3000);
      expect(result.coins.silver).toBe(200);
      expect(result.coins.gold).toBe(0);
      expect(result.coins.pellucidium).toBe(0);
    });

    it('should handle quantity without a multiplier (e.g. "2d6")', () => {
      const simpleTier = {
        type: 'C1',
        averageValue: 10,
        copper: { chance: 100, quantity: '2d6' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [simpleTier] });
      // d100 for copper: 1 (hit, chance=100) → roll 2d6: 3 + 4 = 7
      const random = new SequenceRandom([
        d100(1), // copper chance hit
        dN(3, 6), // first d6 → 3
        dN(4, 6), // second d6 → 4
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.coins.copper).toBe(7);
    });

    it('should accumulate coins across multiple C codes', () => {
      const tier1 = {
        type: 'C1',
        averageValue: 25,
        copper: { chance: 100, quantity: '1d4 × 100' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const tier2 = {
        type: 'C2',
        averageValue: 50,
        copper: { chance: 100, quantity: '1d6 × 100' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier1, tier2] });
      // C1: d100 copper hit → 1d4=2 → 200
      // C2: d100 copper hit → 1d6=5 → 500
      const random = new SequenceRandom([
        d100(1),
        dN(2, 4), // C1 copper
        d100(1),
        dN(5, 6), // C2 copper
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [
          { tier: 'C', level: 1 },
          { tier: 'C', level: 2 },
        ],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.coins.copper).toBe(700);
    });
  });

  describe('given an R tier code', () => {
    it('should produce no riches when d100 rolls miss', () => {
      const richesTier = {
        type: 'R1',
        averageValue: 250,
        gems: { chance: 50, quantity: '1d4 gems' },
        artObjects: null,
      };
      const tables = makeMinimalTables({ riches: [richesTier] });
      // d100 for gems: 51 (miss)
      const random = new SequenceRandom([d100(51)]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'R', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.gems).toEqual([]);
      expect(result.artObjects).toEqual([]);
    });

    it('should roll gems when d100 hits', () => {
      const richesTier = {
        type: 'R1',
        averageValue: 250,
        gems: { chance: 50, quantity: '1d4 gems' },
        artObjects: null,
      };
      const gemValueEntries = [
        { min: 1, max: 50, category: 'Ornamental', value: 10 },
        { min: 51, max: 100, category: 'Fancy', value: 100 },
      ];
      const gemTypes = {
        Ornamental: ['Agate', 'Quartz', 'Lapis'],
        Fancy: ['Amber', 'Jade', 'Coral'],
      };

      const tables = makeMinimalTables({
        riches: [richesTier],
        gemValue: gemValueEntries,
        gemType: gemTypes,
      });

      // d100 for gems: 25 (hit, chance=50)
      // 1d4 for quantity: 2 (two gems)
      // Gem 1: d100=30 → Ornamental (10gp), pick from 3 types: index 1 → "Quartz"
      // Gem 2: d100=75 → Fancy (100gp), pick from 3 types: index 2 → "Coral"
      const random = new SequenceRandom([
        d100(25), // gems chance hit
        dN(2, 4), // 1d4 → 2 gems
        d100(30), // gem 1 value roll → Ornamental
        1 / 3, // gem 1 type pick → index 1 → "Quartz"
        d100(75), // gem 2 value roll → Fancy
        2 / 3, // gem 2 type pick → index 2 → "Coral"
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'R', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.gems).toHaveLength(2);
      expect(result.gems[0]).toEqual({
        category: 'Ornamental',
        type: 'Quartz',
        value: 10,
      });
      expect(result.gems[1]).toEqual({
        category: 'Fancy',
        type: 'Coral',
        value: 100,
      });
    });

    it('should roll art objects when d100 hits', () => {
      const richesTier = {
        type: 'R1',
        averageValue: 300,
        gems: null,
        artObjects: { chance: 50, quantity: '1d4 objects' },
      };
      const jewelleryEntries = [
        { min: 1, max: 50, type: 'Bracelet' },
        { min: 51, max: 100, type: 'Necklace' },
      ];
      const materials = [
        { roll: 1, value: 'Silver' },
        { roll: 2, value: 'Gold' },
      ];
      const embellishmentEntries = [
        { roll: 1, value: 'Engraved' },
        { roll: 2, value: 'Jewelled' },
      ];

      const tables = makeMinimalTables({
        riches: [richesTier],
        jewellery: jewelleryEntries,
        miscArtObjects: [],
        preciousMaterials: materials,
        embellishments: embellishmentEntries,
      });

      // d100 for artObjects: 25 (hit, chance=50)
      // 1d4 for quantity: 1 (one object)
      // d100 for jewellery vs misc: 50 → jewellery (<=50 = jewellery)
      // d100 for jewellery type: 30 → Bracelet (1-50)
      // d20 for material: 2 → Gold
      // d20 for embellishment: 1 → Engraved
      // 3d6 for value: 3+4+2 = 9 → 9 × 100 = 900gp
      const random = new SequenceRandom([
        d100(25), // artObjects chance hit
        dN(1, 4), // 1d4 → 1 object
        d100(50), // jewellery-or-misc → jewellery
        d100(30), // jewellery type → Bracelet
        dN(2, 20), // material d20 → Gold
        dN(1, 20), // embellishment d20 → Engraved
        dN(3, 6), // 3d6 value: die 1 = 3
        dN(4, 6), // die 2 = 4
        dN(2, 6), // die 3 = 2
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'R', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.artObjects).toHaveLength(1);
      expect(result.artObjects[0]).toEqual({
        type: 'Bracelet',
        material: 'Gold',
        embellishment: 'Engraved',
        value: 900,
      });
    });
  });

  describe('given an M tier code', () => {
    it('should produce no items when d100 misses', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 670,
        chance: 10,
        items: '1 item (roll type)',
      };
      const tables = makeMinimalTables({ magicItems: [magicTier] });
      // d100: 11 (miss, chance=10)
      const random = new SequenceRandom([d100(11)]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toEqual([]);
    });

    it('should roll magic items when d100 hits', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 920,
        chance: 15,
        items: '1 item (roll type)',
      };
      const magicItemTypeEntries = [
        { min: 1, max: 50, type: 'Potion' },
        { min: 51, max: 100, type: 'Amulet / talisman' },
      ];
      const potionEntries = [
        { name: 'Healing Draught', value: 500, summary: 'Restores health' },
        { name: 'Strength Elixir', value: 800, summary: 'Boosts strength' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        magicItemType: magicItemTypeEntries,
        potions: potionEntries,
      });

      // d100: 15 (hit, chance=15)
      // d100 for item type: 25 → Potion
      // Pick from 2 potions: index 0 → Healing Draught
      const random = new SequenceRandom([
        d100(15), // chance hit
        d100(25), // item type → Potion
        0 / 2, // potion pick → index 0
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(1);
      expect(result.magicItems[0]).toEqual({
        category: 'Potion',
        name: 'Healing Draught',
        value: 500,
      });
    });

    it('should handle multiple items in the items string', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 1225,
        chance: 100,
        items: '2 items (roll type)',
      };
      const magicItemTypeEntries = [{ min: 1, max: 100, type: 'Potion' }];
      const potionEntries = [
        { name: 'Healing Draught', value: 500, summary: 'Heals' },
        { name: 'Fire Resistance', value: 600, summary: 'Resists fire' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        magicItemType: magicItemTypeEntries,
        potions: potionEntries,
      });

      // d100: 1 (hit, chance=100)
      // Item 1: d100=50 → Potion, pick index 0 → Healing Draught
      // Item 2: d100=50 → Potion, pick index 1 → Fire Resistance
      const random = new SequenceRandom([
        d100(1), // chance hit
        d100(50), // item 1 type
        0 / 2, // item 1 pick → index 0
        d100(50), // item 2 type
        1 / 2, // item 2 pick → index 1
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(2);
      expect(result.magicItems[0].name).toBe('Healing Draught');
      expect(result.magicItems[1].name).toBe('Fire Resistance');
    });

    it('should handle "N potions" items string', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 3400,
        chance: 100,
        items: '2d4 potions',
      };
      const potionEntries = [
        { name: 'Minor Heal', value: 200, summary: 'Minor healing' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        potions: potionEntries,
      });

      // d100: 1 (hit)
      // 2d4 for count: 2 + 3 = 5
      // 5 potions, each picked from 1-entry list → index 0
      const random = new SequenceRandom([
        d100(1), // chance hit
        dN(2, 4), // 2d4 die 1 → 2
        dN(3, 4), // 2d4 die 2 → 3
        0,
        0,
        0,
        0,
        0, // 5 potion picks
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(5);
      result.magicItems.forEach((item: RolledMagicItem) => {
        expect(item.category).toBe('Potion');
        expect(item.name).toBe('Minor Heal');
      });
    });

    it('should handle "N scrolls / books" items string', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 3500,
        chance: 100,
        items: '1d4 scrolls / books',
      };
      // Scroll / book category maps to the summary table key
      // We treat "Scroll / book" as a named item category
      const magicItemTypeEntries = [
        { min: 83, max: 97, type: 'Scroll / book' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        magicItemType: magicItemTypeEntries,
      });

      // d100: 1 (hit)
      // 1d4 for count: 2
      // Each scroll: just produce a generic Scroll / book entry
      const random = new SequenceRandom([
        d100(1), // chance hit
        dN(2, 4), // 1d4 → 2 scrolls
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(2);
      result.magicItems.forEach((item: RolledMagicItem) => {
        expect(item.category).toBe('Scroll / book');
      });
    });

    it('should handle items string with mixed types: "2 items (roll type) + 1 potion"', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 2100,
        chance: 100,
        items: '2 items (roll type) + 1 potion',
      };
      const magicItemTypeEntries = [
        { min: 1, max: 100, type: 'Amulet / talisman' },
      ];
      const amuletEntries = [
        { name: 'Ward Charm', value: 1000, summary: 'Wards evil' },
      ];
      const potionEntries = [
        { name: 'Vigor Tonic', value: 300, summary: 'Restores vigor' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        magicItemType: magicItemTypeEntries,
        amulets: amuletEntries,
        potions: potionEntries,
      });

      // d100: 1 (hit)
      // 2 items (roll type):
      //   Item 1: d100=50 → Amulet, pick index 0
      //   Item 2: d100=50 → Amulet, pick index 0
      // 1 potion: pick index 0
      const random = new SequenceRandom([
        d100(1), // chance hit
        d100(50),
        0, // item 1 type + pick
        d100(50),
        0, // item 2 type + pick
        0, // potion pick
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(3);
      expect(result.magicItems[0].category).toBe('Amulet / talisman');
      expect(result.magicItems[1].category).toBe('Amulet / talisman');
      expect(result.magicItems[2].category).toBe('Potion');
    });

    it('should handle "N items (roll type) + 1 scroll / book"', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 5300,
        chance: 100,
        items: '3 items (roll type) + 1 scroll / book',
      };
      const magicItemTypeEntries = [{ min: 1, max: 100, type: 'Potion' }];
      const potionEntries = [
        { name: 'Speed Draft', value: 400, summary: 'Grants speed' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        magicItemType: magicItemTypeEntries,
        potions: potionEntries,
      });

      // d100: 1 (hit)
      // 3 items: each d100 + pick
      // 1 scroll / book
      const random = new SequenceRandom([
        d100(1), // chance hit
        d100(50),
        0, // item 1
        d100(50),
        0, // item 2
        d100(50),
        0, // item 3
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(4);
      expect(result.magicItems[3].category).toBe('Scroll / book');
    });
  });

  describe('given a mixed spec with C, R, and M codes', () => {
    it('should combine all treasure types and compute totalValue', () => {
      const coinsTier = {
        type: 'C1',
        averageValue: 25,
        copper: { chance: 100, quantity: '1d4 × 100' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const richesTier = {
        type: 'R1',
        averageValue: 250,
        gems: { chance: 100, quantity: '1d4 gems' },
        artObjects: null,
      };
      const gemValueEntries = [
        { min: 1, max: 100, category: 'Ornamental', value: 10 },
      ];
      const gemTypes = { Ornamental: ['Agate'] };
      const magicTier = {
        type: 'M1',
        averageValue: 670,
        chance: 100,
        items: '1 item (roll type)',
      };
      const magicItemTypeEntries = [{ min: 1, max: 100, type: 'Potion' }];
      const potionEntries = [
        { name: 'Elixir', value: 500, summary: 'An elixir' },
      ];

      const tables = makeMinimalTables({
        coins: [coinsTier],
        riches: [richesTier],
        magicItems: [magicTier],
        gemValue: gemValueEntries,
        gemType: gemTypes,
        magicItemType: magicItemTypeEntries,
        potions: potionEntries,
      });

      // C1: d100 copper hit → 1d4=3 → 300cp
      // R1: d100 gems hit → 1d4=1 gem → d100=50 → Ornamental 10gp, pick Agate
      // M1: d100 hit → d100=50 → Potion, pick Elixir
      const random = new SequenceRandom([
        d100(1),
        dN(3, 4), // C1 copper
        d100(1),
        dN(1, 4), // R1 gems: hit, 1 gem
        d100(50),
        0, // gem value + type pick
        d100(1), // M1 chance hit
        d100(50),
        0, // item type + pick
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [
          { tier: 'C', level: 1 },
          { tier: 'R', level: 1 },
          { tier: 'M', level: 1 },
        ],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      // 300cp = 3gp, 1 gem at 10gp, 1 magic item at 500gp
      // totalValue = copper_in_gp + silver_in_gp + gold + pellucidium_in_gp + gem_values + art_values + magic_values
      expect(result.coins.copper).toBe(300);
      expect(result.gems).toHaveLength(1);
      expect(result.magicItems).toHaveLength(1);
      expect(result.totalValue).toBe(3 + 10 + 500);
    });
  });

  describe('given quantity strings with varied formats', () => {
    it('should parse "1d4 × 1,000" correctly', () => {
      const tier = {
        type: 'C1',
        averageValue: 25,
        copper: { chance: 100, quantity: '1d4 × 1,000' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=2 → 2 × 1000 = 2000
      const random = new SequenceRandom([d100(1), dN(2, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.copper).toBe(2000);
    });

    it('should parse "1d4 × 10,000" correctly', () => {
      const tier = {
        type: 'C1',
        averageValue: 25000,
        copper: null,
        silver: null,
        gold: { chance: 100, quantity: '1d4 × 10,000' },
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=3 → 3 × 10000 = 30000
      const random = new SequenceRandom([d100(1), dN(3, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.gold).toBe(30000);
    });

    it('should handle quantity with unit suffix like "1d4 × 1,000cp"', () => {
      const tier = {
        type: 'C1',
        averageValue: 25,
        copper: { chance: 100, quantity: '1d4 × 1,000cp' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=4 → 4 × 1000 = 4000
      const random = new SequenceRandom([d100(1), dN(4, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.copper).toBe(4000);
    });

    it('should handle quantity "1d4 gems" (extracting dice part)', () => {
      const richesTier = {
        type: 'R1',
        averageValue: 100,
        gems: { chance: 100, quantity: '1d4 gems' },
        artObjects: null,
      };
      const gemValueEntries = [
        { min: 1, max: 100, category: 'Ornamental', value: 10 },
      ];
      const gemTypes = { Ornamental: ['Topaz'] };

      const tables = makeMinimalTables({
        riches: [richesTier],
        gemValue: gemValueEntries,
        gemType: gemTypes,
      });

      // d100 gems hit, 1d4=3 → 3 gems
      const random = new SequenceRandom([
        d100(1),
        dN(3, 4), // hit + quantity
        d100(50),
        0, // gem 1
        d100(50),
        0, // gem 2
        d100(50),
        0, // gem 3
      ]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'R', level: 1 }],
        extras: [],
      });
      expect(result.gems).toHaveLength(3);
    });

    it('should handle quantity "1d4 × 10 objects"', () => {
      const richesTier = {
        type: 'R1',
        averageValue: 18000,
        gems: null,
        artObjects: { chance: 100, quantity: '1d4 × 10 objects' },
      };
      const jewelleryEntries = [{ min: 1, max: 100, type: 'Ring' }];
      const materials = [{ roll: 1, value: 'Iron' }];
      const embellishmentEntries = [{ roll: 1, value: 'Plain' }];

      const tables = makeMinimalTables({
        riches: [richesTier],
        jewellery: jewelleryEntries,
        preciousMaterials: materials,
        embellishments: embellishmentEntries,
      });

      // d100 artObjects hit, 1d4=2 → 2 × 10 = 20 objects
      // For each: d100 jewellery-or-misc, d100 type, d20 material, d20 embellishment, 3d6 value
      const values: number[] = [d100(1), dN(2, 4)]; // hit + quantity
      for (let i = 0; i < 20; i++) {
        values.push(
          d100(1), // jewellery-or-misc
          d100(1), // jewellery type → Ring
          dN(1, 20), // material → Iron
          dN(1, 20), // embellishment → Plain
          dN(3, 6),
          dN(3, 6),
          dN(3, 6), // 3d6 value
        );
      }
      const random = new SequenceRandom(values);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'R', level: 1 }],
        extras: [],
      });
      expect(result.artObjects).toHaveLength(20);
    });
  });

  describe('given an M1 "armour or weapon" items string', () => {
    it('should produce one armour or weapon magic item', () => {
      const magicTier = {
        type: 'M1',
        averageValue: 670,
        chance: 100,
        items: '1 armour or weapon (equal chance of either)',
      };
      const magicItemTypeEntries = [
        { min: 6, max: 20, type: 'Magic armour' },
        { min: 38, max: 62, type: 'Magic weapon' },
      ];

      const tables = makeMinimalTables({
        magicItems: [magicTier],
        magicItemType: magicItemTypeEntries,
      });

      // d100: 1 (hit)
      // 50/50 armour or weapon: next() < 0.5 → armour
      const random = new SequenceRandom([
        d100(1), // chance hit
        0.3, // armour-or-weapon → armour (< 0.5)
      ]);
      const gen = new TreasureGenerator(tables, random);

      const spec: TreasureSpec = {
        codes: [{ tier: 'M', level: 1 }],
        extras: [],
      };
      const result = gen.rollHoard(spec);

      expect(result.magicItems).toHaveLength(1);
      expect(result.magicItems[0].category).toBe('Magic armour');
    });
  });

  describe('totalValue calculation', () => {
    it('should convert copper to gp at 100:1 ratio', () => {
      const tier = {
        type: 'C1',
        averageValue: 10,
        copper: { chance: 100, quantity: '1d4 × 100' },
        silver: null,
        gold: null,
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=1 → 100cp = 1gp
      const random = new SequenceRandom([d100(1), dN(1, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.copper).toBe(100);
      expect(result.totalValue).toBe(1);
    });

    it('should convert silver to gp at 10:1 ratio', () => {
      const tier = {
        type: 'C1',
        averageValue: 10,
        copper: null,
        silver: { chance: 100, quantity: '1d4 × 10' },
        gold: null,
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=1 → 10sp = 1gp
      const random = new SequenceRandom([d100(1), dN(1, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.silver).toBe(10);
      expect(result.totalValue).toBe(1);
    });

    it('should count gold at 1:1 ratio', () => {
      const tier = {
        type: 'C1',
        averageValue: 50,
        copper: null,
        silver: null,
        gold: { chance: 100, quantity: '1d4' },
        pellucidium: null,
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=3 → 3gp
      const random = new SequenceRandom([d100(1), dN(3, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.gold).toBe(3);
      expect(result.totalValue).toBe(3);
    });

    it('should convert pellucidium to gp at 5:1 ratio', () => {
      const tier = {
        type: 'C1',
        averageValue: 50,
        copper: null,
        silver: null,
        gold: null,
        pellucidium: { chance: 100, quantity: '1d4' },
      };
      const tables = makeMinimalTables({ coins: [tier] });
      // 1d4=2 → 2pp = 10gp
      const random = new SequenceRandom([d100(1), dN(2, 4)]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'C', level: 1 }],
        extras: [],
      });
      expect(result.coins.pellucidium).toBe(2);
      expect(result.totalValue).toBe(10);
    });
  });

  describe('gem category casing normalization', () => {
    it('should handle gemValue "Semi-precious" mapping to gemType "Semi-Precious"', () => {
      const richesTier = {
        type: 'R1',
        averageValue: 100,
        gems: { chance: 100, quantity: '1d4 gems' },
        artObjects: null,
      };
      const gemValueEntries = [
        { min: 1, max: 100, category: 'Semi-precious', value: 50 },
      ];
      // Note: gemType uses "Semi-Precious" (capital P)
      const gemTypes = { 'Semi-Precious': ['Bloodstone', 'Carnelian'] };

      const tables = makeMinimalTables({
        riches: [richesTier],
        gemValue: gemValueEntries,
        gemType: gemTypes,
      });

      // 1 gem
      const random = new SequenceRandom([
        d100(1), // gems chance hit
        dN(1, 4), // 1d4 → 1 gem
        d100(50), // gem value → Semi-precious
        0, // gem type pick → index 0 → Bloodstone
      ]);
      const gen = new TreasureGenerator(tables, random);

      const result = gen.rollHoard({
        codes: [{ tier: 'R', level: 1 }],
        extras: [],
      });

      expect(result.gems).toHaveLength(1);
      expect(result.gems[0].type).toBe('Bloodstone');
      expect(result.gems[0].value).toBe(50);
    });
  });
});
