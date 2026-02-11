import type { Creature, CreatureVariant } from '@dolmenwood/core';

/**
 * AdventurerStatParser
 *
 * Parses adventurer class blocks that contain 3 level variants (Levels 1, 3, 5).
 * Each variant has its own full stat block. The Level 1 stats become the top-level
 * creature fields, while Levels 3 and 5 are stored in the `variants` array.
 */

interface ParsedVariant {
  /** e.g. "Level 1 Bard (Rhymer)" */
  label: string;
  level: number;
  armourClass: number;
  hitDice: string;
  save: string;
  attacks: string[];
  movement: number | string;
  morale: number;
  xp: number;
  numberAppearing: string;
  alignment: string;
  description: string;
}

export class AdventurerStatParser {
  // Level sub-header: "Level 1 Bard (Rhymer)" or "Level 3 Cleric (Warden)"
  private static readonly LEVEL_HEADER = /^(Level\s+(\d+)\s+.+)$/gm;

  // Stat line 1: "Level N AC NN HP XdY (Z) Saves D.. R.. H.. B.. S.."
  private static readonly STAT_LINE_1 =
    /Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+([\dd+]+)\s*\(\d+\)\s+Saves\s+(D\d+\s+R\d+\s+H\d+\s+B\d+\s+S\d+)/i;

  // Stat line 2 fields
  private static readonly ATT_PATTERN =
    /Att\s+(.*?)\s+(?=Speed|Fly|Swim|Morale)/i;
  private static readonly SPEED_PATTERN = /Speed\s+(\d+)/i;
  private static readonly MORALE_PATTERN = /Morale\s+(\d+)/i;
  private static readonly XP_PATTERN = /XP\s+([\d,]+)/i;
  private static readonly ENC_PATTERN = /Enc\s+([\dd+]+)/i;

  // Meta line: "size/type By KinDreD-sentient-any alignMent"
  // or: "size/type By KinDreD-sentient-lawful or neutral"
  private static readonly ALIGNMENT_PATTERN = /sentient-(.+?)$/im;

  /**
   * Parse a full adventurer class block into a Creature with variants.
   *
   * @param rawName The ALL CAPS class name (e.g. "BARD").
   * @param blockText The full text block for this class.
   * @returns A Creature object with Level 1 as base and Levels 3/5 as variants.
   */
  public parse(rawName: string, blockText: string): Creature {
    const name = this.normalizeName(rawName);

    // Extract class-level description (prose between name header and first Level header)
    const classDescription = this.extractClassDescription(blockText, rawName);

    // Split the block into per-level sub-blocks
    const levelBlocks = this.splitLevelBlocks(blockText);

    if (levelBlocks.length === 0) {
      throw new Error(
        `AdventurerStatParser: No level blocks found in "${rawName}" block.`,
      );
    }

    // Parse each level block
    const parsedVariants: ParsedVariant[] = [];
    for (const lb of levelBlocks) {
      parsedVariants.push(this.parseLevelBlock(lb.label, lb.text));
    }

    // Level 1 becomes the base creature
    const base = parsedVariants[0];

    // Levels 3, 5 become variants
    const variants: CreatureVariant[] = parsedVariants.slice(1).map((v) => ({
      label: v.label,
      level: v.level,
      xp: v.xp,
      armourClass: v.armourClass,
      movement: v.movement,
      hitDice: v.hitDice,
      attacks: v.attacks,
      morale: v.morale,
      numberAppearing: v.numberAppearing,
      save: v.save,
      description: v.description || undefined,
    }));

    const creature: Creature = {
      name,
      level: base.level,
      alignment: base.alignment,
      xp: base.xp,
      numberAppearing: base.numberAppearing,
      armourClass: base.armourClass,
      movement: base.movement,
      hitDice: base.hitDice,
      attacks: base.attacks,
      morale: base.morale,
      save: base.save,
      type: 'Adventurer',
      kindred: 'Mortal',
      description: classDescription || base.description || undefined,
      ...(variants.length > 0 ? { variants } : {}),
    };

    return creature;
  }

  /**
   * Extract class-level description prose (between the class name header
   * and the first "Level N ..." sub-header).
   */
  private extractClassDescription(blockText: string, rawName: string): string {
    const lines = blockText.split('\n');
    const descLines: string[] = [];
    let started = false;

    for (const line of lines) {
      // Skip the class name header
      if (!started) {
        if (line.trim() === rawName) {
          started = true;
        }
        continue;
      }
      // Stop at first "Level N" sub-header
      if (/^Level\s+\d+\s+/i.test(line.trim())) {
        break;
      }
      descLines.push(line.trim());
    }

    return descLines
      .filter((l) => l.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split a class block into per-level sub-blocks.
   * Each sub-block starts at a "Level N ClassName (Title)" header.
   */
  private splitLevelBlocks(
    blockText: string,
  ): Array<{ label: string; text: string }> {
    const regex = new RegExp(AdventurerStatParser.LEVEL_HEADER.source, 'gm');
    const matches: Array<{ label: string; index: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(blockText)) !== null) {
      // Only match "Level N ClassName" patterns, not stat lines "Level N AC..."
      if (/^Level\s+\d+\s+AC\s/i.test(match[1])) {
        continue;
      }
      matches.push({ label: match[1], index: match.index });
    }

    const blocks: Array<{ label: string; text: string }> = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = matches[i + 1]?.index ?? blockText.length;
      blocks.push({
        label: matches[i].label,
        text: blockText.slice(start, end).trim(),
      });
    }

    return blocks;
  }

  /**
   * Parse a single level sub-block into stats.
   */
  private parseLevelBlock(label: string, text: string): ParsedVariant {
    // Flatten multi-line text for regex matching
    const blob = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Parse stat line 1
    const stat1Match = AdventurerStatParser.STAT_LINE_1.exec(blob);
    if (!stat1Match) {
      throw new Error(
        `AdventurerStatParser: Stat line not found for "${label}". Blob:\n${blob.slice(0, 200)}`,
      );
    }

    const level = parseInt(stat1Match[1], 10);
    const armourClass = parseInt(stat1Match[2], 10);
    const hitDice = stat1Match[3];
    const save = stat1Match[4];

    // Parse stat line 2 fields
    const attMatch = AdventurerStatParser.ATT_PATTERN.exec(blob);
    if (!attMatch) {
      throw new Error(
        `AdventurerStatParser: Att not found for "${label}". Blob:\n${blob.slice(0, 200)}`,
      );
    }
    const attacks = [attMatch[1].trim()];

    const speedMatch = AdventurerStatParser.SPEED_PATTERN.exec(blob);
    const movement = speedMatch ? parseInt(speedMatch[1], 10) : 0;

    const moraleMatch = AdventurerStatParser.MORALE_PATTERN.exec(blob);
    const morale = moraleMatch ? parseInt(moraleMatch[1], 10) : 6;

    const xpMatch = AdventurerStatParser.XP_PATTERN.exec(blob);
    const xp = xpMatch ? parseInt(xpMatch[1].replace(/,/g, ''), 10) : 0;

    const encMatch = AdventurerStatParser.ENC_PATTERN.exec(blob);
    const numberAppearing = encMatch ? encMatch[1] : '1';

    // Parse alignment from meta line
    const alignmentMatch = AdventurerStatParser.ALIGNMENT_PATTERN.exec(text);
    let alignment = 'Any';
    if (alignmentMatch) {
      alignment = this.normalizeAlignment(alignmentMatch[1]);
    }

    // Extract description (gear, spells, skills, companions, etc.)
    const description = this.extractLevelDescription(text, label);

    return {
      label,
      level,
      armourClass,
      hitDice,
      save,
      attacks,
      movement,
      morale,
      xp,
      numberAppearing,
      alignment,
      description,
    };
  }

  /**
   * Extract description lines from a level block (gear, spells, skills, etc.).
   * Skips the label line, meta line, and stat lines.
   */
  private extractLevelDescription(text: string, label: string): string {
    const lines = text.split('\n');
    const descLines: string[] = [];
    let pastStats = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip the label line
      if (trimmed === label) continue;

      // Skip meta line (size/type By KinDreD...)
      if (/^size\/type\s/i.test(trimmed)) continue;

      // Skip stat lines (Level N AC...)
      if (/^Level\s+\d+\s+AC\s/i.test(trimmed)) {
        pastStats = true;
        continue;
      }

      // Skip the attack/speed line (Att Weapon...)
      if (/^Att\s/i.test(trimmed)) {
        pastStats = true;
        continue;
      }

      if (pastStats) {
        descLines.push(trimmed);
      }
    }

    return descLines.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalize alignment text.
   * "any alignMent" -> "Any"
   * "lawful or neutral" -> "Lawful or Neutral"
   */
  private normalizeAlignment(raw: string): string {
    const cleaned = raw
      .replace(/alignMent/i, '')
      .trim()
      .toLowerCase();

    if (!cleaned || cleaned === 'any') return 'Any';

    return cleaned
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
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
}
