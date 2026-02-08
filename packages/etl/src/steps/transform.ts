import { Creature } from '@dolmenwood/core';

export function parseCreatures(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];

  // 1. Extract Bestiary Section (Roughly)
  // We look for "Part Two" and "Part Three" as boundaries
  const bestiaryMatch = text.match(
    /part two\s*[|:]?\s*bestiary([\s\S]*?)part three/i,
  );
  const sectionContent = bestiaryMatch ? bestiaryMatch[1] : text;

  // 2. Identify Stats Block Pattern
  // Pattern: Level 6 AC 17 HP 6d8 (27) Saves D9 R10 H11 B12 S13
  const statsLineRegex =
    /Level\s+(\d+|[\d\w]+)\s+AC\s+(\d+)\s+HP\s+([\dd]+).*?Saves\s+(.*)/i;

  // We split the text by lines to process linearly or find indices
  const lines = sectionContent.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const statsMatch = line.match(statsLineRegex);

    if (statsMatch) {
      // Found a creature anchor!
      const creature: Partial<Creature> = {};

      // Parse Stats Line
      creature.level = isNaN(Number(statsMatch[1]))
        ? statsMatch[1]
        : Number(statsMatch[1]);
      creature.armourClass = Number(statsMatch[2]);
      creature.hitDice = statsMatch[3];
      creature.save = statsMatch[4].trim();

      // Look Backwards for Name and Alignment
      let j = i - 1;
      let foundAlignment = false;

      // Heuristic: The line immediately preceding stats is usually Alignment/Type
      // e.g. "MeDiuM unDeaD—sentient—chaotic"
      while (j >= 0) {
        const prevLine = lines[j].trim();
        if (!prevLine) {
          j--;
          continue;
        }

        if (!foundAlignment) {
          creature.alignment = parseAlignment(prevLine);
          if (creature.alignment) {
            foundAlignment = true;
          }
          // The line before stats is usually the Type/Alignment line, even if we fail to parse alignment strictly
          // We assume this line is NOT the name or description start.
        } else {
          // We are now looking for Name or Description.
          // The Description is usually between Name and Alignment.
          // The Name is a short line, usually capitalized.

          // Stop conditions for searching backwards:
          // - Page number (digits only)
          // - "Bestiary" header
          // - "Names:" line
          if (
            /^\d+$/.test(prevLine) ||
            /part two/i.test(prevLine) ||
            /Names:/i.test(prevLine)
          ) {
            break;
          }

          // Heuristic: Name is usually short (< 50 chars) and doesn't end in punctuation like '.' (unless abbr)
          // Description lines are usually longer.
          if (prevLine.length < 50 && !prevLine.endsWith('.')) {
            // Likely the Name
            creature.name = prevLine;
            // If we found the name, we assume description is between Name (j) and Alignment (i-1)
            // But for now, let's just grab the name and stop going back.
            break;
          }
        }
        j--;
      }

      // Look Forwards for Attacks, Speed, Morale, XP
      // Expected structure:
      // Attacks ...
      // Speed ... Fly ... Morale ... XP ...
      // Encounters ...

      let k = i + 1;
      while (k < lines.length && k < i + 10) {
        // Look ahead ~10 lines
        const nextLine = lines[k].trim();

        const attacksMatch = nextLine.match(/^(Attacks?|Att)\b/i);
        if (attacksMatch) {
          let attacksVal = nextLine.replace(attacksMatch[0], '').trim();

          // Check if this line ALSO contains Speed/Morale/XP
          // e.g. "Att Staff (+3, 1d4) Speed 50 Morale 8 XP 180"
          const inlineStats = parseSecondaryStats(nextLine, creature);
          if (inlineStats) {
            // If we found stats, we need to cut the attack string short
            // Find the index where the stats start
            const statsStartMatch = nextLine.match(
              /\s+(Speed|Swim|Fly|Burrow|Climb)\b/i,
            );
            if (statsStartMatch && statsStartMatch.index) {
              attacksVal = nextLine
                .substring(0, statsStartMatch.index)
                .replace(attacksMatch[0], '')
                .trim();
            }
          }

          // Check if the NEXT line is a continuation
          // Heuristic: If the next line doesn't start with a known keyword
          const lookAheadIndex = k + 1;
          if (lookAheadIndex < lines.length) {
            const possibleContinuation = lines[lookAheadIndex].trim();
            // Keywords that start a new line
            const keywords = [
              'Speed',
              'Swim',
              'Fly',
              'Burrow',
              'Climb',
              'Encounters',
              'Behaviour',
              'Speech',
              'Possessions',
              'Hoard',
              'Undead',
              'Immunities',
            ];
            const startsWithKeyword = keywords.some((kw) =>
              possibleContinuation.startsWith(kw),
            );

            if (!startsWithKeyword && possibleContinuation.length > 0) {
              attacksVal += ' ' + possibleContinuation;
              k++; // Skip processing this line as a new line
            }
          }
          creature.attacks = [attacksVal];
        }

        // Check for Speed/Movement line (if not already parsed inline)
        if (
          !creature.movement &&
          /^(Speed|Swim|Fly|Burrow|Climb)\b/i.test(nextLine)
        ) {
          parseSecondaryStats(nextLine, creature);
        }

        if (nextLine.startsWith('Encounters')) {
          creature.numberAppearing = nextLine.replace('Encounters', '').trim();
        }

        k++;
      }

      // Default for unique creatures lacking Encounters line
      if (!creature.numberAppearing) {
        creature.numberAppearing = '1 (Unique)';
      }

      if (creature.name) {
        creatures.push(creature);
      }
    }
  }

  return creatures;
}

function parseSecondaryStats(
  line: string,
  creature: Partial<Creature>,
): boolean {
  let found = false;

  // Speed 50 Fly 100 Morale 11 XP 1,120
  // Or: Swim 40 Morale 8 XP 20
  // Regex to pull these out. We look for Movement keyword ... Morale
  const speedMatch = line.match(
    /(Speed|Swim|Fly|Burrow|Climb)\s+(.*?)\s+Morale/i,
  );
  if (speedMatch) {
    const rawMove = speedMatch[2].trim();
    // If the captured group is just a number, convert to number.
    // If it's "0 or 20", keep as string.
    // If it's complex like "50 Fly 100", the regex might capture "50 Fly 100" if greedy enough?
    // Actually the regex above `(Speed|Swim|Fly|Burrow|Climb)\s+(.*?)\s+Morale` is non-greedy on `.*?` but it stops at Morale.
    // So "Speed 50 Fly 100 Morale" -> group 2 is "50 Fly 100".
    // If it's just "Swim 40 Morale" -> group 2 is "40".

    // However, if the line started with "Swim", we might want to include "Swim" in the value if we just return a number/string.
    // The previous code did: `creature.movement = ...`
    // If the movement type is not Speed, we should probably preserve the type in the string if possible, or just the value.
    // The current Zod schema expects string | number.
    // If it's "Swim 40", and we return 40, we lose "Swim".
    // But the previous code just took the value.
    // Let's stick to the value for now, but if it's not starting with Speed, maybe we should prepend?
    // "Swim 40" -> "40 (Swim)"? Or just "40". The previous logic seemed to just take the number.
    // Let's just take the value found between the keyword and Morale.

    creature.movement = isNaN(Number(rawMove)) ? rawMove : Number(rawMove);
    found = true;
  }

  const moraleMatch = line.match(/Morale\s+(\d+)/i);
  if (moraleMatch) {
    creature.morale = Number(moraleMatch[1]);
    found = true;
  }

  const xpMatch = line.match(/XP\s+([\d,]+)/i);
  if (xpMatch) {
    creature.xp = Number(xpMatch[1].replace(/,/g, ''));
    found = true;
  }

  return found;
}

function parseAlignment(line: string): string | undefined {
  // "MeDiuM unDeaD—sentient—chaotic"
  // We want to extract "Chaotic", "Neutral", "Lawful", or "Any"
  const alignMatch = line.match(/(Chaotic|Neutral|Lawful|Any)/i);
  if (alignMatch) {
    // Capitalize first letter
    const val = alignMatch[1].toLowerCase();
    return val.charAt(0).toUpperCase() + val.slice(1);
  }
  return undefined;
}
