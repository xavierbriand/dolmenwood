import { TableRepository, RegionTable, Creature, Result, success, failure, RegionTableSchema, CreatureSchema } from '@dolmenwood/core';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export class YamlTableRepository implements TableRepository {
  private creaturesCache: Promise<Creature[]> | null = null;
  private tablesCache: Promise<RegionTable[]> | null = null;

  constructor(private basePath: string) {}

  private async loadCreatures(): Promise<Creature[]> {
    if (this.creaturesCache) return this.creaturesCache;
    
    this.creaturesCache = (async () => {
      const filePath = path.join(this.basePath, 'creatures.yaml');
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const raw = yaml.load(content);
        const schema = z.array(CreatureSchema);
        return schema.parse(raw);
      } catch (e) {
        this.creaturesCache = null;
        throw e;
      }
    })();
    return this.creaturesCache;
  }

  private async loadTables(): Promise<RegionTable[]> {
    if (this.tablesCache) return this.tablesCache;

    this.tablesCache = (async () => {
       const filePath = path.join(this.basePath, 'regions.yaml');
       try {
         const content = await fs.readFile(filePath, 'utf-8');
         const raw = yaml.load(content);
         const schema = z.array(RegionTableSchema);
         return schema.parse(raw);
       } catch (e) {
         this.tablesCache = null;
         throw e;
       }
    })();
    return this.tablesCache;
  }

  async getCreature(name: string): Promise<Result<Creature>> {
    try {
      const creatures = await this.loadCreatures();
      const creature = creatures.find(c => c.name === name);
      if (!creature) return failure(new Error(`Creature '${name}' not found`));
      return success(creature);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getTable(name: string): Promise<Result<RegionTable>> {
    try {
      const tables = await this.loadTables();
      const table = tables.find(t => t.name === name);
      if (!table) return failure(new Error(`Table '${name}' not found`));
      return success(table);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
