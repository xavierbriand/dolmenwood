import { describe, it, expect } from 'vitest';
import { EncounterGenerator } from './EncounterGenerator.js';
import { TableRepository } from '../ports/TableRepository.js';
import { CreatureRepository } from '../ports/CreatureRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { success, failure, Result } from '../utils/Result.js';
import { RegionTable } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';

class MockTableRepository implements TableRepository {
  private tables = new Map<string, RegionTable>();

  addTable(table: RegionTable) {
    this.tables.set(table.name, table);
  }

  async getTable(name: string): Promise<Result<RegionTable>> {
    const table = this.tables.get(name);
    return table
      ? success(table)
      : failure(new Error(`Table '${name}' not found`));
  }

  async listTables(): Promise<Result<RegionTable[]>> {
    return success(Array.from(this.tables.values()));
  }
}

class MockCreatureRepository implements CreatureRepository {
  async getByName(name: string): Promise<Result<Creature, string>> {
    return success({
      name,
      level: 1,
      alignment: 'Neutral',
      xp: 10,
      numberAppearing: '1',
      armourClass: 10,
      movement: 30,
      hitDice: '1d6',
      attacks: ['None'],
      morale: 7,
    });
  }

  async getAll(): Promise<Result<Creature[], string>> {
    return success([]);
  }
}

class MockRandom implements RandomProvider {
  next(): number {
    return 0.5;
  }
}

describe('EncounterGenerator - Recursive & Contextual', () => {
  it('should fallback to localized table if base table not found', async () => {
    const tableRepo = new MockTableRepository();
    const generator = new EncounterGenerator(
      tableRepo,
      new MockCreatureRepository(),
      new MockRandom(),
    );

    // Setup:
    // Root Table refers to "Common - Animal"
    // "Common - Animal" does NOT exist.
    // "Common - Animal - Test Region" DOES exist.

    tableRepo.addTable({
      name: 'Root Table',
      die: '1d6',
      entries: [{ min: 1, max: 6, type: 'Animal', ref: 'Common - Animal' }],
    });

    tableRepo.addTable({
      name: 'Common - Animal - Test Region',
      die: '1d6',
      entries: [{ min: 1, max: 6, type: 'Creature', ref: 'Wolf' }],
    });

    const result = await generator.generate('Root Table', {
      regionId: 'test-region',
      timeOfDay: 'Day',
      terrain: 'Off-road',
      camping: false,
    });

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.kind).toBe('creature');
      expect(result.data.name).toBe('Wolf');
    }
  });
});
