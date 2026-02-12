import { describe, it, expect } from 'vitest';
import { JsonTreasureTableRepository } from './JsonTreasureTableRepository.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('JsonTreasureTableRepository', () => {
  const fixturesDir = join(__dirname, '../../tests/fixtures');

  describe('given a valid treasure-tables.json fixture', () => {
    const repo = new JsonTreasureTableRepository(
      join(fixturesDir, 'treasure-tables.json'),
    );

    it('should load and validate the treasure tables', async () => {
      const result = await repo.getTreasureTables();
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.data.coins).toHaveLength(1);
        expect(result.data.coins[0].type).toBe('C1');
        expect(result.data.riches).toHaveLength(1);
        expect(result.data.magicItems).toHaveLength(1);
        expect(result.data.potions).toHaveLength(1);
        expect(result.data.potions[0].name).toBe('Test Potion');
      }
    });

    it('should cache the result on subsequent calls', async () => {
      const result1 = await repo.getTreasureTables();
      const result2 = await repo.getTreasureTables();
      expect(result1.kind).toBe('success');
      expect(result2.kind).toBe('success');
      if (result1.kind === 'success' && result2.kind === 'success') {
        // Same reference — cached
        expect(result1.data).toBe(result2.data);
      }
    });
  });

  describe('given a non-existent file', () => {
    const repo = new JsonTreasureTableRepository(
      join(fixturesDir, 'does-not-exist.json'),
    );

    it('should return a failure result', async () => {
      const result = await repo.getTreasureTables();
      expect(result.kind).toBe('failure');
    });
  });

  describe('given an invalid JSON file', () => {
    // creatures.yaml is valid YAML but not valid TreasureTables JSON
    const repo = new JsonTreasureTableRepository(
      join(fixturesDir, 'creatures.yaml'),
    );

    it('should return a failure result', async () => {
      const result = await repo.getTreasureTables();
      expect(result.kind).toBe('failure');
    });
  });
});
