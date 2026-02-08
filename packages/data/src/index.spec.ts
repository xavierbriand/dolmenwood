import { describe, it, expect } from 'vitest';
import { dataHello } from './index.js';

describe('Data Entry Point', () => {
  it('should greet via core', () => {
    expect(dataHello()).toContain('Data says: Hello from Core');
  });
});
