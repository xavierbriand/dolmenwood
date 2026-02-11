/**
 * FactionParser
 *
 * Extracts the "Creatures and Factions" section from normalized text
 * and builds a mapping of creature name -> faction names.
 *
 * The section format is:
 *   Creatures and Factions
 *   The following creatures are associated with one of the ...
 *   FactionName: creature1, creature2, creature3.
 *   FactionName: creature1, creature2.
 *   ...
 *
 * Each faction entry ends with a period. Entries may span multiple lines.
 * Creature names may include parenthetical notes (stripped during parsing).
 */
export class FactionParser {
  // Section boundaries
  private static readonly SECTION_START = /^Creatures and Factions$/m;
  private static readonly SECTION_END = /^part one \|/m;

  /**
   * Extract the "Creatures and Factions" block from the full normalized text.
   */
  public extractSection(text: string): string {
    const startMatch = FactionParser.SECTION_START.exec(text);
    if (!startMatch) {
      return '';
    }

    const endMatch = FactionParser.SECTION_END.exec(
      text.slice(startMatch.index),
    );
    const endIndex = endMatch ? startMatch.index + endMatch.index : text.length;

    return text.slice(startMatch.index, endIndex).trim();
  }

  /**
   * Parse the section text into a map of faction name -> creature names.
   *
   * Returns a Map where keys are faction names (e.g. "Atanuwë")
   * and values are arrays of normalized creature names (e.g. ["Centaur-Bestial", "Cobbin"]).
   */
  public parseFactions(sectionText: string): Map<string, string[]> {
    const factions = new Map<string, string[]>();

    if (!sectionText) {
      return factions;
    }

    // Join the section into a single string, collapsing line breaks.
    // This handles entries that wrap across lines.
    const collapsed = sectionText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .join(' ');

    // Each faction entry matches: "FactionName: creature1, creature2."
    // We look for patterns like "Word(s): stuff." where the colon starts the list
    // and a period ends it, followed by either another faction or end of text.
    const entryPattern =
      /([A-ZÀ-Ž][A-Za-zÀ-ž\s]+?):\s*((?:[^.]+\.(?:\s|$))+?(?=\s*[A-ZÀ-Ž][A-Za-zÀ-ž\s]+?:|$))/g;

    let match;
    while ((match = entryPattern.exec(collapsed)) !== null) {
      const factionName = match[1].trim();
      const creatureList = match[2].trim();

      // Skip the introductory sentence
      if (factionName === 'Creatures and Factions') continue;
      if (factionName.includes('following creatures')) continue;

      const creatures = this.parseCreatureList(creatureList);
      if (creatures.length > 0) {
        factions.set(factionName, creatures);
      }
    }

    return factions;
  }

  /**
   * Parse a comma-separated creature list, normalizing names to Title-Case.
   * Strips parenthetical notes and trailing periods.
   */
  private parseCreatureList(listText: string): string[] {
    // Remove trailing period
    const cleaned = listText.replace(/\.\s*$/, '');

    return cleaned
      .split(',')
      .map((entry) => {
        // Strip parenthetical notes like "(may serve the Cold Prince)"
        let name = entry.replace(/\s*\([^)]*\)/g, '').trim();
        // Normalize to Title-Case with hyphenated parts
        name = this.toCreatureName(name);
        return name;
      })
      .filter((name) => name.length > 0);
  }

  /**
   * Convert a raw creature name to the canonical Title-Case format
   * used by the bestiary (e.g. "centaur-bestial" -> "Centaur-Bestial",
   * "wicker giant" -> "Wicker Giant", "devil goat" -> "Devil Goat").
   */
  private toCreatureName(raw: string): string {
    return raw
      .split(/(-|\s)/)
      .map((part) => {
        if (part === '-' || part === ' ') return part;
        if (part.length === 0) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  }

  /**
   * Build a reverse lookup: creature name (lower-case) -> faction names.
   */
  public buildCreatureFactionMap(
    factions: Map<string, string[]>,
  ): Map<string, string[]> {
    const creatureToFactions = new Map<string, string[]>();

    for (const [faction, creatures] of factions) {
      for (const creature of creatures) {
        const key = creature.toLowerCase();
        const existing = creatureToFactions.get(key) ?? [];
        existing.push(faction);
        creatureToFactions.set(key, existing);
      }
    }

    return creatureToFactions;
  }

  /**
   * Convenience method: extract, parse, and build the reverse lookup in one call.
   */
  public parse(normalizedText: string): Map<string, string[]> {
    const section = this.extractSection(normalizedText);
    const factions = this.parseFactions(section);
    return this.buildCreatureFactionMap(factions);
  }
}
