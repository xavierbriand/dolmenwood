/**
 * MortalSplitter
 *
 * Splits the Everyday Mortals section text into individual creature text blocks.
 * Handles page break removal, preamble stripping, shared stat block removal,
 * and TOC-driven creature name matching.
 *
 * Unlike Animals (which use ALL CAPS headers as creature delimiters), the
 * Everyday Mortals section contains sub-table headers in ALL CAPS (e.g.
 * "CRIER NEWS", "PILGRIM DESTINATIONS") that must not be treated as creatures.
 * The splitter uses the TOC creature names to identify which ALL CAPS headers
 * are actual creature entries.
 */

export interface MortalBlock {
  /** The raw ALL CAPS creature name (e.g. "LOST SOUL") */
  name: string;
  /** The full text block including name and description */
  text: string;
}

export class MortalSplitter {
  // Matches a line that is an ALL CAPS header.
  private static readonly ALL_CAPS_HEADER = /^([A-Z][A-Z, -]{2,})$/gm;

  // Remove page breaks: "part three | appenDices\n{pageNum}"
  private static readonly PAGE_BREAK = /\n?part three \| appenDices\n\d+\n?/gi;

  // The preamble ends before the first ALL CAPS creature header.
  private static readonly PREAMBLE =
    /^Everyday Mortals\n[\s\S]*?listed (?:below|here)\.\n/;

  // The shared stat block: starts with "Everyday Mortal Basic Details" or
  // "Everyday Mortal\nsMall". We remove from the "Everyday Mortal Basic Details"
  // header through the "Weapons:" line (inclusive).
  private static readonly SHARED_STAT_BLOCK =
    /Everyday Mortal Basic Details[\s\S]*?Weapons:.*?\n?/i;

  // The stat block header itself (without "Basic Details" prefix)
  private static readonly STAT_BLOCK_HEADER =
    /Everyday Mortal\nsMall[\s\S]*?Weapons:.*?\n?/i;

  /**
   * Split the Everyday Mortals section text into individual creature blocks.
   *
   * @param text The Everyday Mortals section text (output from MortalSlicer).
   * @param tocNames Optional list of expected creature names from the TOC.
   *   When provided, only ALL CAPS headers matching these names are treated
   *   as creature boundaries. When omitted, all ALL CAPS headers are used.
   * @returns Array of creature blocks with name and full text.
   */
  public split(text: string, tocNames?: string[]): MortalBlock[] {
    if (!text.trim()) {
      return [];
    }

    // Pre-processing: strip page breaks
    let cleaned = text.replace(MortalSplitter.PAGE_BREAK, '\n');

    // Pre-processing: strip section preamble
    cleaned = cleaned.replace(MortalSplitter.PREAMBLE, '');

    // Pre-processing: remove the shared stat block sections
    // First try the "Basic Details" + stat block combo
    cleaned = cleaned.replace(MortalSplitter.SHARED_STAT_BLOCK, '');
    // Then remove the stat block header if still present
    cleaned = cleaned.replace(MortalSplitter.STAT_BLOCK_HEADER, '');

    // Build a set of expected names in uppercase for fast lookup
    const expectedNames = tocNames
      ? new Set(tocNames.map((n) => n.toUpperCase()))
      : null;

    // Find all ALL CAPS headers, filtered to only creature names
    const matches: Array<{ name: string; index: number }> = [];
    const regex = new RegExp(MortalSplitter.ALL_CAPS_HEADER.source, 'gm');
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
    const blocks: MortalBlock[] = [];
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
