/**
 * MortalSlicer
 *
 * Extracts the Everyday Mortals section text from the full normalized document.
 * The section spans from the "Everyday Mortals" header (followed by "Non-adventuring folk")
 * through to just before "Animals".
 */
export class MortalSlicer {
  // Start: "Everyday Mortals" header followed by "Non-adventuring folk" on next line.
  // This disambiguates from TOC entries like "Everyday Mortals 110".
  private static readonly MORTALS_START =
    /^Everyday Mortals\nNon-adventuring folk/m;

  // End: "Animals" on its own line (the next appendix section).
  private static readonly MORTALS_END = /^Animals$/m;

  /**
   * Extract the Everyday Mortals section from the full normalized text.
   *
   * @param text The full normalized document text.
   * @returns The Everyday Mortals section text (trimmed), or empty string if not found.
   */
  public slice(text: string): string {
    const startMatch = MortalSlicer.MORTALS_START.exec(text);
    if (!startMatch) {
      console.warn('MortalSlicer: Everyday Mortals section not found in text.');
      return '';
    }

    const endMatch = MortalSlicer.MORTALS_END.exec(text);
    if (!endMatch || endMatch.index < startMatch.index) {
      // Graceful degradation: slice from start to EOF
      return text.slice(startMatch.index).trim();
    }

    return text.slice(startMatch.index, endMatch.index).trim();
  }
}
