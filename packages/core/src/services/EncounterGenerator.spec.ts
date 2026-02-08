import { describe, it, expect } from 'vitest';
import { EncounterGenerator } from './EncounterGenerator.js';
import { TableRepository } from '../ports/TableRepository.js';
import { CreatureRepository } from '../ports/CreatureRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { Result, success, failure } from '../utils/Result.js';
import { RegionTable } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';

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

class MockRandom implements RandomProvider {
  // Returns 0.5 to force middle results or predictable ones
  next(): number {
    return 0.5;
  }
}

describe('EncounterGenerator', () => {
  it('should generate a creature encounter by following references', async () => {
    const tableRepo = new MockTableRepository();
    const creatureRepo = new MockCreatureRepository();

    // Setup Data
    tableRepo.addTable({
      name: 'Root Table',
      die: '1d6',
      entries: [{ min: 1, max: 6, type: 'Animal', ref: 'Sub Table' }],
    });

    tableRepo.addTable({
      name: 'Sub Table',
      die: '1d6',
      entries: [
        { min: 1, max: 6, type: 'Creature', ref: 'Test Goblin', count: '1d4' },
      ],
    });

    creatureRepo.addCreature({
      name: 'Test Goblin',
      level: 1,
      alignment: 'Neutral',
      xp: 10,
      numberAppearing: '2d4',
      armourClass: 10,
      movement: 30,
      hitDice: '1d6',
      attacks: ['Club'],
      morale: 7,
    });

    const generator = new EncounterGenerator(
      tableRepo,
      creatureRepo,
      new MockRandom(),
    );
    const result = await generator.generate('Root Table');

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.kind).toBe('creature');
      if (result.data.kind === 'creature') {
        expect(result.data.name).toBe('Test Goblin');
        // MockRandom returns 0.5.
        // 1d4 count: floor(0.5 * 4) + 1 = 2 + 1 = 3
        expect(result.data.count).toBe(3);
      }
    }
  });
});
