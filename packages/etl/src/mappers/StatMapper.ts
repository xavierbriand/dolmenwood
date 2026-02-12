/**
 * StatMapper — shared parsing utilities for converting Python-extracted
 * JSON stat fields into the domain types used by CreatureSchema.
 *
 * The Python extractor (PyMuPDF) produces string values for all stat fields.
 * These functions convert them to the typed values expected by the core schema.
 */

/**
 * Raw stats shape as produced by the Python extractor.
 */
export interface RawStats {
  level: string;
  ac: string;
  hp: string;
  saves: string;
  attacks: string;
  speed?: string;
  fly?: string;
  swim?: string;
  burrow?: string;
  webs?: string;
  morale: string;
  xp: string;
  encounters?: string;
  hoard?: string;
}

/**
 * Parse level: returns a number for integer levels, or a string for
 * fractional/composite levels (e.g. "½", "1+1").
 */
export function parseLevel(raw: string): number | string {
  const n = Number(raw);
  if (!Number.isNaN(n) && Number.isInteger(n)) {
    return n;
  }
  return raw;
}

/**
 * Parse armour class as an integer.
 */
export function parseArmourClass(raw: string): number {
  return Number(raw);
}

/**
 * Parse hit dice — strips the average value in parentheses.
 * "4d8 (18)" → "4d8", "3d8+3 (16)" → "3d8+3"
 */
export function parseHitDice(raw: string): string {
  return raw.replace(/\s*\(.*\)/, '').trim();
}

/**
 * Split an attack string into an array. Splits on " or " and " and "
 * that appear outside of parentheses.
 */
export function parseAttacks(raw: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (depth === 0) {
      // Check for " or " or " and " at this position
      const remaining = raw.slice(i);
      if (remaining.startsWith(' or ')) {
        result.push(current.trim());
        current = '';
        i += 3; // skip " or " (loop will advance 1 more)
        continue;
      }
      if (remaining.startsWith(' and ')) {
        result.push(current.trim());
        current = '';
        i += 4; // skip " and " (loop will advance 1 more)
        continue;
      }
      current += ch;
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Compose movement from separate speed/fly/swim/burrow/webs fields.
 * Returns a number when only speed is present, or a composite string otherwise.
 */
export function parseMovement(stats: {
  speed?: string;
  fly?: string;
  swim?: string;
  burrow?: string;
  webs?: string;
}): number | string {
  const parts: string[] = [];

  if (stats.speed) {
    parts.push(stats.speed);
  }
  if (stats.fly) {
    parts.push(`Fly ${stats.fly}`);
  }
  if (stats.swim) {
    parts.push(`Swim ${stats.swim}`);
  }
  if (stats.burrow) {
    parts.push(`Burrow ${stats.burrow}`);
  }
  if (stats.webs) {
    parts.push(`Webs ${stats.webs}`);
  }

  const composite = parts.join(' ');

  // If only speed, return as number
  if (
    stats.speed &&
    !stats.fly &&
    !stats.swim &&
    !stats.burrow &&
    !stats.webs
  ) {
    return Number(stats.speed);
  }

  return composite;
}

/**
 * Parse morale — extracts the base integer value, ignoring conditional
 * notes in parentheses or after commas.
 */
export function parseMorale(raw: string): number {
  // Extract leading integer
  const match = raw.match(/^(\d+)/);
  if (match) {
    return Number(match[1]);
  }
  return Number(raw);
}

/**
 * Parse XP — strips commas and returns integer.
 */
export function parseXp(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/**
 * Parse number appearing — strips lair percentages and notes.
 * "2d4 (75% in lair)" → "2d4"
 * "1d4 (no lair)" → "1d4"
 */
export function parseNumberAppearing(raw: string): string {
  return raw.replace(/\s*\(.*\)/, '').trim();
}

/**
 * Parse the meta line into alignment and kindred.
 * Format: "Size Kindred—Intelligence—Alignment"
 * e.g. "Medium Undead—Semi-Intelligent—Chaotic"
 * e.g. "Small/Medium Mortal—Sentient—Any Alignment"
 * e.g. "Size/Type By Kindred—Sentient—Any Alignment" (adventurers)
 */
export function parseMeta(meta: string): {
  alignment: string;
  kindred?: string;
} {
  // Split on em-dash (—)
  const parts = meta.split('—').map((s) => s.trim());

  if (parts.length < 3) {
    return { alignment: 'Any' };
  }

  // Alignment is the last segment
  let alignment = parts[parts.length - 1];
  if (alignment === 'Any Alignment') {
    alignment = 'Any';
  }

  // Kindred is the last word of the first segment (after size prefix)
  const sizeKindred = parts[0];

  // Handle "Size/Type By Kindred" (adventurers) → default to Mortal
  if (/by kindred/i.test(sizeKindred)) {
    return { alignment, kindred: 'Mortal' };
  }

  // Extract kindred: remove size prefix (Small, Medium, Large, Sm./Med./Lg., Small/Medium)
  // The kindred is whatever remains after removing the size part
  const kindred = sizeKindred
    .replace(/^(?:Sm\.\/Med\.\/Lg\.|Small\/Medium|Small|Medium|Large)\s*/i, '')
    .trim();

  return {
    alignment,
    kindred: kindred || undefined,
  };
}
