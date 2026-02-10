export interface CreatureBlock {
  name: string;
  text: string;
  page: number;
}

export class Chunker {
  // Regex patterns
  private static PATTERNS = {
    // Start of the Table of Contents
    TOC_START: /Table of Contents/i,
    // Start of Part One (End of TOC)
    PART_ONE_START: /Part One\s*\n\s*Monsters of/i,
    // Start of Part Two (Bestiary)
    PART_TWO_START: /Part Two\s*\n\s*Bestiary/i,
    // Start of Part Three (Appendices - End of Bestiary)
    PART_THREE_START: /Part Three\s*\n\s*Appendices/i,
    // Page Header pattern (appears at top/bottom of pages)
    PAGE_HEADER: /part two \| Bestiary/i,
  };

  /**
   * Slice the document into major sections
   */
  public extractBestiarySection(fullText: string): string {
    const startMatch = fullText.match(Chunker.PATTERNS.PART_TWO_START);
    const endMatch = fullText.match(Chunker.PATTERNS.PART_THREE_START);

    if (!startMatch) {
      console.warn(
        'Could not locate start of Bestiary (Part Two). Returning full text.',
      );
      return fullText;
    }

    const startIndex = startMatch.index! + startMatch[0].length;

    // If no end match (maybe partial doc?), go to end of string
    const endIndex = endMatch ? endMatch.index! : fullText.length;

    return fullText.slice(startIndex, endIndex);
  }

  /**
   * Split the bestiary section into pages using the header pattern.
   * Note: The header "part two | Bestiary" separates pages.
   */
  public splitBestiaryPages(bestiaryText: string): string[] {
    // We split by the header.
    // Filter out empty strings that might result from the split (e.g. if text starts with header)
    return bestiaryText
      .split(Chunker.PATTERNS.PAGE_HEADER)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * Filter out pages that don't start with a page number followed by a newline.
   * This removes introductory text or malformed pages.
   */
  public filterValidPages(pages: string[]): string[] {
    // Pattern: Start of string -> One or more digits -> Newline
    const validPagePattern = /^\d+(\r?\n|$)/;

    return pages.filter((page) => validPagePattern.test(page));
  }
}
