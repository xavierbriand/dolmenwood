import {
  TreasureTableRepository,
  TreasureTables,
  TreasureTablesSchema,
  Result,
  success,
  failure,
} from '@dolmenwood/core';
import fs from 'fs/promises';

export class JsonTreasureTableRepository implements TreasureTableRepository {
  private cache: Promise<TreasureTables> | null = null;

  constructor(private filePath: string) {}

  async getTreasureTables(): Promise<Result<TreasureTables>> {
    if (!this.cache) {
      this.cache = this.load();
    }

    try {
      const data = await this.cache;
      return success(data);
    } catch (e) {
      this.cache = null;
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private async load(): Promise<TreasureTables> {
    const content = await fs.readFile(this.filePath, 'utf-8');
    const raw: unknown = JSON.parse(content);
    return TreasureTablesSchema.parse(raw);
  }
}
