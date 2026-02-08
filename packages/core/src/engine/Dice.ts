import { RandomProvider } from '../ports/RandomProvider.js';

export class Dice {
  constructor(
    public readonly count: number,
    public readonly sides: number,
    public readonly modifier: number
  ) {}

  /**
   * Parses a dice notation string (e.g., "1d6", "2d4+1", "d8", "3d6-2").
   * @param expression The dice string to parse.
   * @returns A Dice instance.
   * @throws Error if the string is invalid.
   */
  static parse(expression: string): Dice {
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

    if (count < 1) {
        // Technically 0d6 is valid in some systems (result 0), but typically we expect at least 1 die.
        // However, the prompt implies standard dice notation.
        // If the user inputs "0d6", the regex matches. 
        // Let's assume count >= 1 is good practice, or at least >= 0.
        // If count is 0, the loop in roll won't run, result is modifier.
    }
    
    if (sides < 1) {
         throw new Error(`Invalid dice sides: ${sides}`);
    }

    return new Dice(count, sides, modifier);
  }

  /**
   * Rolls the dice using the provided RandomProvider.
   * @param random The RNG provider.
   * @returns The total result.
   */
  roll(random: RandomProvider): number {
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      // random.next() is [0, 1)
      // * sides is [0, sides)
      // floor is 0..sides-1
      // + 1 is 1..sides
      total += Math.floor(random.next() * this.sides) + 1;
    }
    return total + this.modifier;
  }
}
