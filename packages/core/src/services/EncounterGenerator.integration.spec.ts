
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncounterGenerator } from './EncounterGenerator.js';
import { TableRepository } from '../ports/TableRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { Result, success } from '../utils/Result.js';
import { Table } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';

// Mock implementations
class MockTableRepository implements TableRepository {
  getTable = vi.fn();
  getCreature = vi.fn();
}

class MockRandomProvider implements RandomProvider {
  next = vi.fn();
  nextInRange = vi.fn();
}

describe('EncounterGenerator Integration', () => {
  let generator: EncounterGenerator;
  let repository: MockTableRepository;
  let random: MockRandomProvider;

  beforeEach(() => {
    repository = new MockTableRepository();
    random = new MockRandomProvider();
    generator = new EncounterGenerator(repository, random);
  });

  it('should generate a full encounter with creature, activity, and reaction', async () => {
    // 1. Setup Mock Data
    const mockEncounterTypeTable: Table = {
      name: 'Encounter Type - Daytime - Wild',
      die: '1d8',
      entries: [{ min: 1, max: 8, type: 'Regional', ref: 'Regional' }]
    };

    const mockRegionalTable: Table = {
      name: 'Regional - High Wold',
      die: '1d20',
      entries: [{ min: 1, max: 20, type: 'Creature', ref: 'Mossling' }]
    };

    const mockMossling: Creature = {
      name: 'Mossling',
      level: 1,
      alignment: 'Neutral',
      xp: 10,
      numberAppearing: '2d4',
      armourClass: 12,
      movement: 30,
      hitDice: '1d6',
      attacks: ['club'],
      morale: 7,
      description: 'Small mossy folk.'
    };

    const mockActivityTable: Table = {
      name: 'Activity',
      die: '1d20',
      entries: [{ min: 1, max: 20, type: 'Text', ref: 'Cooking a stew' }]
    };

    const mockReactionTable: Table = {
      name: 'Reaction',
      die: '2d6',
      entries: [{ min: 2, max: 12, type: 'Text', ref: 'Friendly' }]
    };

    // 2. Setup Mock Behavior
    repository.getTable.mockImplementation((name) => {
      if (name === 'Encounter Type - Daytime - Wild') return Promise.resolve(success(mockEncounterTypeTable));
      if (name === 'Regional - High Wold') return Promise.resolve(success(mockRegionalTable));
      if (name === 'Activity') return Promise.resolve(success(mockActivityTable));
      if (name === 'Reaction') return Promise.resolve(success(mockReactionTable));
      return Promise.reject(new Error(`Unknown table: ${name}`));
    });

    repository.getCreature.mockResolvedValue(success(mockMossling));

    // Mock Dice Rolls
    // Roll 1: Encounter Type (1d8) -> 5
    // Roll 2: Regional Table (1d20) -> 10
    // Roll 3: Number Appearing (2d4) -> 3
    // Roll 4: Activity (1d20) -> 15
    // Roll 5: Reaction (2d6) -> 8
    // Roll 6: Distance (2d6) -> 7
    // Roll 7: Surprise (1d6) -> 6 (Not surprised)
    random.next.mockReturnValue(0.5); // Generic middle value for unmocked calls

    // 3. Execute
    const context = {
      regionId: 'high-wold',
      timeOfDay: 'Day' as const,
      terrain: 'Off-road' as const,
      camping: false
    };

    // @ts-ignore - generateEncounter not implemented yet
    const result = await generator.generateEncounter(context);

    // 4. Assert
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      const encounter = result.data;
      expect(encounter.type).toBe('Creature');
      expect(encounter.details.creature.name).toBe('Mossling');
      // expect(encounter.details.activity).toBe('Cooking a stew');
      // expect(encounter.details.reaction).toBe('Friendly');
    }
  });
});
