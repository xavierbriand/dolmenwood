import { RandomProvider } from '../ports/RandomProvider.js';

export class Die {
  constructor(public readonly sides: number) {
    if (sides < 1) {
      throw new Error(`Invalid die sides: ${sides}`);
    }
  }

  roll(random: RandomProvider): number {
    return Math.floor(random.next() * this.sides) + 1;
  }
}

export class DiceRoll {
  constructor(
    public readonly count: number,
    public readonly die: Die,
    public readonly modifier: number = 0
  ) {}

  /**
   * Parses a dice notation string (e.g., "1d6", "2d4+1", "d8", "3d6-2").
   * @param expression The dice string to parse.
   * @returns A DiceRoll instance.
   * @throws Error if the string is invalid.
   */
  static parse(expression: string): DiceRoll {
    // Regex explanation:
    // ^\s*          Start of string, optional whitespace
    // (?<count>\d*) Capture group for count (optional digits)
    // d             Literal 'd'
    // (?<sides>\d+) Capture group for sides (required digits)
    // (?<mod>[+-]\d+)? Capture group for modifier (optional + or - followed by digits)
    // \s*$          End of string, optional whitespace
    const regex = /^\s*(?<count>\d*)d(?<sides>\d+)(?<mod>[+-]\d+)?\s*$/i;
    const match = expression.match(regex);

    if (!match || !match.groups) {
      throw new Error(`Invalid dice notation: "${expression}"`);
    }

    const countStr = match.groups.count;
    const sidesStr = match.groups.sides;
    const modStr = match.groups.mod;

    const count = countStr === '' ? 1 : parseInt(countStr, 10);
    const sides = parseInt(sidesStr, 10);
    const modifier = modStr ? parseInt(modStr, 10) : 0;

    return new DiceRoll(count, new Die(sides), modifier);
  }

  /**
   * Rolls the dice using the provided RandomProvider.
   * @param random The RNG provider.
   * @returns The total result.
   */
  roll(random: RandomProvider): number {
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      total += this.die.roll(random);
    }
    return total + this.modifier;
  }
}
