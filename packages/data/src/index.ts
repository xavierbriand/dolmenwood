import { coreHello } from '@dolmenwood/core';

export function dataHello(): string {
  return `Data says: ${coreHello()}`;
}

export * from './repositories/YamlTableRepository.js';
export * from './repositories/YamlCreatureRepository.js';
export * from './repositories/JsonSessionRepository.js';
