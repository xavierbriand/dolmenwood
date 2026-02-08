import { describe, it, expect } from 'vitest';
import { coreHello } from './index.js';

describe('Core Entry Point', () => {
  it('should greet', () => {
    expect(coreHello()).toBe('Hello from Core');
  });
});
