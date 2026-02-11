import type { Creature } from '@dolmenwood/core';

/**
 * CompactStatParser
 *
 * Parses a single creature text block (from the Animals/Appendices format)
 * into a Creature object conforming to CreatureSchema.
 *
 * This parser handles the condensed stat block format used in Part Three: Appendices,
 * where multiple creatures share a page and stats are packed into 2-3 lines.
 */
export class CompactStatParser {
  // --- Meta Line Patterns ---

  // Primary: matches the decorative font artifacts (e.g. "sMall", "MeDiuM")
  // Group 2 uses [^\s-]+ to capture only the kindred word (e.g. "aniMal", "Bug")
  // stopping at the first dash, which separates kindred from intelligence-alignment.
  private static readonly META_LINE =
    /^(sMall|MeDiuM|large)\s+([^\s-]+)-(.*?)$/im;

  // Fallback: case-insensitive match for normalized text
  private static readonly META_LINE_FALLBACK =
    /^(small|medium|large)\s+([^\s-]+)-(.*?)$/im;

  // --- Stat Line 1 Pattern ---
  // Matches: "Level 4 AC 16 HP 4d8 (18) Saves D10 R11 H12 B13 S14"
  private static readonly STAT_LINE_1 =
    /Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+([\dd+]+)\s*\((\d+)\)\s+Saves\s+(D\d+\s+R\d+\s+H\d+\s+B\d+\s+S\d+)/i;

  // --- Stat Line 2 Patterns (operate on blob) ---
  private static readonly ATT_PATTERN =
    /Att\s+(.*?)\s+(?=Speed|Fly|Swim|Burrow|Webs|Morale)/i;
  private static readonly SPEED_PATTERN = /Speed\s+(\d+)/i;
  private static readonly FLY_PATTERN = /Fly\s+(\d+)/i;
  private static readonly SWIM_PATTERN = /Swim\s+(\d+)/i;
  private static readonly BURROW_PATTERN = /Burrow\s+(\d+)/i;
  private static readonly WEBS_PATTERN = /Webs\s+(\d+)/i;
  private static readonly MORALE_PATTERN = /Morale\s+(\d+)/i;
  private static readonly XP_PATTERN = /XP\s+([\d,]+)/i;
  private static readonly ENC_PATTERN = /Enc\s+([\dd+]+|\d+)/i;
  // HOARD and POSS patterns match to end of blob (safe because blob
  // is bounded — it excludes ability text below the stat lines).
  private static readonly HOARD_PATTERN = /Hoard\s+(.+)/i;
  private static readonly POSS_PATTERN = /Possessions\s+(.+)/i;

  // --- Description Pattern ---
  // Everything between the name line and the meta line
  private static readonly DESC_PATTERN =
    /^[A-Z][A-Z, -]+\n([\s\S]*?)(?=^(?:sMall|MeDiuM|large)\s)/im;

  // --- Ability Header Pattern ---
  // Matches lines like "Poison: ...", "Morale: ...", "Hoard: ..."
  // Uses [^:\n]* to avoid matching across newlines (prevents stat lines from
  // being interpreted as ability headers when a colon appears later in the block).
  private static readonly ABILITY_HEADER = /^[A-Z][a-z][^:\n]*:\s/m;

  /**
   * Convert ALL CAPS name to Title Case.
   * e.g. "SPRITE, GIANT" -> "Sprite, Giant", "LIZARD-VIPER" -> "Lizard-Viper"
   */
  public normalizeName(raw: string): string {
    return raw
      .split(/([, -]+)/) // Split on delimiters, keeping them
      .map((segment) =>
        segment.match(/^[, -]+$/)
          ? segment // Keep delimiters as-is
          : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
      )
      .join('');
  }

  /**
   * Parse a creature text block into a Creature object.
   *
   * @param rawName The ALL CAPS creature name from the header.
   * @param block The full text block including name, description, stats, abilities.
   * @returns A Creature object.
   */
  public parse(rawName: string, block: string): Creature {
    const name = this.normalizeName(rawName);

    // Extract description (prose between name and meta line)
    const description = this.extractDescription(block);

    // Parse meta line (size/type/intelligence/alignment)
    const meta = this.parseMeta(block, name);

    // Build stats blob (join multi-line stats into single string)
    const blob = this.buildStatsBlob(block, name);

    // Parse stat line 1
    const stats1 = this.parseStatLine1(blob, name);

    // Parse stat line 2
    const stats2 = this.parseStatLine2(blob, name);

    // Extract special abilities
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
      attacks: stats2.attacks,
      movement: stats2.movement,
      morale: stats2.morale,
      xp: stats2.xp,
      numberAppearing: stats2.numberAppearing,
      treasure: stats2.treasure,
      alignment: meta.alignment,
      type: 'Animal',
      kindred: meta.kindred,
      description: fullDescription,
    };
  }

  /**
   * Parse the meta line to extract size, type/kindred, and alignment.
   */
  private parseMeta(
    block: string,
    name: string,
  ): { size: string; kindred: string; alignment: string } {
    let match = CompactStatParser.META_LINE.exec(block);
    if (!match) {
      match = CompactStatParser.META_LINE_FALLBACK.exec(block);
    }
    if (!match) {
      throw new Error(
        `CompactStatParser: Meta line not found for "${name}". Block:\n${block.slice(0, 200)}`,
      );
    }

    const sizeRaw = match[1].toLowerCase();
    const size =
      sizeRaw === 'small' ? 'Small' : sizeRaw === 'medium' ? 'Medium' : 'Large';

    // Type/kindred is the first segment (e.g. "aniMal", "Bug")
    const kindredRaw = match[2];
    const kindred = this.normalizeWord(kindredRaw);

    // The rest is "intelligence-alignment" or just "alignment"
    // e.g. "aniMal intelligence-neutral" or "seMi-intelligent-chaotic"
    const rest = match[3];
    // Alignment is the last segment after the final "-"
    const lastDash = rest.lastIndexOf('-');
    const alignment =
      lastDash === -1
        ? this.normalizeWord(rest)
        : this.normalizeWord(rest.slice(lastDash + 1));

    return { size, kindred, alignment };
  }

  /**
   * Build a "stats blob" by joining all stat lines into a single string.
   * This handles Stat Line 2 wrapping across lines.
   */
  private buildStatsBlob(block: string, name: string): string {
    // Find from meta line to first ability header (or end of block)
    const metaStart = block.search(/^(?:sMall|MeDiuM|large|small|medium)\s+/im);
    if (metaStart === -1) {
      throw new Error(
        `CompactStatParser: Meta line not found for stats blob in "${name}".`,
      );
    }

    const restOfBlock = block.slice(metaStart);

    // Skip past the meta line before looking for ability headers, since the
    // meta line itself could match patterns like "large ..." which starts with
    // a capital letter. Find the first newline after the meta line to skip it.
    const firstNewline = restOfBlock.indexOf('\n');
    if (firstNewline === -1) {
      return restOfBlock.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const afterMeta = restOfBlock.slice(firstNewline + 1);
    const abilityInAfterMeta = afterMeta.search(
      CompactStatParser.ABILITY_HEADER,
    );

    let statsSection: string;
    if (abilityInAfterMeta === -1) {
      // No abilities found -- everything after meta is stats
      statsSection = restOfBlock;
    } else {
      // Stats end where abilities begin
      statsSection = restOfBlock.slice(
        0,
        firstNewline + 1 + abilityInAfterMeta,
      );
    }

    return statsSection.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse Stat Line 1 fields: Level, AC, HP, Saves.
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
    const match = CompactStatParser.STAT_LINE_1.exec(blob);
    if (!match) {
      throw new Error(
        `CompactStatParser: Stat Line 1 not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }

    return {
      level: parseInt(match[1], 10),
      armourClass: parseInt(match[2], 10),
      hitDice: match[3],
      save: match[5],
    };
  }

  /**
   * Parse Stat Line 2 fields: Att, Speed/Fly/Swim/Burrow/Webs, Morale, XP, Enc, Hoard.
   */
  private parseStatLine2(
    blob: string,
    name: string,
  ): {
    attacks: string[];
    movement: number | string;
    morale: number;
    xp: number;
    numberAppearing: string;
    treasure: string | undefined;
  } {
    // Parse attacks
    const attMatch = CompactStatParser.ATT_PATTERN.exec(blob);
    if (!attMatch) {
      throw new Error(
        `CompactStatParser: Att not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    const attacks = this.parseAttacks(attMatch[1]);

    // Parse movement
    const movement = this.parseMovement(blob);

    // Parse morale (first number only)
    const moraleMatch = CompactStatParser.MORALE_PATTERN.exec(blob);
    if (!moraleMatch) {
      throw new Error(
        `CompactStatParser: Morale not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    const morale = parseInt(moraleMatch[1], 10);

    // Parse XP (strip commas)
    const xpMatch = CompactStatParser.XP_PATTERN.exec(blob);
    if (!xpMatch) {
      throw new Error(
        `CompactStatParser: XP not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    const xp = parseInt(xpMatch[1].replace(/,/g, ''), 10);

    // Parse Enc
    const encMatch = CompactStatParser.ENC_PATTERN.exec(blob);
    if (!encMatch) {
      throw new Error(
        `CompactStatParser: Enc not found for "${name}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    const numberAppearing = encMatch[1];

    // Parse Hoard or Possessions (optional)
    let treasure: string | undefined;
    const hoardMatch = CompactStatParser.HOARD_PATTERN.exec(blob);
    if (hoardMatch) {
      treasure = hoardMatch[1].trim();
    }
    if (!treasure) {
      const possMatch = CompactStatParser.POSS_PATTERN.exec(blob);
      if (possMatch) {
        treasure = possMatch[1].trim();
      }
    }

    return { attacks, movement, morale, xp, numberAppearing, treasure };
  }

  /**
   * Parse the Att string into individual attack strings.
   * Splits on " and " or " or " only when they appear outside parentheses.
   *
   * Examples:
   *   "2 claws (+3, 1d3) and bite (+3, 1d6)" -> ["2 claws (+3, 1d3)", "bite (+3, 1d6)"]
   *   "Swarm (+2, 2 or 4)" -> ["Swarm (+2, 2 or 4)"] (no split — "or" is inside parens)
   */
  private parseAttacks(attStr: string): string[] {
    const attacks: string[] = [];
    let current = '';
    let depth = 0;
    const words = attStr.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Track parenthesis depth
      for (const ch of word) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }

      // Split on "and" or "or" only at depth 0 (outside parentheses)
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
   * Compose movement string from Speed, Fly, Swim, Burrow, Webs fields.
   */
  private parseMovement(blob: string): number | string {
    const parts: string[] = [];

    const speedMatch = CompactStatParser.SPEED_PATTERN.exec(blob);
    if (speedMatch) {
      parts.push(speedMatch[1]);
    }

    const flyMatch = CompactStatParser.FLY_PATTERN.exec(blob);
    if (flyMatch) {
      parts.push(`Fly ${flyMatch[1]}`);
    }

    const swimMatch = CompactStatParser.SWIM_PATTERN.exec(blob);
    if (swimMatch) {
      parts.push(`Swim ${swimMatch[1]}`);
    }

    const burrowMatch = CompactStatParser.BURROW_PATTERN.exec(blob);
    if (burrowMatch) {
      parts.push(`Burrow ${burrowMatch[1]}`);
    }

    const websMatch = CompactStatParser.WEBS_PATTERN.exec(blob);
    if (websMatch) {
      parts.push(`Webs ${websMatch[1]}`);
    }

    if (parts.length === 0) {
      return 0; // Should not happen with valid data
    }

    // If only a plain number (Speed only), return as number
    if (parts.length === 1 && /^\d+$/.test(parts[0])) {
      return parseInt(parts[0], 10);
    }

    return parts.join(' ');
  }

  /**
   * Extract the prose description (between name and meta line).
   */
  private extractDescription(block: string): string {
    const match = CompactStatParser.DESC_PATTERN.exec(block);
    if (!match) {
      return '';
    }
    return match[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract special abilities text (everything after stats, if any).
   */
  private extractAbilities(block: string): string {
    // Find meta line start
    const metaStart = block.search(/^(?:sMall|MeDiuM|large|small|medium)\s+/im);
    if (metaStart === -1) return '';

    const restOfBlock = block.slice(metaStart);
    // Skip the meta line
    const firstNewline = restOfBlock.indexOf('\n');
    if (firstNewline === -1) return '';

    const afterMeta = restOfBlock.slice(firstNewline + 1);

    // Find the first ability header in the text after meta
    const abilityStart = afterMeta.search(CompactStatParser.ABILITY_HEADER);
    if (abilityStart === -1) return '';

    return afterMeta.slice(abilityStart).replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalize a mixed-case word from the decorative font.
   * e.g. "aniMal" -> "Animal", "seMi-intelligent" -> "Semi-Intelligent"
   */
  private normalizeWord(word: string): string {
    return word
      .trim()
      .split(/[-\s]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }
}
