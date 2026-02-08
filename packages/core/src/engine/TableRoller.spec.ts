import { describe, it, expect, vi } from 'vitest';
import { TableRoller } from './TableRoller.js';
import { RandomProvider } from '../ports/RandomProvider.js';

describe('TableRoller', () => {
  it('should select an item based on weights', () => {
    const table = [
      { weight: 1, value: 'A' },
      { weight: 3, value: 'B' }, // Higher probability
    ];

    // Total weight = 4.
    // 'A' range: [0, 1)
    // 'B' range: [1, 4)
    
    // If we roll a total of 0.5 (scaled to weight), we get A.
    // If we roll a total of 2.5 (scaled to weight), we get B.
    
    // The random provider returns 0..1. 
    // We scale by total weight (4).
    
    // Case 1: Select A
    // random 0.1 * 4 = 0.4. Should be A.
    let mockRandom: RandomProvider = {
      next: vi.fn().mockReturnValue(0.1)
    };
    
    let result = new TableRoller(mockRandom).rollWeighted(table);
    expect(result).toBe('A');

    // Case 2: Select B
    // random 0.5 * 4 = 2.0. Should be B (since A is < 1)
    mockRandom = {
      next: vi.fn().mockReturnValue(0.5)
    };
    result = new TableRoller(mockRandom).rollWeighted(table);
    expect(result).toBe('B');
  });

  it('should handle single item', () => {
      const table = [{ weight: 10, value: 'Only' }];
      const mockRandom = { next: vi.fn().mockReturnValue(0.5) };
      const result = new TableRoller(mockRandom).rollWeighted(table);
      expect(result).toBe('Only');
  });
  
  it('should return null or throw if table is empty', () => {
      const mockRandom = { next: vi.fn().mockReturnValue(0.5) };
      expect(() => new TableRoller(mockRandom).rollWeighted([])).toThrow();
  });
});
