import type { Creature } from '@dolmenwood/core';

/**
 * MortalStatParser
 *
 * Parses the shared Everyday Mortal stat block and applies it to each
 * individual mortal type. Unlike Animals/Bestiary creatures, all Everyday
 * Mortals share a single stat block.
 */

export interface SharedMortalStats {
  level: number;
  armourClass: number;
  hitDice: string;
  save: string;
  attacks: string[];
  movement: number | string;
  morale: number;
  xp: number;
  alignment: string;
}

export class MortalStatParser {
  // Matches the stat line 1: "Level 1 AC 10 HP 1d4 (2) Saves D12 R13 H14 B15 S16"
  private static readonly STAT_LINE_1 =
    /Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+([\dd+]+)\s*\(\d+\)\s+Saves\s+(D\d+\s+R\d+\s+H\d+\s+B\d+\s+S\d+)/i;

  // Matches the stat line 2: "Att Weapon (-1) Speed 40 Morale 6 XP 10"
  private static readonly ATT_PATTERN =
    /Att\s+(.*?)\s+(?=Speed|Fly|Swim|Morale)/i;
  private static readonly SPEED_PATTERN = /Speed\s+(\d+)/i;
  private static readonly MORALE_PATTERN = /Morale\s+(\d+)/i;
  private static readonly XP_PATTERN = /XP\s+([\d,]+)/i;

  // Meta line pattern: "sMall/MeDiuM Mortal-sentient-any alignMent"
  private static readonly META_LINE =
    /^(sMall|MeDiuM|large|sMall\/MeDiuM).*?-([a-zA-Z]+)\s+([a-zA-Z]+)$/im;

  // Shared stat block marker
  private static readonly SHARED_STAT_START = /^Everyday Mortal\n/m;

  /**
   * Parse the shared stat block from the full Everyday Mortals section text.
   *
   * @param sectionText The full Everyday Mortals section text.
   * @returns The shared stats applicable to all mortal types.
   */
  public parseSharedStatBlock(sectionText: string): SharedMortalStats {
    // Find the "Everyday Mortal" stat block (singular — not the section header)
    const statStart = MortalStatParser.SHARED_STAT_START.exec(sectionText);
    if (!statStart) {
      throw new Error(
        'MortalStatParser: Shared stat block "Everyday Mortal" not found in section text.',
      );
    }

    const statSection = sectionText.slice(statStart.index);
    const blob = statSection.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Parse stat line 1
    const stat1Match = MortalStatParser.STAT_LINE_1.exec(blob);
    if (!stat1Match) {
      throw new Error(
        `MortalStatParser: Stat Line 1 not found in shared stat block. Blob:\n${blob.slice(0, 200)}`,
      );
    }

    const level = parseInt(stat1Match[1], 10);
    const armourClass = parseInt(stat1Match[2], 10);
    const hitDice = stat1Match[3];
    const save = stat1Match[4];

    // Parse stat line 2 fields
    const attMatch = MortalStatParser.ATT_PATTERN.exec(blob);
    if (!attMatch) {
      throw new Error(
        `MortalStatParser: Att not found in shared stat block. Blob:\n${blob.slice(0, 200)}`,
      );
    }
    const attacks = [attMatch[1].trim()];

    const speedMatch = MortalStatParser.SPEED_PATTERN.exec(blob);
    const movement = speedMatch ? parseInt(speedMatch[1], 10) : 0;

    const moraleMatch = MortalStatParser.MORALE_PATTERN.exec(blob);
    const morale = moraleMatch ? parseInt(moraleMatch[1], 10) : 6;

    const xpMatch = MortalStatParser.XP_PATTERN.exec(blob);
    const xp = xpMatch ? parseInt(xpMatch[1].replace(/,/g, ''), 10) : 0;

    // Parse alignment from meta line
    const metaMatch = MortalStatParser.META_LINE.exec(statSection);
    let alignment = 'Any';
    if (metaMatch) {
      // The alignment is the last word, e.g. "any alignMent" -> "Any"
      const rawAlignment = metaMatch[3].toLowerCase().replace('ment', '');
      if (rawAlignment === 'align') {
        // "any alignMent" -> alignment keyword is in match[2] position area
        // Actually the full pattern is "sentient-any alignMent"
        // So match[2] = "any", match[3] = "alignMent"
        alignment = this.normalizeWord(metaMatch[2]);
      } else {
        alignment = this.normalizeWord(metaMatch[3]);
      }
    }

    return {
      level,
      armourClass,
      hitDice,
      save,
      attacks,
      movement,
      morale,
      xp,
      alignment,
    };
  }

  /**
   * Build a Creature object from a mortal name, description block, and shared stats.
   *
   * @param rawName The ALL CAPS creature name.
   * @param descriptionBlock The description text for this mortal type.
   * @param sharedStats The shared stat block parsed from the section.
   * @returns A Creature object.
   */
  public buildCreature(
    rawName: string,
    descriptionBlock: string,
    sharedStats: SharedMortalStats,
  ): Creature {
    const name = this.normalizeName(rawName);
    const description = descriptionBlock
      .replace(/^[A-Z][A-Z, -]+\n/, '') // Remove the name line
      .replace(/\s+/g, ' ')
      .trim();

    return {
      name,
      level: sharedStats.level,
      armourClass: sharedStats.armourClass,
      hitDice: sharedStats.hitDice,
      save: sharedStats.save,
      attacks: sharedStats.attacks,
      movement: sharedStats.movement,
      morale: sharedStats.morale,
      xp: sharedStats.xp,
      numberAppearing: '1',
      alignment: sharedStats.alignment,
      type: 'Everyday Mortal',
      kindred: 'Mortal',
      description,
    };
  }

  /**
   * Convert ALL CAPS name to Title Case.
   */
  private normalizeName(raw: string): string {
    return raw
      .split(/([, -]+)/)
      .map((segment) =>
        segment.match(/^[, -]+$/)
          ? segment
          : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
      )
      .join('');
  }

  /**
   * Normalize a mixed-case word.
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
