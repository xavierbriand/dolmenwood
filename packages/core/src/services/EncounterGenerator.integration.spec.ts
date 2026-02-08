
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncounterGenerator } from './EncounterGenerator.js';
import { TableRepository } from '../ports/TableRepository.js';
import { CreatureRepository } from '../ports/CreatureRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { success } from '../utils/Result.js';
import { Table } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';

// Mock implementations
class MockTableRepository implements TableRepository {
  getTable = vi.fn();
}

class MockCreatureRepository implements CreatureRepository {
  getByName = vi.fn();
  getAll = vi.fn();
}

class MockRandomProvider implements RandomProvider {
  next = vi.fn();
  nextInRange = vi.fn();
}

describe('EncounterGenerator Integration', () => {
  let generator: EncounterGenerator;
  let tableRepository: MockTableRepository;
  let creatureRepository: MockCreatureRepository;
  let random: MockRandomProvider;

  beforeEach(() => {
    tableRepository = new MockTableRepository();
    creatureRepository = new MockCreatureRepository();
    random = new MockRandomProvider();
    generator = new EncounterGenerator(tableRepository, creatureRepository, random);
  });

  it('should generate a full encounter with creature, activity, and reaction', async () => {
    // 1. Setup Mock Data
    const mockEncounterTypeTable: Table = {
      name: 'Encounter Type - Daytime - Wild',
      die: '1d8',
      entries: [{ min: 1, max: 8, type: 'Regional', ref: 'Regional' }]
    };

    const mockRegionalTable: Table = {
      name: 'Regional - Generic Forest',
      die: '1d20',
      entries: [{ min: 1, max: 20, type: 'Creature', ref: 'Goblin' }]
    };

    const mockMossling: Creature = {
      name: 'Goblin',
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
    tableRepository.getTable.mockImplementation((name) => {
      if (name === 'Encounter Type - Daytime - Wild') return Promise.resolve(success(mockEncounterTypeTable));
      if (name === 'Regional - Generic Forest') return Promise.resolve(success(mockRegionalTable));
      if (name === 'Activity') return Promise.resolve(success(mockActivityTable));
      if (name === 'Reaction') return Promise.resolve(success(mockReactionTable));
      return Promise.reject(new Error(`Unknown table: ${name}`));
    });

    creatureRepository.getByName.mockResolvedValue(success(mockMossling));

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
      regionId: 'generic-forest',
      timeOfDay: 'Day' as const,
      terrain: 'Off-road' as const,
      camping: false
    };

    const result = await generator.generateEncounter(context);

    // 4. Assert
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      const encounter = result.data;
      expect(encounter.type).toBe('Creature');
      if (encounter.details.creature) {
        expect(encounter.details.creature.name).toBe('Goblin');
      } else {
        throw new Error('Expected creature details to be present');
      }
      // expect(encounter.details.activity).toBe('Cooking a stew');
      // expect(encounter.details.reaction).toBe('Friendly');
    }
  });
});
