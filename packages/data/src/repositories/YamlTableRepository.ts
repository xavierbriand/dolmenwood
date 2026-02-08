import {
  TableRepository,
  RegionTable,
  Result,
  success,
  failure,
  RegionTableSchema,
} from '@dolmenwood/core';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export class YamlTableRepository implements TableRepository {
  private tablesCache: Promise<RegionTable[]> | null = null;

  constructor(private basePath: string) {}

  private async loadTables(): Promise<RegionTable[]> {
    if (this.tablesCache) return this.tablesCache;

    this.tablesCache = (async () => {
      try {
        const files = await fs.readdir(this.basePath);
        // Ignore creatures.yaml and other non-table files if necessary
        const tableFiles = files.filter(
          (f) => f.endsWith('.yaml') && f !== 'creatures.yaml',
        );

        const allTables: RegionTable[] = [];
        const schema = z.array(RegionTableSchema);

        for (const file of tableFiles) {
          const filePath = path.join(this.basePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const raw = yaml.load(content);
          const parsed = schema.parse(raw);
          allTables.push(...parsed);
        }

        return allTables;
      } catch (e) {
        this.tablesCache = null;
        throw e;
      }
    })();
    return this.tablesCache;
  }

  async getTable(name: string): Promise<Result<RegionTable>> {
    try {
      const tables = await this.loadTables();
      const table = tables.find((t) => t.name === name);
      if (!table) return failure(new Error(`Table '${name}' not found`));
      return success(table);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listTables(): Promise<Result<RegionTable[]>> {
    try {
      const tables = await this.loadTables();
      return success(tables);
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
