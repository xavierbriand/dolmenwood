/**
 * AdventurerSplitter
 *
 * Splits the Adventurers section text into individual class text blocks.
 * Handles page break removal, preamble stripping, interstitial block removal
 * (e.g. "Possessions and Hoards", "Kindred Traits"), and trailing cross-reference
 * table removal ("ADVENTURER CLASS BY KINDRED").
 *
 * Uses the TOC class names to filter which ALL CAPS headers are actual
 * creature boundaries (ignoring interstitial headers).
 */

export interface AdventurerBlock {
  /** The raw ALL CAPS class name (e.g. "BARD") */
  name: string;
  /** The full text block including name and all level stat blocks */
  text: string;
}

export class AdventurerSplitter {
  // Matches a line that is an ALL CAPS header (at least 3 chars).
  private static readonly ALL_CAPS_HEADER = /^([A-Z][A-Z, -]{2,})$/gm;

  // Remove page breaks: "part three | appenDices\n{pageNum}"
  private static readonly PAGE_BREAK = /\n?part three \| appenDices\n\d+\n?/gi;

  // The preamble: section header + introductory prose before the first class.
  // Matches from "Adventurers\n" through lines of prose that precede the first
  // ALL CAPS creature header.
  private static readonly PREAMBLE =
    /^Adventurers\n[\s\S]*?magic armaments\.\n?/;

  // Trailing cross-reference table at the end of the section.
  private static readonly TRAILING_TABLE =
    /ADVENTURER CLASS BY KINDRED[\s\S]*$/;

  /**
   * Split the Adventurers section text into individual class blocks.
   *
   * @param text The Adventurers section text (output from AdventurerSlicer).
   * @param tocNames Optional list of expected class names from the TOC.
   *   When provided, only ALL CAPS headers matching these names are treated
   *   as class boundaries. When omitted, all ALL CAPS headers are used.
   * @returns Array of class blocks with name and full text.
   */
  public split(text: string, tocNames?: string[]): AdventurerBlock[] {
    if (!text.trim()) {
      return [];
    }

    // Pre-processing: strip page breaks
    let cleaned = text.replace(AdventurerSplitter.PAGE_BREAK, '\n');

    // Pre-processing: strip section preamble
    cleaned = cleaned.replace(AdventurerSplitter.PREAMBLE, '');

    // Pre-processing: strip trailing cross-reference table
    cleaned = cleaned.replace(AdventurerSplitter.TRAILING_TABLE, '');

    // Build a set of expected names in uppercase for fast lookup
    const expectedNames = tocNames
      ? new Set(tocNames.map((n) => n.toUpperCase()))
      : null;

    // Find all ALL CAPS headers, filtered to only class names
    const matches: Array<{ name: string; index: number }> = [];
    const regex = new RegExp(AdventurerSplitter.ALL_CAPS_HEADER.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleaned)) !== null) {
      const headerName = match[1];
      // If we have TOC names, only accept headers that match
      if (expectedNames && !expectedNames.has(headerName)) {
        continue;
      }
      matches.push({ name: headerName, index: match.index });
    }

    if (matches.length === 0) {
      return [];
    }

    // Split text into blocks using match indices
    const blocks: AdventurerBlock[] = [];
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
