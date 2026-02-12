export function coreHello(): string {
  return 'Hello from Core';
}

export * from './schemas/encounter.js';
export * from './schemas/creature.js';
export * from './schemas/tables.js';
export * from './ports/RandomProvider.js';
export * from './ports/TableRepository.js';
export * from './ports/CreatureRepository.js';
export * from './utils/Result.js';
export * from './engine/Dice.js';
export * from './engine/TableRoller.js';
export * from './services/EncounterGenerator.js';
export * from './services/SessionService.js';
export * from './schemas/session.js';
export * from './ports/SessionRepository.js';
export * from './schemas/treasure.js';
