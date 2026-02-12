import { TreasureSpec, TreasureCode } from '../schemas/treasure.js';
import { Result, success, failure } from '../utils/Result.js';

/**
 * Regex matching a standard treasure code: C/R/M followed by 1-2 digits,
 * with an optional space between the letter and the number (PDF artefact).
 * Examples: "C4", "R 3", "M10"
 */
const CODE_RE = /^([CRM])\s?(\d{1,2})$/;

/**
 * Regex matching a multiplied code in parentheses: e.g. "(R1 × 3)" or "(R1 x 3)"
 * Captures the tier letter, level, and multiplier.
 */
const MULTIPLIED_RE = /^\(([CRM])\s?(\d{1,2})\s*[×x]\s*(\d+)\)$/;

/**
 * Parses creature treasure hoard code strings (e.g. "C4 + R4 + M1")
 * into structured TreasureSpec objects.
 *
 * Handles:
 * - Standard codes: "C4", "R 3", "M10"
 * - Multi-code strings: "C4 + R4 + M1"
 * - Multiplied codes: "(R1 × 3)" expands to 3 separate R1 entries
 * - Extras: non-code segments like "4d20 pots or jugs"
 * - Parenthetical notes attached to last code: "M3 (remains of victims)"
 * - Special text-only strings: "Ivory", "Magical honey"
 * - "None" returns null (no treasure)
 */
export class TreasureCodeParser {
  parse(input: string): Result<TreasureSpec | null> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return failure(new Error('Empty treasure string'));
    }

    if (trimmed === 'None') {
      return success(null);
    }

    // Check if the string contains any treasure codes at all.
    // If not, treat the entire string as a single extra.
    if (!this.containsCodes(trimmed)) {
      return success({ codes: [], extras: [trimmed] });
    }

    return this.parseCodeString(trimmed);
  }

  /**
   * Returns true if the input contains at least one recognizable
   * treasure code (C/R/M followed by a digit), either standalone
   * or as a + separated segment.
   */
  private containsCodes(input: string): boolean {
    // Look for a code pattern that is either at the start/end of string
    // or bounded by " + " delimiters. We need to be careful not to match
    // things like "1-in-4 chance" where the digits follow non-code letters.
    const segments = input.split(/\s*\+\s*/);
    return segments.some(
      (seg) => CODE_RE.test(seg.trim()) || MULTIPLIED_RE.test(seg.trim()),
    );
  }

  private parseCodeString(input: string): Result<TreasureSpec> {
    const codes: TreasureCode[] = [];
    const extras: string[] = [];

    // Split on " + " but we need to handle the case where a parenthetical
    // note is attached directly to the last code without a "+" separator.
    // e.g. "C3 + R 3 + M3 (remains of victims)"
    // Strategy: split on " + ", then for each segment check if it's a code
    // potentially followed by a parenthetical note.
    const segments = input.split(/\s*\+\s*/);

    for (const rawSegment of segments) {
      const segment = rawSegment.trim();
      if (segment.length === 0) continue;

      // Try standard code match
      const codeMatch = CODE_RE.exec(segment);
      if (codeMatch) {
        codes.push({
          tier: codeMatch[1] as 'C' | 'R' | 'M',
          level: parseInt(codeMatch[2], 10),
        });
        continue;
      }

      // Try multiplied code match: (R1 × 3)
      const multMatch = MULTIPLIED_RE.exec(segment);
      if (multMatch) {
        const tier = multMatch[1] as 'C' | 'R' | 'M';
        const level = parseInt(multMatch[2], 10);
        const count = parseInt(multMatch[3], 10);
        for (let i = 0; i < count; i++) {
          codes.push({ tier, level });
        }
        continue;
      }

      // Try code with parenthetical note: "M3 (remains of victims)"
      const codeWithNoteMatch = /^([CRM])\s?(\d{1,2})\s+(\(.+\))$/.exec(
        segment,
      );
      if (codeWithNoteMatch) {
        codes.push({
          tier: codeWithNoteMatch[1] as 'C' | 'R' | 'M',
          level: parseInt(codeWithNoteMatch[2], 10),
        });
        extras.push(codeWithNoteMatch[3]);
        continue;
      }

      // Not a code — treat as an extra
      extras.push(segment);
    }

    return success({ codes, extras });
  }
}
