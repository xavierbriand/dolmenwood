import { CreatureRepository, Creature, Result, success, failure, CreatureSchema } from '@dolmenwood/core';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export class YamlCreatureRepository implements CreatureRepository {
  private creaturesCache: Promise<Creature[]> | null = null;

  constructor(private basePath: string) {}

  private async loadCreatures(): Promise<Creature[]> {
    if (this.creaturesCache) return this.creaturesCache;
    
    this.creaturesCache = (async () => {
      const filePath = path.join(this.basePath, 'creatures.yaml');
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const raw = yaml.load(content);
        // Expecting a list of creatures
        const schema = z.array(CreatureSchema);
        return schema.parse(raw);
      } catch (e) {
        this.creaturesCache = null;
        throw e;
      }
    })();
    return this.creaturesCache;
  }

  async getByName(name: string): Promise<Result<Creature, string>> {
    try {
      const creatures = await this.loadCreatures();
      const creature = creatures.find(c => c.name === name);
      if (!creature) return failure(`Creature '${name}' not found`);
      return success(creature);
    } catch (e) {
      return failure(e instanceof Error ? e.message : String(e));
    }
  }

  async getAll(): Promise<Result<Creature[], string>> {
    try {
      const creatures = await this.loadCreatures();
      return success(creatures);
    } catch (e) {
      return failure(e instanceof Error ? e.message : String(e));
    }
  }
}
