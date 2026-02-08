import { describe, it, expect } from 'vitest';
import { YamlCreatureRepository } from './YamlCreatureRepository.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('YamlCreatureRepository', () => {
  // Use fixtures for testing instead of proprietary assets
  const dataDir = join(__dirname, '../../tests/fixtures');
  const repo = new YamlCreatureRepository(dataDir);

  it('should load Test-Goblin creature', async () => {
    const result = await repo.getByName('Test-Goblin');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.name).toBe('Test-Goblin');
      expect(result.data.xp).toBe(10);
    }
  });
});
