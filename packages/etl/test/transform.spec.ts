import { describe, it, expect } from 'vitest';
import { parseCreatures } from '../src/steps/transform.js';

describe('transform', () => {
  it('should be implemented', () => {
    expect(parseCreatures('')).toEqual([]);
  });
});
