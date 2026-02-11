/**
 * AnimalSlicer
 *
 * Extracts the Animals section text from the full normalized document.
 * The Animals section spans from the "Animals" header (followed by "Mundane animals")
 * through to just before "Monster Rumours".
 */
export class AnimalSlicer {
  // Start: "Animals" header followed immediately by "Mundane animals" on next line.
  // This disambiguates from TOC entries like "Animals ..... 112".
  //
  // IMPORTANT: In the current normalized output, line 6829 contains a doubled subtitle
  // artifact: "Mundane animals and their giant cousins...Wood.Mundane animals and their..."
  // (no space before the second "Mundane"). The regex uses a prefix match so this is safe,
  // but if the Normalizer is updated to strip duplicate subtitles, this pattern must be
  // re-verified.
  private static readonly ANIMALS_START = /^Animals\nMundane animals/m;

  // End: "Monster Rumours" on its own line.
  private static readonly ANIMALS_END = /^Monster Rumours$/m;

  /**
   * Extract the Animals section from the full normalized text.
   *
   * @param text The full normalized document text.
   * @returns The Animals section text (trimmed), or empty string if not found.
   */
  public slice(text: string): string {
    const startMatch = AnimalSlicer.ANIMALS_START.exec(text);
    if (!startMatch) {
      console.warn('AnimalSlicer: Animals section not found in text.');
      return '';
    }

    const endMatch = AnimalSlicer.ANIMALS_END.exec(text);
    if (!endMatch) {
      // Graceful degradation: slice from start to EOF
      return text.slice(startMatch.index).trim();
    }

    return text.slice(startMatch.index, endMatch.index).trim();
  }
}
