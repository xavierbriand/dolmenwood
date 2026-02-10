export interface CreatureBlock {
  page: number;
  name: string;
  raw: string;
}

export class Chunker {
  /**
   * Splits the full PDF text into pages based on the form feed character.
   */
  public splitByPage(text: string): string[] {
    return text.split('\f');
  }

  /**
   * Scans a single page for creature entries.
   * A creature entry is defined as:
   * 1. An ALL CAPS line (the name)
   * 2. Followed immediately (ignoring blank lines) by a line starting with "AC"
   */
  public identifyCreatureBlocks(
    pageText: string,
    pageNumber: number,
  ): CreatureBlock[] {
    const lines = pageText.split(/\r?\n/);
    const blocks: CreatureBlock[] = [];

    // Track indices of where creatures start
    const starts: { index: number; name: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (this.isCandidateHeader(line)) {
        // Look ahead for confirmation
        if (this.isFollowedByStats(lines, i + 1)) {
          starts.push({ index: i, name: line });
        }
      }
    }

    // Now verify we have valid blocks and slice them
    for (let k = 0; k < starts.length; k++) {
      const current = starts[k];
      const next = starts[k + 1];

      // End index is either the start of the next creature or end of page
      const endIndex = next ? next.index : lines.length;

      const blockLines = lines.slice(current.index, endIndex);

      // Filter out leading/trailing blank lines from the block for cleanliness
      const raw = blockLines.join('\n').trim();

      blocks.push({
        page: pageNumber,
        name: current.name,
        raw: raw,
      });
    }

    return blocks;
  }

  private isCandidateHeader(line: string): boolean {
    // Must be at least 3 chars long
    if (line.length < 3) return false;

    // Must be uppercase (ignoring numbers/symbols)
    // We compare the line to its uppercase version
    const upper = line.toUpperCase();
    if (line !== upper) return false;

    // Must contain at least one letter (avoid "123" or "---")
    if (!/[A-Z]/.test(line)) return false;

    // Should not be "AC X" itself (rare edge case if line is just "AC 7")
    if (line.startsWith('AC ')) return false;

    return true;
  }

  private isFollowedByStats(lines: string[], startIndex: number): boolean {
    // Look ahead up to 3 lines for "AC" (allowing for some spacing)
    const MAX_LOOKAHEAD = 3;
    let scanned = 0;

    for (let i = startIndex; i < lines.length && scanned < MAX_LOOKAHEAD; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      scanned++;
      // Check if line starts with AC
      // Pattern: Start of line, optional space, "AC", optional punctuation, space or digit
      if (/^AC\s*[\d.,]/.test(line)) {
        return true;
      }

      // If we hit a non-empty line that isn't AC, this wasn't a header
      return false;
    }
    return false;
  }
}
