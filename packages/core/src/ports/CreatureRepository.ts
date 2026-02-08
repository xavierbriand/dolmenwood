import { Creature } from '../schemas/creature.js';
import { Result } from '../utils/Result.js';

export interface CreatureRepository {
  /**
   * Retrieves a creature definition by its name.
   * @param name The name of the creature (e.g., "Goblin").
   */
  getByName(name: string): Promise<Result<Creature, string>>;
  
  /**
   * Retrieves all creature definitions.
   */
  getAll(): Promise<Result<Creature[], string>>;
}
