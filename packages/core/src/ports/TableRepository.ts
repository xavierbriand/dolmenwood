import { RegionTable } from '../schemas/tables.js';
import { Result } from '../utils/Result.js';

export interface TableRepository {
  getTable(name: string): Promise<Result<RegionTable>>;
  listTables(): Promise<Result<RegionTable[]>>;
}
