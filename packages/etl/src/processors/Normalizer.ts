export class Normalizer {
  private kerningDictionary: Record<string, string> = {
    'For t u ne -Te l le r': 'Fortune-Teller',
    'Yeg r i l': 'Yegril',
    'BAT, GI A N T': 'BAT, GIANT',
    'BAT, VA MPIR E': 'BAT, VAMPIRE',
    'Bat, Va Mpir E': 'Bat, Vampire',
    'R AT, GI A N T': 'RAT, GIANT',
    'F LY, G I A N T': 'FLY, GIANT',
    'Fl ig ht y, g reedy, merc u r ia l': 'Flighty, greedy, mercurial',
    'C R E AT I O N': 'CREATION',
    'H AT  T Y P E': 'HAT  TYPE',
    'Fair y Horse': 'Fairy Horse',
    'GEL ATINOUS APE': 'GELATINOUS APE',
    'hu ng r y': 'hungry',
    breggleshorthorn: 'breggle-shorthorn',
  };

  /**
   * Main entry point to run all normalization steps
   */
  public process(text: string): string {
    let current = text;
    current = this.normalizeSymbols(current);
    current = this.fixLineBreaks(current);
    current = this.fixDropCaps(current);
    current = this.fixKerning(current);
    return current;
  }

  /**
   * Fix "Lettrine" or "Drop Cap" artifacts where the first letter is on its own line
   * Example: "M\nonster" -> "Monster"
   */
  public fixDropCaps(text: string): string {
    // Matches: start of string or newline + single letter + newline + word char
    // $1 = previous newline/start, $2 = the letter, $3 = next char
    return text.replace(/(^|\n)([A-Za-z])\r?\n([A-Za-z])/g, '$1$2$3');
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
