import { TreasureTables } from '../schemas/treasure.js';
import { Result } from '../utils/Result.js';

export interface TreasureTableRepository {
  getTreasureTables(): Promise<Result<TreasureTables>>;
}
