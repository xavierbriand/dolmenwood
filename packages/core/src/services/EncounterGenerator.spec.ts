import { describe, it, expect } from 'vitest';
import { EncounterGenerator } from './EncounterGenerator.js';
import { TableRepository } from '../ports/TableRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { Result, success, failure } from '../utils/Result.js';
import { RegionTable } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';

class MockTableRepository implements TableRepository {
  private tables = new Map<string, RegionTable>();
  private creatures = new Map<string, Creature>();

  addTable(table: RegionTable) {
    this.tables.set(table.name, table);
  }

  addCreature(creature: Creature) {
    this.creatures.set(creature.name, creature);
  }

  async getTable(name: string): Promise<Result<RegionTable>> {
    const table = this.tables.get(name);
    return table ? success(table) : failure(new Error('Table not found'));
  }

  async getCreature(name: string): Promise<Result<Creature>> {
    const creature = this.creatures.get(name);
    return creature ? success(creature) : failure(new Error('Creature not found'));
  }
}

class MockRandom implements RandomProvider {
  // Returns 0.5 to force middle results or predictable ones
  next(): number { return 0.5; } 
}

describe('EncounterGenerator', () => {
  it('should generate a creature encounter by following references', async () => {
    const repo = new MockTableRepository();
    
    // Setup Data
    repo.addTable({
      name: 'Root Table',
      die: '1d6',
      entries: [
        { min: 1, max: 6, type: 'Animal', ref: 'Sub Table' }
      ]
    });

    repo.addTable({
      name: 'Sub Table',
      die: '1d6',
      entries: [
        { min: 1, max: 6, type: 'Creature', ref: 'Test Goblin', count: '1d4' }
      ]
    });

    repo.addCreature({
      name: 'Test Goblin',
      level: 1,
      alignment: 'Neutral',
      xp: 10,
      numberAppearing: '2d4',
      armourClass: 10,
      movement: 30,
      hitDice: '1d6',
      attacks: ['Club'],
      morale: 7
    });

    const generator = new EncounterGenerator(repo, new MockRandom());
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
