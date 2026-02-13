import { TableRepository } from '../ports/TableRepository.js';
import { CreatureRepository } from '../ports/CreatureRepository.js';
import { RandomProvider } from '../ports/RandomProvider.js';
import { DiceRoll, Die } from '../engine/Dice.js';
import {
  Creature,
  Encounter,
  GenerationContext,
} from '../schemas/encounter.js';
import { TableEntry } from '../schemas/tables.js';
import { Result, success, failure } from '../utils/Result.js';
import { TreasureGenerator } from './TreasureGenerator.js';
import { TreasureCodeParser } from './TreasureCodeParser.js';
import type { RolledTreasure } from '../schemas/treasure.js';

export type EncounterResult =
  | {
      kind: 'creature';
      creature: Creature;
      count: number;
      name: string;
      isLair: boolean;
      treasure?: RolledTreasure;
      possessions?: string;
    }
  | { kind: 'text'; description: string; name: string };

export class EncounterGenerator {
  private readonly treasureParser = new TreasureCodeParser();

  constructor(
    private readonly tableRepository: TableRepository,
    private readonly creatureRepository: CreatureRepository,
    private readonly random: RandomProvider,
    private readonly treasureGenerator?: TreasureGenerator,
  ) {}

  async generateEncounter(
    context: GenerationContext,
  ): Promise<Result<Encounter>> {
    // 1. Determine Initial Table based on context
    const initialTable = this.getInitialTableName(context);

    const baseResult = await this.generate(initialTable, context);
    if (baseResult.kind === 'failure') return baseResult;

    const data = baseResult.data;

    // 2. Build the basic Encounter object
    const encounter: Encounter = {
      type: 'Creature',
      summary: data.name,
      details: {},
    };

    if (data.kind === 'creature') {
      encounter.type = 'Creature';
      encounter.details.creature = data.creature;
      encounter.details.count = data.count;
      encounter.details.isLair = data.isLair;
      encounter.summary = `${data.count} x ${data.name}`;

      // Treasure
      if (data.treasure) {
        encounter.details.treasure = data.treasure;
      }
      if (data.possessions) {
        encounter.details.possessions = data.possessions;
      }

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
      if (playerSurprise && monsterSurprise)
        encounter.details.surprise = 'Both sides surprised';
      else if (playerSurprise) encounter.details.surprise = 'Players surprised';
      else if (monsterSurprise)
        encounter.details.surprise = 'Monsters surprised';
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
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
  async generate(
    tableName: string,
    context?: GenerationContext,
  ): Promise<Result<EncounterResult>> {
    // 1. Load the table
    let tableResult = await this.tableRepository.getTable(tableName);

    // Fallback: Try localized table name if context is available
    // e.g. "Common - Animal" -> "Common - Animal - High Wold"
    if (tableResult.kind === 'failure' && context) {
      const regionName = this.formatRegionName(context.regionId);
      const localizedName = `${tableName} - ${regionName}`;
      const localizedResult =
        await this.tableRepository.getTable(localizedName);
      if (localizedResult.kind === 'success') {
        tableResult = localizedResult;
      }
    }

    if (tableResult.kind === 'failure') {
      return failure(
        new Error(
          `Failed to load table '${tableName}': ${tableResult.error.message}`,
        ),
      );
    }
    const table = tableResult.data;

    // 2. Roll on the table
    const dice = DiceRoll.parse(table.die);
    const roll = dice.roll(this.random);

    // 3. Find the entry
    const entry = table.entries.find((e) => roll >= e.min && roll <= e.max);
    if (!entry) {
      return failure(
        new Error(`Roll ${roll} on table '${tableName}' matched no entry.`),
      );
    }

    // 4. Process entry based on type
    if (entry.type === 'Creature') {
      return this.resolveCreature(entry);
    } else if (entry.type === 'Regional') {
      if (context) {
        const regionName = this.formatRegionName(context.regionId);
        return this.generate(`Regional - ${regionName}`, context);
      } else {
        return this.generate(this.resolveRef(entry.ref) || 'Regional', context);
      }
    } else if (
      ['Animal', 'Monster', 'Mortal', 'Sentient'].includes(entry.type)
    ) {
      // Recursively roll on the referenced table
      return this.generate(this.resolveRef(entry.ref), context);
    } else {
      // Text result
      const resolved = this.resolveRef(entry.ref);
      return success({
        kind: 'text',
        name: resolved,
        description: entry.description || resolved,
      });
    }
  }

  private resolveRef(ref: string | string[]): string {
    if (Array.isArray(ref)) {
      const index = Math.floor(this.random.next() * ref.length);
      return ref[index];
    }
    return ref;
  }

  /** Base lair chance: 30% (can be overridden per-creature when data is available). */
  private static readonly BASE_LAIR_CHANCE = 0.3;

  private async resolveCreature(
    entry: TableEntry,
  ): Promise<Result<EncounterResult>> {
    const creatureName = this.resolveRef(entry.ref);
    const creatureResult =
      await this.creatureRepository.getByName(creatureName);
    if (creatureResult.kind === 'failure') {
      return failure(
        new Error(
          `Failed to load creature '${creatureName}': ${creatureResult.error}`,
        ),
      );
    }

    const creature = creatureResult.data;

    // Determine base number appearing
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

    // Determine lair status: roll percentile against base 30% chance
    const isLair = this.random.next() < EncounterGenerator.BASE_LAIR_CHANCE;

    // If lair, multiply count by 1d5 (up to 5× as many individuals)
    if (isLair) {
      const multiplier = Math.floor(this.random.next() * 5) + 1;
      count = count * multiplier;
    }

    return success({
      kind: 'creature',
      creature,
      count,
      name: creature.name,
      isLair,
      ...this.rollTreasure(creature, isLair),
    });
  }

  /**
   * Rolls treasure based on lair status.
   * - Wandering: possessions (extras) only, no hoard.
   * - Lair: full hoard + possessions.
   */
  private rollTreasure(
    creature: Creature,
    isLair: boolean,
  ): {
    treasure?: RolledTreasure;
    possessions?: string;
  } {
    if (!this.treasureGenerator || !creature.treasure) {
      return {};
    }

    const parseResult = this.treasureParser.parse(creature.treasure);
    if (parseResult.kind === 'failure') {
      return {};
    }

    const spec = parseResult.data;
    if (spec === null) {
      // "None" — no treasure
      return {};
    }

    const result: { treasure?: RolledTreasure; possessions?: string } = {};

    // Hoard treasure (C/R/M codes) only rolled for lair encounters
    if (isLair && spec.codes.length > 0) {
      result.treasure = this.treasureGenerator.rollHoard(spec);
    }

    // Possessions (extras) are available for both wandering and lair
    if (spec.extras.length > 0) {
      result.possessions = spec.extras.join('; ');
    }

    return result;
  }
}
