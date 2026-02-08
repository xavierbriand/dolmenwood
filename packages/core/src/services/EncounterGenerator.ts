import { TableRepository } from '../ports/TableRepository.js';
import { CreatureRepository } from '../ports/CreatureRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { DiceRoll, Die } from '../engine/Dice.js';
import { Creature, Encounter, GenerationContext } from '../schemas/encounter.js';
import { TableEntry } from '../schemas/tables.js';
import { Result, success, failure } from '../utils/Result.js';

export type EncounterResult = 
  | { kind: 'creature'; creature: Creature; count: number; name: string }
  | { kind: 'text'; description: string; name: string };

export class EncounterGenerator {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly creatureRepository: CreatureRepository,
    private readonly random: RandomProvider
  ) {}

  async generateEncounter(context: GenerationContext): Promise<Result<Encounter>> {
    // 1. Determine Initial Table based on context
    const initialTable = this.getInitialTableName(context); 

    const baseResult = await this.generate(initialTable, context);
    if (baseResult.kind === 'failure') return baseResult;

    const data = baseResult.data;
    
    // 2. Build the basic Encounter object
    const encounter: Encounter = {
      type: 'Creature',
      summary: data.name,
      details: {}
    };

    if (data.kind === 'creature') {
      encounter.type = 'Creature';
      encounter.details.creature = data.creature;
      encounter.details.count = data.count;
      encounter.summary = `${data.count} x ${data.name}`;

      // 3. Roll Secondary Details
      
      // Activity
      const activityRes = await this.rollTextTable('Activity');
      if (activityRes) encounter.details.activity = activityRes;

      // Reaction
      const reactionRes = await this.rollTextTable('Reaction');
      if (reactionRes) encounter.details.reaction = reactionRes;

      // Distance
      const distDice = new DiceRoll(2, new Die(6), 0);
      const distRoll = distDice.roll(this.random);
      // Outdoors: 30', Dungeon: 10'
      // Context doesn't explicitly have Dungeon yet, assuming Outdoors for now.
      const distMultiplier = 30; 
      encounter.details.distance = `${distRoll * distMultiplier} feet`;

      // Surprise
      const d6 = new DiceRoll(1, new Die(6), 0);
      const playerSurprise = d6.roll(this.random) <= 2;
      const monsterSurprise = d6.roll(this.random) <= 2;
      if (playerSurprise && monsterSurprise) encounter.details.surprise = 'Both sides surprised';
      else if (playerSurprise) encounter.details.surprise = 'Players surprised';
      else if (monsterSurprise) encounter.details.surprise = 'Monsters surprised';
      else encounter.details.surprise = 'No surprise';
      
    } else {
      encounter.type = 'Structure';
      encounter.details.activity = data.description;
    }

    return success(encounter);
  }

  private getInitialTableName(context: GenerationContext): string {
    const time = context.timeOfDay === 'Day' ? 'Daytime' : 'Nighttime';
    
    if (context.timeOfDay === 'Day') {
       // Construct table name: e.g. "Encounter Type - Time - Terrain"
       const terrain = context.terrain === 'Road' ? 'Road' : 'Wild';
       return `Encounter Type - ${time} - ${terrain}`;
    } else {
       // "Encounter Type - Nighttime - Fire" or "Encounter Type - Nighttime - No Fire"
       // Assuming 'camping' implies Fire.
       const condition = context.camping ? 'Fire' : 'No Fire'; 
       return `Encounter Type - ${time} - ${condition}`;
    }
  }

  private formatRegionName(regionId: string): string {
    // "generic-forest" -> "Generic Forest"
    return regionId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async rollTextTable(tableName: string): Promise<string | null> {
    const res = await this.generate(tableName);
    if (res.kind === 'success' && res.data.kind === 'text') {
      return res.data.description;
    }
    return null;
  }

  // Modified to support context for Regional lookups
  async generate(tableName: string, context?: GenerationContext): Promise<Result<EncounterResult>> {
    // 1. Load the table
    const tableResult = await this.tableRepository.getTable(tableName);
    if (tableResult.kind === 'failure') {
      return failure(new Error(`Failed to load table '${tableName}': ${tableResult.error.message}`));
    }
    const table = tableResult.data;

    // 2. Roll on the table
    const dice = DiceRoll.parse(table.die);
    const roll = dice.roll(this.random);

    // 3. Find the entry
    const entry = table.entries.find(e => roll >= e.min && roll <= e.max);
    if (!entry) {
      return failure(new Error(`Roll ${roll} on table '${tableName}' matched no entry.`));
    }

    // 4. Process entry based on type
    if (entry.type === 'Creature') {
      return this.resolveCreature(entry);
    } else if (entry.type === 'Regional') {
      if (context) {
         const regionName = this.formatRegionName(context.regionId);
         return this.generate(`Regional - ${regionName}`, context);
      } else {
        return this.generate(entry.ref || 'Regional', context);
      }
    } else if (['Animal', 'Monster', 'Mortal', 'Sentient'].includes(entry.type)) {
      // Recursively roll on the referenced table
      return this.generate(entry.ref, context);
    } else {
      // Text result
      return success({
        kind: 'text',
        name: entry.ref,
        description: entry.description || entry.ref
      });
    }
  }

  private async resolveCreature(entry: TableEntry): Promise<Result<EncounterResult>> {
    const creatureResult = await this.creatureRepository.getByName(entry.ref);
    if (creatureResult.kind === 'failure') {
      return failure(new Error(`Failed to load creature '${entry.ref}': ${creatureResult.error}`));
    }
    
    const creature = creatureResult.data;
    
    // Determine number appearing
    const countExpression = entry.count || creature.numberAppearing;
    let count = 1;
    try {
      if (countExpression.includes('d')) {
        count = DiceRoll.parse(countExpression).roll(this.random);
      } else {
        count = parseInt(countExpression);
      }
    } catch {
      // If parsing fails (e.g. "1"), fallback to 1 or try parseInt
       const parsed = parseInt(countExpression);
       if (!isNaN(parsed)) count = parsed;
    }

    return success({
      kind: 'creature',
      creature,
      count,
      name: creature.name
    });
  }
}
