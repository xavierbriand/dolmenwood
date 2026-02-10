export class Normalizer {
  private kerningDictionary: Record<string, string> = {
    // Note: Keys must use single spaces as normalizeSymbols runs first
    'Bat, Va Mpir E': 'Bat, Vampire',
    'Rat, Gi An T': 'Rat, Giant',
    'Fly, Giant': 'Fly, Giant', // already correct but included for safety
    'Dr Ag On': 'Dragon',
    'Go Bli N': 'Goblin',
  };

  /**
   * Main entry point to run all normalization steps
   */
  public process(text: string): string {
    let current = text;
    current = this.normalizeSymbols(current);
    current = this.fixLineBreaks(current);
    current = this.fixKerning(current);
    return current;
  }

  /**
   * Standardize quotes, dashes, and whitespace
   */
  public normalizeSymbols(text: string): string {
    return (
      text
        // Em-dashes and En-dashes to hyphens
        .replace(/—|–/g, '-')
        // Smart quotes to straight quotes
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        // Collapse multiple spaces (but preserve newlines)
        .replace(/[ \t]+/g, ' ')
    );
  }

  /**
   * Fix words split by hyphens across line breaks
   * Example: "mons-\nter" -> "monster"
   */
  public fixLineBreaks(text: string): string {
    // Matches: word char + hyphen + optional carriage return + newline + word char
    return text.replace(/(\w)-(\r?\n)(\w)/g, '$1$3');
  }

  /**
   * Fix known kerning issues using a dictionary
   * We avoid global heuristic merging for now to prevent over-aggressive merging
   */
  public fixKerning(text: string): string {
    let result = text;
    for (const [bad, good] of Object.entries(this.kerningDictionary)) {
      // Create a global regex for the bad string, escaping special chars if needed
      // Simple string replaceAll would be safer if we assume exact matches,
      // but regex allows for case insensitivity if we wanted it.
      // For now, exact string replacement is safer.
      result = result.split(bad).join(good);
    }
    return result;
  }
}
