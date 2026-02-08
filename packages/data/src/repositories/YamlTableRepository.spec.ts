import { describe, it, expect } from 'vitest';
import { YamlTableRepository } from './YamlTableRepository.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('YamlTableRepository', () => {
  // Use fixtures for testing instead of proprietary assets
  const dataDir = join(__dirname, '../../tests/fixtures');
  const repo = new YamlTableRepository(dataDir);

  it('should load Test-Goblin creature', async () => {
    const result = await repo.getCreature('Test-Goblin');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.name).toBe('Test-Goblin');
      expect(result.data.xp).toBe(10);
    }
  });

  it('should load Common - Animal table', async () => {
    const result = await repo.getTable('Test - Animal');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.die).toBe('1d6');
      expect(result.data.entries).toHaveLength(1);
    }
  });
});
