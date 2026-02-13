import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadTreasureTables,
  type LoadTreasureDeps,
} from '../../src/steps/load-treasure.js';

/** Minimal valid treasure tables JSON matching TreasureTablesSchema */
const VALID_FIXTURE = JSON.stringify({
  coins: [
    {
      type: 'C1',
      averageValue: 25,
      copper: { chance: 25, quantity: '1d4 × 1,000' },
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
  magicGarments: [{ name: 'Test Cloak', value: 600, summary: 'A test cloak' }],
  magicRings: [{ name: 'Test Ring', value: 700, summary: 'A test ring' }],
  potions: [{ name: 'Test Potion', value: 200, summary: 'A test potion' }],
  wondrousItems: [{ name: 'Test Orb', value: 900, summary: 'A test orb' }],
  magicArmour: {},
  magicInstruments: {},
  magicWeapons: {},
  rodsStavesWands: {},
  scrollsBooks: {},
});

function makeDeps(overrides: Partial<LoadTreasureDeps> = {}): LoadTreasureDeps {
  return {
    readFile: vi.fn().mockResolvedValue(VALID_FIXTURE),
    writeFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('loadTreasureTables', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('given valid treasure tables JSON', () => {
    it('then it reads from the extract path', async () => {
      const deps = makeDeps();

      await loadTreasureTables(deps);

      expect(deps.readFile).toHaveBeenCalledOnce();
      const readPath = (deps.readFile as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(readPath).toContain('dcb-treasure-tables.json');
    });

    it('then it writes validated JSON to the load path', async () => {
      const deps = makeDeps();

      await loadTreasureTables(deps);

      expect(deps.writeFile).toHaveBeenCalledOnce();
      const [writePath, content] = (deps.writeFile as ReturnType<typeof vi.fn>)
        .mock.calls[0] as [string, string];
      expect(writePath).toContain('treasure-tables.json');
      expect(writePath).toContain('load');

      // Output should be valid JSON
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty('coins');
      expect(parsed).toHaveProperty('riches');
      expect(parsed).toHaveProperty('magicItems');
    });

    it('then it pretty-prints the output with 2-space indentation', async () => {
      const deps = makeDeps();

      await loadTreasureTables(deps);

      const content = (deps.writeFile as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as string;
      // Pretty-printed JSON starts with "{\n  "
      expect(content).toMatch(/^\{\n {2}/);
    });
  });

  describe('given malformed JSON', () => {
    it('then it throws a parse error', async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue('not valid json {{{'),
      });

      await expect(loadTreasureTables(deps)).rejects.toThrow();
    });
  });

  describe('given JSON that fails schema validation', () => {
    it('then it throws a validation error', async () => {
      const deps = makeDeps({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            coins: 'not-an-array',
            riches: [],
          }),
        ),
      });

      await expect(loadTreasureTables(deps)).rejects.toThrow(/validation/i);
    });
  });

  describe('given the extract file does not exist', () => {
    it('then it throws with a helpful message', async () => {
      const deps = makeDeps({
        readFile: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('ENOENT: no such file'), {
              code: 'ENOENT',
            }),
          ),
      });

      await expect(loadTreasureTables(deps)).rejects.toThrow(
        /dcb-treasure-tables\.json/i,
      );
    });
  });
});
