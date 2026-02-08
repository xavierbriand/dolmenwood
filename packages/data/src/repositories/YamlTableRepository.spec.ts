import { describe, it, expect } from 'vitest';
import { YamlTableRepository } from './YamlTableRepository.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('YamlTableRepository', () => {
  // packages/data/src/repositories -> root -> assets
  const dataDir = join(__dirname, '../../../../assets');
  const repo = new YamlTableRepository(dataDir);

  it('should load Elf-Wanderer creature', async () => {
    const result = await repo.getCreature('Elf-Wanderer');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.name).toBe('Elf-Wanderer');
      expect(result.data.xp).toBe(15);
    }
  });

  it('should load Common - Animal table', async () => {
    const result = await repo.getTable('Common - Animal');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.die).toBe('1d20');
      expect(result.data.entries).toHaveLength(20);
    }
  });
});
