import { describe, it, expect } from 'vitest';
import {
  ChanceQuantitySchema,
  CoinsTierSchema,
  RichesTierSchema,
  MagicTierSchema,
  RangeEntrySchema,
  RollEntrySchema,
  CoinAppearanceSchema,
  GemValueEntrySchema,
  NamedItemSchema,
  GenerationSubTableRowSchema,
  TreasureTablesSchema,
  TreasureSpecSchema,
  RolledTreasureSchema,
} from './treasure.js';

describe('Treasure Schemas', () => {
  describe('ChanceQuantitySchema', () => {
    it('should validate a chance/quantity pair', () => {
      const result = ChanceQuantitySchema.safeParse({
        chance: 25,
        quantity: '1d4 × 1,000cp',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing chance', () => {
      const result = ChanceQuantitySchema.safeParse({
        quantity: '1d4 × 1,000cp',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing quantity', () => {
      const result = ChanceQuantitySchema.safeParse({ chance: 25 });
      expect(result.success).toBe(false);
    });
  });

  describe('CoinsTierSchema', () => {
    it('should validate a full coins tier with all denominations', () => {
      const result = CoinsTierSchema.safeParse({
        type: 'C7',
        averageValue: 4700,
        copper: { chance: 10, quantity: '1d10 × 1,000cp' },
        silver: { chance: 15, quantity: '1d12 × 1,000sp' },
        gold: { chance: 60, quantity: '1d8 × 1,000gp' },
        pellucidium: { chance: 5, quantity: '1d4 × 100pp' },
      });
      expect(result.success).toBe(true);
    });

    it('should validate a coins tier with null denominations', () => {
      const result = CoinsTierSchema.safeParse({
        type: 'C1',
        averageValue: 25,
        copper: { chance: 25, quantity: '1d4 × 1,000cp' },
        silver: { chance: 10, quantity: '1d3 × 1,000sp' },
        gold: null,
        pellucidium: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gold).toBeNull();
        expect(result.data.pellucidium).toBeNull();
      }
    });

    it('should reject coins tier missing type', () => {
      const result = CoinsTierSchema.safeParse({
        averageValue: 25,
        copper: null,
        silver: null,
        gold: null,
        pellucidium: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RichesTierSchema', () => {
    it('should validate a riches tier with both gems and art objects', () => {
      const result = RichesTierSchema.safeParse({
        type: 'R2',
        averageValue: 600,
        gems: { chance: 60, quantity: '1d6 gems' },
        artObjects: { chance: 30, quantity: '1d4 objects' },
      });
      expect(result.success).toBe(true);
    });

    it('should validate a riches tier with null fields', () => {
      const result = RichesTierSchema.safeParse({
        type: 'R1',
        averageValue: 250,
        gems: { chance: 50, quantity: '1d4 gems' },
        artObjects: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artObjects).toBeNull();
      }
    });
  });

  describe('MagicTierSchema', () => {
    it('should validate a magic items tier', () => {
      const result = MagicTierSchema.safeParse({
        type: 'M1',
        averageValue: 670,
        chance: 10,
        items: '1 armour or weapon (equal chance of either)',
      });
      expect(result.success).toBe(true);
    });

    it('should reject magic tier missing items', () => {
      const result = MagicTierSchema.safeParse({
        type: 'M1',
        averageValue: 670,
        chance: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RangeEntrySchema', () => {
    it('should validate a range entry with type', () => {
      const result = RangeEntrySchema.safeParse({
        min: 1,
        max: 5,
        type: 'Amulet / talisman',
      });
      expect(result.success).toBe(true);
    });

    it('should validate a range entry with description and averageValue', () => {
      const result = RangeEntrySchema.safeParse({
        min: 1,
        max: 16,
        description: 'Coins (1d4 × 1,000gp)',
        averageValue: 2000,
      });
      expect(result.success).toBe(true);
    });

    it('should validate a range entry with null averageValue', () => {
      const result = RangeEntrySchema.safeParse({
        min: 97,
        max: 100,
        description: 'Special treasure',
        averageValue: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.averageValue).toBeNull();
      }
    });

    it('should validate a gem value entry with category and value', () => {
      const result = RangeEntrySchema.safeParse({
        min: 1,
        max: 20,
        category: 'Ornamental',
        value: 10,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RollEntrySchema', () => {
    it('should validate a roll entry', () => {
      const result = RollEntrySchema.safeParse({ roll: 1, value: 'Alabaster' });
      expect(result.success).toBe(true);
    });

    it('should reject missing roll', () => {
      const result = RollEntrySchema.safeParse({ value: 'Alabaster' });
      expect(result.success).toBe(false);
    });
  });

  describe('CoinAppearanceSchema', () => {
    it('should validate a coin appearance with head and tail', () => {
      const result = CoinAppearanceSchema.safeParse({
        roll: 1,
        head: 'Baron Hogwarsh',
        tail: 'Acorn',
      });
      expect(result.success).toBe(true);
    });

    it('should validate a coin appearance without tail (optional)', () => {
      const result = CoinAppearanceSchema.safeParse({
        roll: 4,
        head: 'Duke Malgrave',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tail).toBeUndefined();
      }
    });
  });

  describe('GemValueEntrySchema', () => {
    it('should validate a gem value entry', () => {
      const result = GemValueEntrySchema.safeParse({
        min: 1,
        max: 20,
        category: 'Ornamental',
        value: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing category', () => {
      const result = GemValueEntrySchema.safeParse({
        min: 1,
        max: 20,
        value: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NamedItemSchema', () => {
    it('should validate a named magic item', () => {
      const result = NamedItemSchema.safeParse({
        name: 'Amulet of Breath',
        value: 5000,
        summary: 'Breathe in air and underwater',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing summary', () => {
      const result = NamedItemSchema.safeParse({
        name: 'Amulet of Breath',
        value: 5000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GenerationSubTableRowSchema', () => {
    it('should validate a row with min/max range', () => {
      const result = GenerationSubTableRowSchema.safeParse({
        min: 1,
        max: 10,
        cells: ['Leather armour', '6,000'],
      });
      expect(result.success).toBe(true);
    });

    it('should validate a row with single roll', () => {
      const result = GenerationSubTableRowSchema.safeParse({
        roll: 1,
        cells: ['Acid resistance', 'Accelerating', 'Arcane ward'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject a row with no roll and no min/max', () => {
      const result = GenerationSubTableRowSchema.safeParse({
        cells: ['Leather armour', '6,000'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject a row with empty cells', () => {
      const result = GenerationSubTableRowSchema.safeParse({
        roll: 1,
        cells: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TreasureTablesSchema', () => {
    const minimalTables = {
      coins: [
        {
          type: 'C1',
          averageValue: 25,
          copper: { chance: 25, quantity: '1d4 × 1,000cp' },
          silver: null,
          gold: null,
          pellucidium: null,
        },
      ],
      riches: [
        {
          type: 'R1',
          averageValue: 250,
          gems: { chance: 50, quantity: '1d4 gems' },
          artObjects: null,
        },
      ],
      magicItems: [
        {
          type: 'M1',
          averageValue: 670,
          chance: 10,
          items: '1 armour or weapon',
        },
      ],
      magicItemType: [{ min: 1, max: 5, type: 'Amulet / talisman' }],
      treasureHoard: [
        {
          min: 1,
          max: 16,
          description: 'Coins',
          averageValue: 2000,
        },
      ],
      coinAppearance: [{ roll: 1, head: 'Baron Hogwarsh', tail: 'Acorn' }],
      gemValue: [{ min: 1, max: 20, category: 'Ornamental', value: 10 }],
      gemType: { Ornamental: ['Azurite', 'Banded agate'] },
      jewellery: [{ min: 1, max: 3, type: 'Anklet' }],
      miscArtObjects: [{ min: 1, max: 1, type: 'Armour' }],
      preciousMaterials: [{ roll: 1, value: 'Alabaster' }],
      embellishments: [{ roll: 1, value: 'Adorned with feathers' }],
      provenance: [{ roll: 1, value: 'Another world' }],
      amulets: [
        {
          name: 'Amulet of Breath',
          value: 5000,
          summary: 'Breathe in air and underwater',
        },
      ],
      magicBalms: [
        {
          name: 'Balm of Healing',
          value: 1000,
          summary: 'Heals minor wounds',
        },
      ],
      magicCrystals: [
        {
          name: 'Crystal of Light',
          value: 2000,
          summary: 'Emits bright light',
        },
      ],
      magicGarments: [
        {
          name: 'Cloak of Shadows',
          value: 3000,
          summary: 'Blend into darkness',
        },
      ],
      magicRings: [
        {
          name: 'Ring of Protection',
          value: 4000,
          summary: 'Magical protection',
        },
      ],
      potions: [
        {
          name: 'Potion of Healing',
          value: 500,
          summary: 'Restores health',
        },
      ],
      wondrousItems: [
        {
          name: 'Bag of Holding',
          value: 10000,
          summary: 'Holds many items',
        },
      ],
      magicArmour: {
        armourType: [{ min: 1, max: 10, cells: ['Leather armour', '6,000'] }],
      },
      magicInstruments: {
        instrumentType: [{ roll: 6, cells: ['Harp', 'String'] }],
      },
      magicWeapons: {
        weaponType: [{ min: 1, max: 5, cells: ['Battle axe', '8,000'] }],
      },
      rodsStavesWands: {
        rodStaffWandType: [{ roll: 1, cells: ['Rod', 'Holy', '1d10'] }],
      },
      scrollsBooks: {
        scrollBookType: [{ min: 1, max: 20, cells: ['Spell scroll', '500'] }],
      },
    };

    it('should validate a minimal complete treasure tables structure', () => {
      const result = TreasureTablesSchema.safeParse(minimalTables);
      expect(result.success).toBe(true);
    });

    it('should reject treasure tables with missing coins', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { coins: _coins, ...withoutCoins } = minimalTables;
      const result = TreasureTablesSchema.safeParse(withoutCoins);
      expect(result.success).toBe(false);
    });

    it('should reject treasure tables with missing riches', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { riches: _riches, ...withoutRiches } = minimalTables;
      const result = TreasureTablesSchema.safeParse(withoutRiches);
      expect(result.success).toBe(false);
    });

    it('should reject treasure tables with invalid nested data', () => {
      const badTables = {
        ...minimalTables,
        coins: [{ type: 'C1', averageValue: 'not a number' }],
      };
      const result = TreasureTablesSchema.safeParse(badTables);
      expect(result.success).toBe(false);
    });
  });

  describe('TreasureSpecSchema', () => {
    it('should validate a simple treasure spec with one code', () => {
      const result = TreasureSpecSchema.safeParse({
        codes: [{ tier: 'C', level: 4 }],
        extras: [],
      });
      expect(result.success).toBe(true);
    });

    it('should validate a multi-code treasure spec', () => {
      const result = TreasureSpecSchema.safeParse({
        codes: [
          { tier: 'C', level: 4 },
          { tier: 'R', level: 4 },
          { tier: 'M', level: 1 },
        ],
        extras: [],
      });
      expect(result.success).toBe(true);
    });

    it('should validate a treasure spec with extras', () => {
      const result = TreasureSpecSchema.safeParse({
        codes: [{ tier: 'C', level: 6 }],
        extras: ['1d6 potions'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extras).toEqual(['1d6 potions']);
      }
    });

    it('should reject invalid tier', () => {
      const result = TreasureSpecSchema.safeParse({
        codes: [{ tier: 'X', level: 1 }],
        extras: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject level out of range (0)', () => {
      const result = TreasureSpecSchema.safeParse({
        codes: [{ tier: 'C', level: 0 }],
        extras: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject level out of range (13)', () => {
      const result = TreasureSpecSchema.safeParse({
        codes: [{ tier: 'C', level: 13 }],
        extras: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RolledTreasureSchema', () => {
    it('should validate a fully rolled treasure result', () => {
      const result = RolledTreasureSchema.safeParse({
        coins: {
          copper: 4000,
          silver: 3000,
          gold: 0,
          pellucidium: 0,
        },
        gems: [{ type: 'Azurite', category: 'Ornamental', value: 10 }],
        artObjects: [
          {
            type: 'Anklet',
            material: 'Alabaster',
            embellishment: 'Adorned with feathers',
            value: 150,
          },
        ],
        magicItems: [
          {
            category: 'Amulet / talisman',
            name: 'Amulet of Breath',
            value: 5000,
          },
        ],
        totalValue: 12160,
      });
      expect(result.success).toBe(true);
    });

    it('should validate an empty rolled treasure', () => {
      const result = RolledTreasureSchema.safeParse({
        coins: { copper: 0, silver: 0, gold: 0, pellucidium: 0 },
        gems: [],
        artObjects: [],
        magicItems: [],
        totalValue: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should allow art objects without optional fields', () => {
      const result = RolledTreasureSchema.safeParse({
        coins: { copper: 0, silver: 0, gold: 0, pellucidium: 0 },
        gems: [],
        artObjects: [{ type: 'Painting', value: 500 }],
        magicItems: [],
        totalValue: 500,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing totalValue', () => {
      const result = RolledTreasureSchema.safeParse({
        coins: { copper: 0, silver: 0, gold: 0, pellucidium: 0 },
        gems: [],
        artObjects: [],
        magicItems: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
