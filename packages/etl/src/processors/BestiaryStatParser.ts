import type { Creature } from '@dolmenwood/core';

/**
 * BestiaryStatParser
 *
 * Parses a single creature text block from the Bestiary (Part Two) format
 * into a Creature object conforming to CreatureSchema.
 *
 * This parser handles the full-page stat block format used in the Bestiary,
 * where stats are spread across multiple labeled lines (Attacks, Speed, Morale,
 * XP, Encounters, Behaviour, Speech, Possessions, Hoard).
 *
 * Key differences from CompactStatParser:
 * - "Attacks" instead of "Att"
 * - "Encounters" instead of "Enc" (with lair percentage info)
 * - Additional fields on separate lines: Behaviour, Speech, Possessions, Hoard
 * - Name is Title Case (not ALL CAPS)
 * - Page number as first line
 * - Description text is often duplicated due to PDF column merge
 * - Variant creatures are skipped (to be handled later)
 */
export class BestiaryStatParser {
  // --- Meta Line Patterns ---
  // Primary: decorative font artifacts (e.g. "sMall", "MeDiuM", "large")
  private static readonly META_LINE =
    /^(sMall|MeDiuM|large)\s+([^\s-]+)-(.*?)$/im;

  // Fallback: normalized text
  private static readonly META_LINE_FALLBACK =
    /^(small|medium|large)\s+([^\s-]+)-(.*?)$/im;

  // Multi-size: abbreviated slash-separated (e.g. "sM./MeD./lg.")
  private static readonly META_LINE_MULTI_SIZE =
    /^((?:sM\.|sMall|MeD\.|MeDiuM|lg\.|large|small|medium)(?:\/(?:sM\.|sMall|MeD\.|MeDiuM|lg\.|large|small|medium))+)\s+([^\s-]+)-(.*?)$/im;

  // --- Stat Line 1 ---
  // "Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14"
  // HP can be dice notation "4d8 (18)" or text like "By species"
  // Saves letters may have optional space before digits (e.g. "R 5")
  /* eslint-disable security/detect-unsafe-regex -- linear pattern on controlled ETL input */
  private static readonly STAT_LINE_1 =
    /Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+([\dd+]+)\s*\((\d+)\)\s+Saves\s+(D\s*\d+\s+R\s*\d+\s+H\s*\d+\s+B\s*\d+\s+S\s*\d+)/i;

  // Fallback: HP is non-dice text (e.g. "By species")
  private static readonly STAT_LINE_1_TEXT_HP =
    /Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+(.+?)\s+Saves\s+(D\s*\d+\s+R\s*\d+\s+H\s*\d+\s+B\s*\d+\s+S\s*\d+)/i;
  /* eslint-enable security/detect-unsafe-regex */

  // --- Bestiary-specific patterns (operate on individual lines or blobs) ---
  private static readonly ATTACKS_PATTERN = /^Attacks?\s+([\s\S]*?)$/im;
  private static readonly SPEED_PATTERN = /Speed\s+(\d+)/i;
  private static readonly FLY_PATTERN = /Fly\s+(\d+)/i;
  private static readonly SWIM_PATTERN = /Swim\s+(\d+)/i;
  private static readonly BURROW_PATTERN = /Burrow\s+(\d+)/i;
  private static readonly MORALE_PATTERN = /Morale\s+(\d+)/i;
  private static readonly XP_PATTERN = /XP\s+([\d,]+)/i;
  private static readonly ENCOUNTERS_PATTERN = /^Encounters?\s+([\dd+]+|\d+)/im;
  private static readonly HOARD_PATTERN = /Hoard\s+(.+)/i;

  // Sections that mark the end of the stat/ability area
  private static readonly SECTION_HEADERS = /^(TRAITS|ENCOUNTERS|LAIRS)\b/m;

  // Ability header: lines like "Dark sight: Can see..."
  private static readonly ABILITY_HEADER = /^[A-Z][a-z][^:\n]*:\s/m;

  // Page number line (just digits on their own line)
  private static readonly PAGE_NUMBER = /^\d+$/;

  /**
   * Check whether a text block contains a stat block (has a Level line).
   * Use this to filter out overview/descriptive pages before parsing.
   */
  public static isStatBlock(block: string): boolean {
    return /^Level\s+\d+/im.test(block);
  }

  /**
   * Parse a bestiary creature text block into a Creature object.
   *
   * @param block The full text block including page number, name, description,
   *              stats, abilities, traits, encounters.
   * @returns A Creature object.
   */
  public parse(block: string): Creature {
    // Step 1: Extract name (skip leading page number line)
    const name = this.extractName(block);

    // Step 2: Extract and deduplicate description
    const description = this.extractDescription(block);

    // Step 3: Parse meta line
    const meta = this.parseMeta(block, name);

    // Step 4: Build stats blob (from Level line through the labeled stat lines)
    const statsBlob = this.buildStatsBlob(block, name);

    // Step 5: Parse core stats
    const stats1 = this.parseStatLine1(statsBlob, name);

    // Step 6: Parse attacks
    const attacks = this.parseAttacks(block, name);

    // Step 7: Parse movement, morale, xp from the Speed/Morale/XP line
    const movement = this.parseMovement(statsBlob);
    const morale = this.parseMorale(statsBlob, name);
    const xp = this.parseXp(statsBlob, name);

    // Step 8: Parse encounters (numberAppearing)
    const numberAppearing = this.parseEncounters(block, name);

    // Step 9: Parse treasure (Hoard)
    const treasure = this.parseTreasure(block);

    // Step 10: Extract special abilities
    const abilities = this.extractAbilities(block);

    // Compose full description
    const fullDescription = abilities
      ? `${description}\n${abilities}`
      : description;

    return {
      name,
      level: stats1.level,
      armourClass: stats1.armourClass,
      hitDice: stats1.hitDice,
      save: stats1.save,
      attacks,
      movement,
      morale,
      xp,
      numberAppearing,
      treasure,
      alignment: meta.alignment,
      type: 'Bestiary',
      kindred: meta.kindred,
      description: fullDescription || undefined,
    };
  }

  /**
   * Extract the creature name from the block.
   * The first line is typically a page number, the second line is the name.
   */
  private extractName(block: string): string {
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Skip page number lines (just digits)
      if (BestiaryStatParser.PAGE_NUMBER.test(trimmed)) continue;
      return trimmed;
    }
    throw new Error(
      `BestiaryStatParser: Could not extract name. Block:\n${block.slice(0, 200)}`,
    );
  }

  /**
   * Extract and deduplicate the description text.
   * The PDF extraction often duplicates text due to column merging.
   */
  private extractDescription(block: string): string {
    const lines = block.split('\n');

    // Find the name line index
    let nameIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (BestiaryStatParser.PAGE_NUMBER.test(trimmed)) continue;
      nameIdx = i;
      break;
    }
    if (nameIdx === -1) return '';

    // Find the meta line index
    let metaIdx = -1;
    for (let i = nameIdx + 1; i < lines.length; i++) {
      if (
        BestiaryStatParser.META_LINE.test(lines[i]) ||
        BestiaryStatParser.META_LINE_FALLBACK.test(lines[i]) ||
        BestiaryStatParser.META_LINE_MULTI_SIZE.test(lines[i])
      ) {
        metaIdx = i;
        break;
      }
    }
    if (metaIdx === -1) return '';

    // Description is everything between name and meta line
    const descLines = lines.slice(nameIdx + 1, metaIdx);
    const rawDesc = descLines.join(' ').replace(/\s+/g, ' ').trim();

    return this.deduplicateDescription(rawDesc);
  }

  /**
   * Deduplicate description that was doubled by PDF column merging.
   *
   * The PDF extraction concatenates the same text twice. The duplication
   * pattern is that the entire description block is repeated, so the first
   * half of the joined text should match the second half. We try multiple
   * split points around the midpoint to find the match.
   *
   * For multi-line descriptions, each line may be duplicated individually,
   * resulting in patterns like "Sentence A.Sentence A. Sentence B.Sentence B."
   * We also handle this by checking for consecutive sentence-level repeats.
   */
  private deduplicateDescription(text: string): string {
    if (!text) return text;

    // Strategy 1: Exact midpoint split (with tolerance)
    const len = text.length;
    for (
      let mid = Math.floor(len / 2) - 10;
      mid <= Math.floor(len / 2) + 10;
      mid++
    ) {
      if (mid <= 0 || mid >= len) continue;
      const firstHalf = text.slice(0, mid).trim();
      const secondHalf = text.slice(mid).trim();
      if (firstHalf === secondHalf) {
        return firstHalf;
      }
    }

    // Strategy 2: Consecutive sentence-level deduplication.
    // Split on sentence boundaries and remove consecutive duplicates.
    // Pattern: "A.A. B.B." -> "A. B."
    const sentences = text.split(/(?<=\.)\s*/);
    if (sentences.length >= 2) {
      const deduplicated: string[] = [];
      for (let i = 0; i < sentences.length; i++) {
        const current = sentences[i].trim();
        if (!current) continue;
        const prev =
          deduplicated.length > 0 ? deduplicated[deduplicated.length - 1] : '';
        if (current !== prev) {
          deduplicated.push(current);
        }
      }
      if (deduplicated.length < sentences.filter((s) => s.trim()).length) {
        return deduplicated.join(' ').trim();
      }
    }

    return text;
  }

  /**
   * Parse the meta line to extract size, kindred, and alignment.
   */
  private parseMeta(
    block: string,
    name: string,
  ): { size: string; kindred: string; alignment: string } {
    // Try multi-size first (more specific pattern)
    const multiMatch = BestiaryStatParser.META_LINE_MULTI_SIZE.exec(block);
    if (multiMatch) {
      const size = this.normalizeMultiSize(multiMatch[1]);
      const kindredRaw = multiMatch[2];
      const kindred = this.normalizeWord(kindredRaw);
      const rest = multiMatch[3];
      const lastDash = rest.lastIndexOf('-');
      const alignment =
        lastDash === -1
          ? this.normalizeWord(rest)
          : this.normalizeWord(rest.slice(lastDash + 1));
      return { size, kindred, alignment };
    }

    let match = BestiaryStatParser.META_LINE.exec(block);
    if (!match) {
      match = BestiaryStatParser.META_LINE_FALLBACK.exec(block);
    }
    if (!match) {
      throw new Error(
        `BestiaryStatParser: Meta line not found for "${name}". Block:\n${block.slice(0, 200)}`,
      );
    }

    const sizeRaw = match[1].toLowerCase();
    const size =
      sizeRaw === 'small' ? 'Small' : sizeRaw === 'medium' ? 'Medium' : 'Large';

    const kindredRaw = match[2];
    const kindred = this.normalizeWord(kindredRaw);

    // The rest is "intelligence-alignment" or just "alignment"
    const rest = match[3];
    const lastDash = rest.lastIndexOf('-');
    const alignment =
      lastDash === -1
        ? this.normalizeWord(rest)
        : this.normalizeWord(rest.slice(lastDash + 1));

    return { size, kindred, alignment };
  }

  /**
   * Build a stats blob from the Level line through the Encounters/Behaviour/Speech lines.
   * This joins multiple lines into a single searchable string.
   */
  private buildStatsBlob(block: string, name: string): string {
    const lines = block.split('\n');

    // Find the Level line
    let levelIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^Level\s+\d+/i.test(lines[i].trim())) {
        levelIdx = i;
        break;
      }
    }
    if (levelIdx === -1) {
      throw new Error(
        `BestiaryStatParser: Level line not found for "${name}". Block:\n${block.slice(0, 200)}`,
      );
    }

    // Collect lines from Level through the last labeled stat line
    // Stop at: ability headers, section headers (TRAITS, ENCOUNTERS, LAIRS),
    // or end of block
    const statLines: string[] = [];
    const labeledLinePattern =
      /^(Level|Attacks?|Speed|Fly|Swim|Burrow|Morale|XP|Encounters?|Behaviour|Speech|Possessions|Hoard)\b/i;

    for (let i = levelIdx; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      // Stop at section headers
      if (BestiaryStatParser.SECTION_HEADERS.test(trimmed)) break;

      // Stop at ability headers (but not labeled stat lines)
      if (
        BestiaryStatParser.ABILITY_HEADER.test(trimmed) &&
        !labeledLinePattern.test(trimmed)
      ) {
        break;
      }

      // Skip page number lines embedded in multi-page entries
      if (BestiaryStatParser.PAGE_NUMBER.test(trimmed)) continue;

      statLines.push(trimmed);
    }

    return statLines.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse Stat Line 1: Level, AC, HP, Saves.
   * Tries dice notation HP first, then falls back to text HP.
   */
  private parseStatLine1(
    blob: string,
    name: string,
  ): {
    level: number;
    armourClass: number;
    hitDice: string;
    save: string;
  } {
    // Try primary pattern (dice notation HP)
    const match = BestiaryStatParser.STAT_LINE_1.exec(blob);
    if (match) {
      return {
        level: parseInt(match[1], 10),
        armourClass: parseInt(match[2], 10),
        hitDice: match[3],
        save: match[5],
      };
    }

    // Fallback: text HP (e.g. "By species")
    const textMatch = BestiaryStatParser.STAT_LINE_1_TEXT_HP.exec(blob);
    if (textMatch) {
      return {
        level: parseInt(textMatch[1], 10),
        armourClass: parseInt(textMatch[2], 10),
        hitDice: textMatch[3].trim(),
        save: textMatch[4],
      };
    }

    throw new Error(
      `BestiaryStatParser: Stat Line 1 not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
    );
  }

  /**
   * Parse attacks from the block.
   * In the bestiary format, attacks start with "Attacks " and continue until
   * the next labeled line (Speed, Morale, etc.).
   */
  private parseAttacks(block: string, name: string): string[] {
    const lines = block.split('\n');

    // Find the Attacks line
    let attackStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^Attacks?\s+/i.test(lines[i].trim())) {
        attackStart = i;
        break;
      }
    }
    if (attackStart === -1) {
      throw new Error(
        `BestiaryStatParser: Attacks line not found for "${name}". Block:\n${block.slice(0, 200)}`,
      );
    }

    // Collect attack text (may wrap across lines until Speed/Fly/Morale line)
    const attackLines: string[] = [];
    // First line: strip the "Attacks " prefix
    const firstLine = lines[attackStart].trim().replace(/^Attacks?\s+/i, '');
    attackLines.push(firstLine);

    // Continue collecting lines until we hit Speed/Morale/XP or another labeled line
    const nextLabelPattern =
      /^(Speed|Fly|Swim|Burrow|Morale|XP|Encounters?|Behaviour|Speech|Possessions|Hoard|Level)\b/i;
    for (let i = attackStart + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (nextLabelPattern.test(trimmed)) break;
      if (BestiaryStatParser.SECTION_HEADERS.test(trimmed)) break;
      if (BestiaryStatParser.ABILITY_HEADER.test(trimmed)) break;
      // Continuation of attacks (e.g. "or 2 bramble darts...")
      attackLines.push(trimmed);
    }

    const attackStr = attackLines.join(' ').replace(/\s+/g, ' ').trim();
    return this.splitAttacks(attackStr);
  }

  /**
   * Split attack string into individual attacks.
   * Splits on " and " or " or " only when outside parentheses.
   */
  private splitAttacks(attStr: string): string[] {
    const attacks: string[] = [];
    let current = '';
    let depth = 0;
    const words = attStr.split(/\s+/);

    for (const word of words) {
      for (const ch of word) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }

      if (depth === 0 && (word === 'and' || word === 'or')) {
        if (current.trim()) {
          attacks.push(current.trim());
        }
        current = '';
      } else {
        current += (current ? ' ' : '') + word;
      }
    }

    if (current.trim()) {
      attacks.push(current.trim());
    }

    return attacks.filter((a) => a.length > 0);
  }

  /**
   * Compose movement from Speed, Fly, Swim, Burrow fields in the blob.
   */
  private parseMovement(blob: string): number | string {
    const parts: string[] = [];

    const speedMatch = BestiaryStatParser.SPEED_PATTERN.exec(blob);
    if (speedMatch) {
      parts.push(speedMatch[1]);
    }

    const flyMatch = BestiaryStatParser.FLY_PATTERN.exec(blob);
    if (flyMatch) {
      parts.push(`Fly ${flyMatch[1]}`);
    }

    const swimMatch = BestiaryStatParser.SWIM_PATTERN.exec(blob);
    if (swimMatch) {
      parts.push(`Swim ${swimMatch[1]}`);
    }

    const burrowMatch = BestiaryStatParser.BURROW_PATTERN.exec(blob);
    if (burrowMatch) {
      parts.push(`Burrow ${burrowMatch[1]}`);
    }

    if (parts.length === 0) {
      return 0;
    }

    if (parts.length === 1 && /^\d+$/.test(parts[0])) {
      return parseInt(parts[0], 10);
    }

    return parts.join(' ');
  }

  /**
   * Parse Morale from the stats blob.
   */
  private parseMorale(blob: string, name: string): number {
    const match = BestiaryStatParser.MORALE_PATTERN.exec(blob);
    if (!match) {
      throw new Error(
        `BestiaryStatParser: Morale not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    return parseInt(match[1], 10);
  }

  /**
   * Parse XP from the stats blob (strip comma thousands separator).
   */
  private parseXp(blob: string, name: string): number {
    const match = BestiaryStatParser.XP_PATTERN.exec(blob);
    if (!match) {
      throw new Error(
        `BestiaryStatParser: XP not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    return parseInt(match[1].replace(/,/g, ''), 10);
  }

  /**
   * Parse Encounters line to extract numberAppearing.
   * Format: "Encounters 2d4 (75% in lair)" or "Encounters 1d6 (no lair)" or "Encounters 1 (10% in lair)"
   */
  private parseEncounters(block: string, name: string): string {
    const match = BestiaryStatParser.ENCOUNTERS_PATTERN.exec(block);
    if (!match) {
      throw new Error(
        `BestiaryStatParser: Encounters line not found for "${name}". Block:\n${block.slice(0, 200)}`,
      );
    }
    return match[1];
  }

  /**
   * Parse treasure from Hoard field.
   * Hoard can be on the same line as Possessions or on its own line.
   * If Possessions is "None" and there's no Hoard, return undefined.
   */
  private parseTreasure(block: string): string | undefined {
    const hoardMatch = BestiaryStatParser.HOARD_PATTERN.exec(block);
    if (hoardMatch) {
      return hoardMatch[1].trim();
    }
    return undefined;
  }

  /**
   * Extract special abilities text.
   * Abilities appear after the stat lines (Possessions/Hoard) and before
   * section headers (TRAITS, ENCOUNTERS, LAIRS).
   */
  private extractAbilities(block: string): string {
    const lines = block.split('\n');

    // Find the last stat line (Possessions or Hoard)
    let abilityStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^(Possessions|Hoard)\b/i.test(trimmed)) {
        abilityStart = i + 1;
      }
    }

    if (abilityStart === -1 || abilityStart >= lines.length) return '';

    // Collect ability lines until section headers
    const abilityLines: string[] = [];
    for (let i = abilityStart; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (BestiaryStatParser.SECTION_HEADERS.test(trimmed)) break;
      // Skip page numbers in multi-page entries
      if (BestiaryStatParser.PAGE_NUMBER.test(trimmed)) continue;
      abilityLines.push(trimmed);
    }

    if (abilityLines.length === 0) return '';

    return abilityLines.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalize a mixed-case word from the decorative font.
   * e.g. "unDeaD" -> "Undead", "seMi-intelligent" -> "Semi Intelligent"
   */
  private normalizeWord(word: string): string {
    return word
      .trim()
      .split(/[-\s]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  /**
   * Normalize a multi-size string like "sM./MeD./lg." to "Small/Medium/Large".
   */
  private normalizeMultiSize(raw: string): string {
    const sizeMap: Record<string, string> = {
      'sm.': 'Small',
      small: 'Small',
      'med.': 'Medium',
      medium: 'Medium',
      'lg.': 'Large',
      large: 'Large',
    };

    return raw
      .split('/')
      .map((part) => {
        const key = part.trim().toLowerCase();
        return sizeMap[key] ?? this.normalizeWord(part);
      })
      .join('/');
  }
}
