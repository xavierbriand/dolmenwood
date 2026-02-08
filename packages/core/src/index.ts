export function coreHello(): string {
  return "Hello from Core";
}

export * from './schemas/encounter.js';
export * from './schemas/tables.js';
export * from './ports/RandomProvider.js';
export * from './ports/TableRepository.js';
export * from './utils/Result.js';
export * from './engine/Dice.js';
export * from './engine/TableRoller.js';
