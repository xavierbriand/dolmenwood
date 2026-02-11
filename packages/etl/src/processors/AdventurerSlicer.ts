/**
 * AdventurerSlicer
 *
 * Extracts the Adventurers section text from the full normalized document.
 * The section spans from the "Adventurers" header (followed by "Ne'er-do-wells")
 * through to just before "Adventuring Parties".
 */
export class AdventurerSlicer {
  // Start: "Adventurers" header followed by "Ne'er-do-wells" on same/next line.
  // This disambiguates from TOC entries like "Adventurers 104".
  private static readonly ADVENTURERS_START = /^Adventurers\nNe'er-do-wells/m;

  // End: "Adventuring Parties" on its own line (the next appendix section).
  private static readonly ADVENTURERS_END = /^Adventuring Parties$/m;

  /**
   * Extract the Adventurers section from the full normalized text.
   *
   * @param text The full normalized document text.
   * @returns The Adventurers section text (trimmed), or empty string if not found.
   */
  public slice(text: string): string {
    const startMatch = AdventurerSlicer.ADVENTURERS_START.exec(text);
    if (!startMatch) {
      console.warn('AdventurerSlicer: Adventurers section not found in text.');
      return '';
    }

    const endMatch = AdventurerSlicer.ADVENTURERS_END.exec(text);
    if (!endMatch || endMatch.index < startMatch.index) {
      // Graceful degradation: slice from start to EOF
      return text.slice(startMatch.index).trim();
    }

    return text.slice(startMatch.index, endMatch.index).trim();
  }
}
