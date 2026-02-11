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
   * Extract the Table of Contents section
   */
  public extractTOC(fullText: string): string {
    const startMatch = fullText.match(Chunker.PATTERNS.TOC_START);
    const endMatch = fullText.match(Chunker.PATTERNS.PART_ONE_START);

    if (!startMatch) return '';

    const startIndex = startMatch.index! + startMatch[0].length;
    const endIndex = endMatch ? endMatch.index! : fullText.length;

    return fullText.slice(startIndex, endIndex).trim();
  }

  /**
   * Parse the Bestiary list from the TOC text.
   * Looks for the "Bestiary" section (starts with page number)
   * and extracts items (Name Page) until the next section (starts with page number).
   */
  public parseBestiaryList(
    tocText: string,
  ): Array<{ name: string; page: number }> {
    const lines = tocText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const creatures: Array<{ name: string; page: number }> = [];
    let insideBestiary = false;

    // Pattern for section header: "11 Bestiary" (Number then Text)
    const bestiaryHeaderPattern = /^\d+\s+Bestiary/i;
    // Pattern for next section: Starts with number (e.g. "102 Appendices")
    const nextSectionPattern = /^\d+\s+/;
    // Pattern for entry: "Name 12" (Text then Number)
    const entryPattern = /^(.*?)\s+(\d+)$/;

    for (const line of lines) {
      if (!insideBestiary) {
        if (bestiaryHeaderPattern.test(line)) {
          insideBestiary = true;
        }
        continue;
      }

      // If we are inside Bestiary and hit a line starting with a number, it's the next section
      if (nextSectionPattern.test(line)) {
        break;
      }

      // Parse entry
      const match = line.match(entryPattern);
      if (match) {
        creatures.push({
          name: match[1].trim(),
          page: parseInt(match[2], 10),
        });
      }
    }

    return creatures;
  }

  /**
   * Parse Appendices subsections: Adventurers, Everyday Mortals, Animals.
   */
  public parseAppendicesList(tocText: string): {
    adventurers: Array<{ name: string; page: number }>;
    everydayMortals: Array<{ name: string; page: number }>;
    animals: Array<{ name: string; page: number }>;
  } {
    const lines = tocText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const result = {
      adventurers: [] as Array<{ name: string; page: number }>,
      everydayMortals: [] as Array<{ name: string; page: number }>,
      animals: [] as Array<{ name: string; page: number }>,
    };

    let currentSection: 'adventurers' | 'everydayMortals' | 'animals' | null =
      null;

    // Entry Pattern: "Name 123"
    const entryPattern = /^(.*?)\s+(\d+)$/;

    for (const line of lines) {
      // 1. Detect Subsection Start
      if (/^Adventurers\s+\d+/i.test(line)) {
        currentSection = 'adventurers';
        continue;
      }
      if (/^Everyday Mortals\s+\d+/i.test(line)) {
        currentSection = 'everydayMortals';
        continue;
      }
      if (/^Animals\s+\d+/i.test(line)) {
        currentSection = 'animals';
        continue;
      }

      // 2. Detect Subsection End (Start of next section)
      if (/^Adventuring Parties\s+\d+/i.test(line)) {
        currentSection = null; // End of Adventurers
        continue;
      }
      if (/^Monster Rumours\s+\d+/i.test(line)) {
        currentSection = null; // End of Animals
        continue;
      }
      // Note: Everyday Mortals ends when Animals starts, handled by "Detect Subsection Start" check above?
      // Actually, Animals follows Everyday Mortals immediately in my observed TOC?
      // Let's re-check the normalized file:
      // "Everyday Mortals 110" ... entries ... "Animals 112"
      // So detecting "Animals" will switch the mode correctly.

      // 3. Parse Items if in a section
      if (currentSection) {
        const match = line.match(entryPattern);
        if (match) {
          result[currentSection].push({
            name: match[1].trim(),
            page: parseInt(match[2], 10),
          });
        }
      }
    }

    return result;
  }

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
