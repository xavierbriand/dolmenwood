import { RandomProvider } from '../ports/RandomProvider.js';
import { DiceRoll, Die } from '../engine/Dice.js';
import type {
  TreasureTables,
  TreasureSpec,
  RolledTreasure,
  RolledGem,
  RolledArtObject,
  RolledMagicItem,
  ChanceQuantity,
  GemValueEntry,
  NamedItem,
} from '../schemas/treasure.js';

/** Conversion rates to gold pieces */
const GP_RATES = {
  copper: 1 / 100,
  silver: 1 / 10,
  gold: 1,
  pellucidium: 5,
} as const;

type Denomination = keyof typeof GP_RATES;

const DENOMINATIONS: Denomination[] = [
  'copper',
  'silver',
  'gold',
  'pellucidium',
];

/**
 * Parses a quantity string from the extracted treasure data.
 *
 * Supported formats:
 * - "1d4" → { dice: "1d4", multiplier: 1 }
 * - "2d6" → { dice: "2d6", multiplier: 1 }
 * - "1d4 × 1,000" → { dice: "1d4", multiplier: 1000 }
 * - "1d4 × 1,000cp" → { dice: "1d4", multiplier: 1000 }
 * - "1d4 × 10,000gp" → { dice: "1d4", multiplier: 10000 }
 * - "1d4 gems" → { dice: "1d4", multiplier: 1 }
 * - "1d4 × 10 objects" → { dice: "1d4", multiplier: 10 }
 * - "1d100 gems" → { dice: "1d100", multiplier: 1 }
 */
function parseQuantity(quantity: string): { dice: string; multiplier: number } {
  // Try multiplied format: "NdS × M[,MMM][unit]"
  const multMatch = quantity.match(/^(\d*d\d+)\s*[×x]\s*([\d,]+)\s*\w*$/i);
  if (multMatch) {
    const dice = multMatch[1];
    const multiplier = parseInt(multMatch[2].replace(/,/g, ''), 10);
    return { dice, multiplier };
  }

  // Try plain dice with optional suffix: "NdS [suffix]"
  const plainMatch = quantity.match(/^(\d*d\d+)/i);
  if (plainMatch) {
    return { dice: plainMatch[1], multiplier: 1 };
  }

  // Fallback: treat as literal number
  const num = parseInt(quantity.replace(/,/g, ''), 10);
  return { dice: '1d1', multiplier: isNaN(num) ? 1 : num };
}

/**
 * Parsed instruction for generating magic items from an M-tier items string.
 */
type MagicItemInstruction =
  | { kind: 'rollType'; count: number }
  | { kind: 'rollTypeDice'; dice: string }
  | { kind: 'potions'; count: number }
  | { kind: 'potionsDice'; dice: string }
  | { kind: 'scrolls'; count: number }
  | { kind: 'scrollsDice'; dice: string }
  | { kind: 'armourOrWeapon'; count: number };

/**
 * Parses the M-tier "items" string into generation instructions.
 *
 * Examples:
 * - "1 item (roll type)" → [{ kind: 'rollType', count: 1 }]
 * - "2 items (roll type) + 1 potion" → [{ kind: 'rollType', count: 2 }, { kind: 'potions', count: 1 }]
 * - "2d4 potions" → [{ kind: 'potionsDice', dice: '2d4' }]
 * - "1d4 scrolls / books" → [{ kind: 'scrollsDice', dice: '1d4' }]
 * - "1 armour or weapon (equal chance of either)" → [{ kind: 'armourOrWeapon', count: 1 }]
 * - "3 items (roll type) + 1 scroll / book" → [{ kind: 'rollType', count: 3 }, { kind: 'scrolls', count: 1 }]
 * - "4 items (roll type) + 1 potion + 1 scroll / book" → three instructions
 */
function parseMagicItemsString(items: string): MagicItemInstruction[] {
  const instructions: MagicItemInstruction[] = [];
  const parts = items.split(/\s*\+\s*/);

  for (const part of parts) {
    const trimmed = part.trim();

    // "N items (roll type)" or "1 item (roll type)"
    const rollTypeMatch = trimmed.match(/^(\d+)\s+items?\s+\(roll type\)/i);
    if (rollTypeMatch) {
      instructions.push({
        kind: 'rollType',
        count: parseInt(rollTypeMatch[1], 10),
      });
      continue;
    }

    // "NdS items (roll type)"
    const rollTypeDiceMatch = trimmed.match(
      /^(\d*d\d+)\s+items?\s+\(roll type\)/i,
    );
    if (rollTypeDiceMatch) {
      instructions.push({ kind: 'rollTypeDice', dice: rollTypeDiceMatch[1] });
      continue;
    }

    // "1 armour or weapon (equal chance of either)"
    const armourWeaponMatch = trimmed.match(/^(\d+)\s+armou?r\s+or\s+weapon/i);
    if (armourWeaponMatch) {
      instructions.push({
        kind: 'armourOrWeapon',
        count: parseInt(armourWeaponMatch[1], 10),
      });
      continue;
    }

    // "NdS potions"
    const potionsDiceMatch = trimmed.match(/^(\d*d\d+)\s+potions?$/i);
    if (potionsDiceMatch) {
      instructions.push({ kind: 'potionsDice', dice: potionsDiceMatch[1] });
      continue;
    }

    // "N potion(s)"
    const potionsMatch = trimmed.match(/^(\d+)\s+potions?$/i);
    if (potionsMatch) {
      instructions.push({
        kind: 'potions',
        count: parseInt(potionsMatch[1], 10),
      });
      continue;
    }

    // "NdS scrolls / books"
    const scrollsDiceMatch = trimmed.match(
      /^(\d*d\d+)\s+scrolls?\s*\/\s*books?$/i,
    );
    if (scrollsDiceMatch) {
      instructions.push({ kind: 'scrollsDice', dice: scrollsDiceMatch[1] });
      continue;
    }

    // "N scroll(s) / book(s)"
    const scrollsMatch = trimmed.match(/^(\d+)\s+scrolls?\s*\/\s*books?$/i);
    if (scrollsMatch) {
      instructions.push({
        kind: 'scrolls',
        count: parseInt(scrollsMatch[1], 10),
      });
      continue;
    }
  }

  return instructions;
}

/**
 * Mapping from magic item type names (from the magicItemType d100 table)
 * to the summary table field names on TreasureTables.
 */
const MAGIC_CATEGORY_TABLE_MAP: Record<string, keyof TreasureTables | null> = {
  'Amulet / talisman': 'amulets',
  'Magic armour': 'magicArmour',
  'Magic balm / oil': 'magicBalms',
  'Magic crystal': 'magicCrystals',
  'Magic garment': 'magicGarments',
  'Magic instrument': 'magicInstruments',
  'Magic ring': 'magicRings',
  'Magic weapon': 'magicWeapons',
  Potion: 'potions',
  'Rod / staff / wand': 'rodsStavesWands',
  'Scroll / book': 'scrollsBooks',
  'Wondrous item': 'wondrousItems',
};

/**
 * TreasureGenerator rolls treasure hoards based on treasure specs
 * (parsed from creature hoard code strings).
 *
 * It uses the extracted DCB treasure tables and a RandomProvider
 * to produce randomized treasure results.
 */
export class TreasureGenerator {
  constructor(
    private readonly tables: TreasureTables,
    private readonly random: RandomProvider,
  ) {}

  /**
   * Rolls a treasure hoard for the given spec.
   * Processes each C/R/M code, accumulates all results,
   * and computes the total value in gold pieces.
   */
  rollHoard(spec: TreasureSpec): RolledTreasure {
    const coins = { copper: 0, silver: 0, gold: 0, pellucidium: 0 };
    const gems: RolledGem[] = [];
    const artObjects: RolledArtObject[] = [];
    const magicItems: RolledMagicItem[] = [];

    for (const code of spec.codes) {
      switch (code.tier) {
        case 'C':
          this.rollCoins(code.level, coins);
          break;
        case 'R':
          this.rollRiches(code.level, gems, artObjects);
          break;
        case 'M':
          this.rollMagicItems(code.level, magicItems);
          break;
      }
    }

    const totalValue = this.computeTotalValue(
      coins,
      gems,
      artObjects,
      magicItems,
    );

    return { coins, gems, artObjects, magicItems, totalValue };
  }

  /**
   * Rolls coins for a given C-tier level, adding results to the coins accumulator.
   */
  private rollCoins(level: number, coins: Record<Denomination, number>): void {
    const tier = this.tables.coins[level - 1];
    if (!tier) return;

    for (const denom of DENOMINATIONS) {
      const entry = tier[denom] as ChanceQuantity | null;
      if (!entry) continue;

      const roll = this.rollD100();
      if (roll > entry.chance) continue;

      const { dice, multiplier } = parseQuantity(entry.quantity);
      const diceResult = DiceRoll.parse(dice).roll(this.random);
      coins[denom] += diceResult * multiplier;
    }
  }

  /**
   * Rolls riches for a given R-tier level, adding gems and art objects.
   */
  private rollRiches(
    level: number,
    gems: RolledGem[],
    artObjects: RolledArtObject[],
  ): void {
    const tier = this.tables.riches[level - 1];
    if (!tier) return;

    // Gems
    if (tier.gems) {
      const roll = this.rollD100();
      if (roll <= tier.gems.chance) {
        const count = this.rollQuantityCount(tier.gems.quantity);
        for (let i = 0; i < count; i++) {
          gems.push(this.rollSingleGem());
        }
      }
    }

    // Art objects
    if (tier.artObjects) {
      const roll = this.rollD100();
      if (roll <= tier.artObjects.chance) {
        const count = this.rollQuantityCount(tier.artObjects.quantity);
        for (let i = 0; i < count; i++) {
          artObjects.push(this.rollSingleArtObject());
        }
      }
    }
  }

  /**
   * Rolls a single gem: determines value category, then picks a type.
   */
  private rollSingleGem(): RolledGem {
    const valueRoll = this.rollD100();
    const gemValueEntry = this.lookupRange(this.tables.gemValue, valueRoll) as
      | GemValueEntry
      | undefined;

    const category = gemValueEntry?.category ?? 'Unknown';
    const value = gemValueEntry?.value ?? 0;

    // Find gem types for this category, handling casing mismatch
    const types = this.findGemTypes(category);
    const type =
      types.length > 0
        ? types[Math.floor(this.random.next() * types.length)]
        : 'Unknown gem';

    return { category, type, value };
  }

  /**
   * Finds gem types for a category, handling the known casing mismatch
   * between gemValue ("Semi-precious") and gemType ("Semi-Precious").
   */
  private findGemTypes(category: string): string[] {
    // Try exact match first
    if (this.tables.gemType[category]) {
      return this.tables.gemType[category];
    }

    // Case-insensitive fallback
    const lowerCategory = category.toLowerCase();
    for (const [key, types] of Object.entries(this.tables.gemType)) {
      if (key.toLowerCase() === lowerCategory) {
        return types;
      }
    }

    return [];
  }

  /**
   * Rolls a single art object: type, material, embellishment, and value.
   */
  private rollSingleArtObject(): RolledArtObject {
    // d100 to determine jewellery (1-50) vs misc art object (51-100)
    const categoryRoll = this.rollD100();
    let type: string;

    if (categoryRoll <= 50 && this.tables.jewellery.length > 0) {
      const typeRoll = this.rollD100();
      const entry = this.lookupRange(this.tables.jewellery, typeRoll);
      type =
        ((entry as Record<string, unknown>)?.type as string) ??
        'Unknown jewellery';
    } else if (this.tables.miscArtObjects.length > 0) {
      const typeRoll = this.rollD100();
      const entry = this.lookupRange(this.tables.miscArtObjects, typeRoll);
      type =
        ((entry as Record<string, unknown>)?.type as string) ??
        'Unknown object';
    } else {
      // Fallback if jewellery table is available
      const typeRoll = this.rollD100();
      const entry = this.lookupRange(this.tables.jewellery, typeRoll);
      type =
        ((entry as Record<string, unknown>)?.type as string) ??
        'Unknown art object';
    }

    // Material (d20)
    const materialRoll = new Die(20).roll(this.random);
    const materialEntry = this.tables.preciousMaterials.find(
      (m) => m.roll === materialRoll,
    );
    const material = materialEntry?.value ?? 'Unknown material';

    // Embellishment (d20)
    const embellishmentRoll = new Die(20).roll(this.random);
    const embellishmentEntry = this.tables.embellishments.find(
      (e) => e.roll === embellishmentRoll,
    );
    const embellishment = embellishmentEntry?.value ?? 'Unknown embellishment';

    // Value: 3d6 × 100gp
    const valueRoll = new DiceRoll(3, new Die(6)).roll(this.random);
    const value = valueRoll * 100;

    return { type, material, embellishment, value };
  }

  /**
   * Rolls magic items for a given M-tier level.
   */
  private rollMagicItems(level: number, magicItems: RolledMagicItem[]): void {
    const tier = this.tables.magicItems[level - 1];
    if (!tier) return;

    // Check chance
    const chanceRoll = this.rollD100();
    if (chanceRoll > tier.chance) return;

    // Parse the items description into instructions
    const instructions = parseMagicItemsString(tier.items);

    for (const instruction of instructions) {
      switch (instruction.kind) {
        case 'rollType':
          for (let i = 0; i < instruction.count; i++) {
            magicItems.push(this.rollSingleMagicItem());
          }
          break;
        case 'rollTypeDice': {
          const count = DiceRoll.parse(instruction.dice).roll(this.random);
          for (let i = 0; i < count; i++) {
            magicItems.push(this.rollSingleMagicItem());
          }
          break;
        }
        case 'potions':
          for (let i = 0; i < instruction.count; i++) {
            magicItems.push(this.rollFromCategory('Potion'));
          }
          break;
        case 'potionsDice': {
          const count = DiceRoll.parse(instruction.dice).roll(this.random);
          for (let i = 0; i < count; i++) {
            magicItems.push(this.rollFromCategory('Potion'));
          }
          break;
        }
        case 'scrolls':
          for (let i = 0; i < instruction.count; i++) {
            magicItems.push(this.rollFromCategory('Scroll / book'));
          }
          break;
        case 'scrollsDice': {
          const count = DiceRoll.parse(instruction.dice).roll(this.random);
          for (let i = 0; i < count; i++) {
            magicItems.push(this.rollFromCategory('Scroll / book'));
          }
          break;
        }
        case 'armourOrWeapon':
          for (let i = 0; i < instruction.count; i++) {
            // Equal chance of armour or weapon
            const category =
              this.random.next() < 0.5 ? 'Magic armour' : 'Magic weapon';
            magicItems.push(this.rollFromCategory(category));
          }
          break;
      }
    }
  }

  /**
   * Rolls a single magic item by rolling on the magicItemType d100 table
   * to determine the category, then picking from the appropriate summary table.
   */
  private rollSingleMagicItem(): RolledMagicItem {
    const typeRoll = this.rollD100();
    const typeEntry = this.lookupRange(this.tables.magicItemType, typeRoll);
    const category =
      ((typeEntry as Record<string, unknown>)?.type as string) ??
      'Unknown magic item';

    return this.rollFromCategory(category);
  }

  /**
   * Picks a random item from the summary table for the given category.
   */
  private rollFromCategory(category: string): RolledMagicItem {
    const tableKey = MAGIC_CATEGORY_TABLE_MAP[category];
    if (!tableKey) {
      return { category, name: category, value: 0 };
    }

    const table = this.tables[tableKey];

    // Summary tables are NamedItem[] arrays
    if (Array.isArray(table) && table.length > 0 && 'name' in table[0]) {
      const namedItems = table as NamedItem[];
      const index = Math.floor(this.random.next() * namedItems.length);
      const item = namedItems[index];
      return { category, name: item.name, value: item.value };
    }

    // Generation sub-tables (magicArmour, magicWeapons, etc.) — return a generic entry
    return { category, name: category, value: 0 };
  }

  /**
   * Rolls the dice portion of a quantity string and returns the count.
   */
  private rollQuantityCount(quantity: string): number {
    const { dice, multiplier } = parseQuantity(quantity);
    return DiceRoll.parse(dice).roll(this.random) * multiplier;
  }

  /**
   * Rolls a d100 (1-100).
   */
  private rollD100(): number {
    return new Die(100).roll(this.random);
  }

  /**
   * Looks up an entry in a range table (min/max based) for a given roll.
   */
  private lookupRange(
    table: Array<Record<string, unknown>>,
    roll: number,
  ): Record<string, unknown> | undefined {
    return table.find((entry) => {
      const min = entry.min as number;
      const max = entry.max as number;
      return roll >= min && roll <= max;
    });
  }

  /**
   * Computes the total value of all treasure in gold pieces.
   */
  private computeTotalValue(
    coins: Record<Denomination, number>,
    gems: RolledGem[],
    artObjects: RolledArtObject[],
    magicItems: RolledMagicItem[],
  ): number {
    let total = 0;

    // Coins
    for (const denom of DENOMINATIONS) {
      total += coins[denom] * GP_RATES[denom];
    }

    // Gems
    for (const gem of gems) {
      total += gem.value;
    }

    // Art objects
    for (const obj of artObjects) {
      total += obj.value;
    }

    // Magic items
    for (const item of magicItems) {
      total += item.value;
    }

    return total;
  }
}
