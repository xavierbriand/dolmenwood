import { RegionTable } from '../schemas/tables.js';
import { Creature } from '../schemas/encounter.js';
import { Result } from '../utils/Result.js';

export interface TableRepository {
  getTable(name: string): Promise<Result<RegionTable>>;
  getCreature(name: string): Promise<Result<Creature>>;
}
