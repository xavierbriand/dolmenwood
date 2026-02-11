/**
 * AnimalSplitter
 *
 * Splits the Animals section text into individual creature text blocks.
 * Handles page break removal, preamble stripping, and ALL CAPS name matching.
 */

export interface CreatureBlock {
  /** The raw ALL CAPS creature name (e.g. "FOREST SPRITE") */
  name: string;
  /** The full text block including name, description, stats, and abilities */
  text: string;
}

export class AnimalSplitter {
  // Matches a line that is an ALL CAPS creature name.
  // Creature names: uppercase letters, optional comma+space, optional hyphen.
  // Examples: "SPRITE, GIANT", "FOREST SPRITE", "LIZARD-VIPER"
  // Must be on its own line (^...$) with multiline flag.
  // The {2,} ensures at least 3 total characters, avoiding 2-char matches.
  private static readonly CREATURE_HEADER = /^([A-Z][A-Z, -]{2,})$/gm;

  // Remove page breaks: "part three | appenDices\n{pageNum}"
  // These appear between creatures and would interfere with splitting.
  private static readonly PAGE_BREAK = /\n?part three \| appenDices\n\d+\n?/gi;

  // The preamble ends with the line "...described briefly here."
  private static readonly PREAMBLE =
    /^Animals\n[\s\S]*?described briefly here\.\n/;

  /**
   * Split the Animals section text into individual creature blocks.
   *
   * @param text The Animals section text (output from AnimalSlicer).
   * @returns Array of creature blocks with name and full text.
   */
  public split(text: string): CreatureBlock[] {
    if (!text.trim()) {
      return [];
    }

    // Pre-processing: strip page breaks
    let cleaned = text.replace(AnimalSplitter.PAGE_BREAK, '\n');

    // Pre-processing: strip section preamble
    cleaned = cleaned.replace(AnimalSplitter.PREAMBLE, '');

    // Find all creature header matches with their indices
    const matches: Array<{ name: string; index: number }> = [];
    const regex = new RegExp(AnimalSplitter.CREATURE_HEADER.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleaned)) !== null) {
      matches.push({ name: match[1], index: match.index });
    }

    if (matches.length === 0) {
      return [];
    }

    // Split text into blocks using match indices
    const blocks: CreatureBlock[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = matches[i + 1]?.index ?? cleaned.length;
      const blockText = cleaned.slice(start, end).trim();

      blocks.push({
        name: matches[i].name,
        text: blockText,
      });
    }

    return blocks;
  }
}
