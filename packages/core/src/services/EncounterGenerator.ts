import { TableRepository } from '../ports/TableRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { Dice } from '../engine/Dice.js';
import { Creature } from '../schemas/encounter.js';
import { RegionTable, TableEntry } from '../schemas/tables.js';
import { Result, success, failure } from '../utils/Result.js';

export type EncounterResult = 
  | { kind: 'creature'; creature: Creature; count: number; name: string }
  | { kind: 'text'; description: string; name: string };

export class EncounterGenerator {
  constructor(
    private readonly repository: TableRepository,
    private readonly random: RandomProvider
  ) {}

  async generate(tableName: string): Promise<Result<EncounterResult>> {
    // 1. Load the table
    const tableResult = await this.repository.getTable(tableName);
    if (tableResult.kind === 'failure') {
      return failure(new Error(`Failed to load table '${tableName}': ${tableResult.error.message}`));
    }
    const table = tableResult.data;

    // 2. Roll on the table
    const dice = Dice.parse(table.die);
    const roll = dice.roll(this.random);

    // 3. Find the entry
    const entry = table.entries.find(e => roll >= e.min && roll <= e.max);
    if (!entry) {
      return failure(new Error(`Roll ${roll} on table '${tableName}' matched no entry.`));
    }

    // 4. Process entry based on type
    if (entry.type === 'Creature') {
      return this.resolveCreature(entry);
    } else if (['Animal', 'Monster', 'Mortal', 'Sentient', 'Regional'].includes(entry.type)) {
      // These types usually refer to another sub-table
      // Recursively roll on the referenced table
      return this.generate(entry.ref);
    } else {
      // Other types like Lair, Structure, etc. might be text results for now
      return success({
        kind: 'text',
        name: entry.ref,
        description: entry.description || entry.ref
      });
    }
  }

  private async resolveCreature(entry: TableEntry): Promise<Result<EncounterResult>> {
    const creatureResult = await this.repository.getCreature(entry.ref);
    if (creatureResult.kind === 'failure') {
      return failure(new Error(`Failed to load creature '${entry.ref}': ${creatureResult.error.message}`));
    }
    
    const creature = creatureResult.data;
    
    // Determine number appearing
    // Priority: entry.count > creature.numberAppearing
    const countExpression = entry.count || creature.numberAppearing;
    let count = 1;
    try {
      // Some counts are "1" or "1d6" or "2-8" (not supported by Dice yet?)
      // Assuming Dice.parse supports simple numbers too (e.g. "1") or we handle it
      // Dice regex expects "XdY+Z", so "1" might fail if strict.
      // Let's check Dice.ts regex: /^\s*(?<count>\d*)d(?<sides>\d+)(?<mod>[+-]\d+)?\s*$/i;
      // It REQUIRES 'd'. So "1" fails.
      
      if (countExpression.includes('d')) {
        count = Dice.parse(countExpression).roll(this.random);
      } else {
        count = parseInt(countExpression);
      }
    } catch (e) {
      console.warn(`Failed to parse count '${countExpression}' for ${creature.name}, defaulting to 1.`);
    }

    return success({
      kind: 'creature',
      creature,
      count,
      name: creature.name
    });
  }
}
