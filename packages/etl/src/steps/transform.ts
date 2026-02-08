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

        if (nextLine.startsWith('Attacks')) {
          let attacksVal = nextLine.replace('Attacks', '').trim();

          // Check if the NEXT line is a continuation
          // Heuristic: If the next line doesn't start with a known keyword and is indented or starts lowercase (often hard to tell in raw text),
          // OR if it starts with "or"
          const lookAheadIndex = k + 1;
          if (lookAheadIndex < lines.length) {
            const possibleContinuation = lines[lookAheadIndex].trim();
            // Keywords that start a new line
            const keywords = [
              'Speed',
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

        if (nextLine.startsWith('Speed')) {
          // Speed 50 Fly 100 Morale 11 XP 1,120
          // Regex to pull these out
          const speedMatch = nextLine.match(/Speed\s+(.*?)\s+Morale/i);
          if (speedMatch)
            creature.movement = isNaN(Number(speedMatch[1].trim()))
              ? speedMatch[1].trim()
              : Number(speedMatch[1].trim());

          const moraleMatch = nextLine.match(/Morale\s+(\d+)/i);
          if (moraleMatch) creature.morale = Number(moraleMatch[1]);

          const xpMatch = nextLine.match(/XP\s+([\d,]+)/i);
          if (xpMatch) creature.xp = Number(xpMatch[1].replace(/,/g, ''));
        }

        if (nextLine.startsWith('Encounters')) {
          creature.numberAppearing = nextLine.replace('Encounters', '').trim();
        }

        k++;
      }

      if (creature.name) {
        creatures.push(creature);
      }
    }
  }

  return creatures;
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
