export class PageMerger {
  /**
   * Merges raw page strings based on Table of Contents (TOC) entry points.
   *
   * Logic:
   * 1. If a page number matches a TOC entry, it starts a new record.
   * 2. If a page number does NOT match, it is appended to the previous record.
   *
   * @param pages Array of raw page strings (format: "PageNum\nContent...")
   * @param tocStartPages Set of page numbers that defined the start of a new entry
   * @returns Array of merged content strings
   */
  public merge(pages: string[], tocStartPages: Set<number>): string[] {
    const merged: string[] = [];
    let currentEntry: string | null = null;

    for (const pageContent of pages) {
      const pageNum = this.extractPageNumber(pageContent);

      if (pageNum !== null && tocStartPages.has(pageNum)) {
        // This is a Start Page (e.g., Page 80 "Sprite")
        // If we were building an entry, push it first
        if (currentEntry !== null) {
          merged.push(currentEntry);
        }
        // Start new entry
        currentEntry = pageContent;
      } else {
        // This is a Continuation Page (e.g., Page 81)
        // Append to the current entry if it exists
        if (currentEntry !== null) {
          // Add a newline to ensure separation, though usually the raw text has it
          currentEntry += '\n' + pageContent;
        } else {
          // Edge case: We found a continuation page before any start page.
          // Treat it as a start page or log warning?
          // For safety in this pipeline, we'll treat it as a start page to preserve data.
          currentEntry = pageContent;
        }
      }
    }

    // Push the final entry
    if (currentEntry !== null) {
      merged.push(currentEntry);
    }

    return merged;
  }

  private extractPageNumber(content: string): number | null {
    // Matches "12\n..." at the start of the string
    const match = content.match(/^(\d+)\n/);
    return match ? parseInt(match[1], 10) : null;
  }
}
