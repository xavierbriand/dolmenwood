import { Creature } from '@dolmenwood/core';

export function parseCreatures(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];

  // 1. Identify Sections
  const partTwoIndex = text.search(/part two\s*[|:]?\s*bestiary/i);
  const partThreeIndex = text.search(/part three/i); // Start of Appendices

  // Bestiary Section
  let bestiaryText = '';
  if (partTwoIndex !== -1) {
    if (partThreeIndex !== -1 && partThreeIndex > partTwoIndex) {
      bestiaryText = text.substring(partTwoIndex, partThreeIndex);
    } else {
      bestiaryText = text.substring(partTwoIndex);
    }
    creatures.push(...parseBestiary(bestiaryText));
  }

  // Appendices Section
  if (partThreeIndex !== -1) {
    const appendicesText = text.substring(partThreeIndex);
    creatures.push(...parseAppendices(appendicesText));
  }

  return creatures;
}

function parseAppendices(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];

  // Indices for sub-sections
  const adventurersHeader = /Adventurers\s*$/m;
  const advPartiesHeader = /Adventuring Parties\s*$/m;
  const mortalsHeader = /Everyday Mortals\s*$/m;
  const animalsHeader = /Animals\s*$/m;
  const rumoursHeader = /Monster Rumours\s*$/m;

  const advIndex = text.search(adventurersHeader);
  const advPartiesIndex = text.search(advPartiesHeader);
  const mortalsIndex = text.search(mortalsHeader);
  const animalsIndex = text.search(animalsHeader);
  const rumoursIndex = text.search(rumoursHeader);

  // 1. Adventurers
  if (advIndex !== -1 && advPartiesIndex > advIndex) {
    const section = text.substring(advIndex, advPartiesIndex);
    creatures.push(...parseAdventurers(section));
  }

  // 2. Everyday Mortals
  if (mortalsIndex !== -1 && animalsIndex > mortalsIndex) {
    const section = text.substring(mortalsIndex, animalsIndex);
    creatures.push(...parseEverydayMortals(section));
  }

  // 3. Animals
  if (animalsIndex !== -1) {
    const end = rumoursIndex !== -1 ? rumoursIndex : text.length;
    if (end > animalsIndex) {
      const section = text.substring(animalsIndex, end);
      creatures.push(...parseAnimals(section));
    }
  }

  return creatures;
}

function parseAdventurers(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];
  const lines = text.split(/\r?\n/);

  // Regex for Level 1 line
  // e.g., "Level 1 Bard (Rhymer) AC 12 HP..."
  const level1Regex = /Level\s+1\s+([A-Za-z]+).*?(?:AC|HP)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(level1Regex);

    if (match) {
      const className = match[1];
      const creature: Partial<Creature> = {
        name: className,
        type: 'Mortal',
        level: 1,
      };

      // Use the compact stats parser
      // Line 1 contains basic stats
      const line1Regex =
        /AC\s+(\d+)\s+HP\s+([\dd]+)\s*(?:\(\d+\))?\s+Saves\s+(.*)$/i;
      const statsMatch = line.match(line1Regex);

      if (statsMatch) {
        creature.armourClass = Number(statsMatch[1]);
        creature.hitDice = statsMatch[2];
        creature.save = statsMatch[3].trim();
      }

      // Consume subsequent lines for compact stats
      // We start looking from i (current line) because parseCompactStats expects lines array
      // But parseCompactStats assumes line 1 is "Level X AC Y".
      // Adventurers line 1 is "Level 1 Class AC Y".
      // So we handle line 1 manually above, and use a helper for line 2+

      parseCompactSecondaryStats(lines, i, creature);

      creatures.push(creature);
    }
  }
  return creatures;
}

function parseEverydayMortals(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];

  // 1. Extract the shared "Everyday Mortal" stats.
  const candidates = parseBestiary(text);
  const template = candidates.find(
    (c) => c.name === 'Everyday Mortal' || c.name === 'Everyday mortal',
  );

  if (!template) {
    return [];
  }

  // 2. Find Job Headers.
  const lines = text.split(/\r?\n/);
  const jobRegex = /^[A-Z\s-]+$/; // All caps, spaces, hyphens

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (jobRegex.test(trimmed) && trimmed !== 'EVERYDAY MORTAL') {
      if (['ATTACKS', 'TRAITS', 'NAMES', 'ENCOUNTERS'].includes(trimmed))
        continue;

      const jobName = toTitleCase(trimmed);

      // Clone template
      const creature: Partial<Creature> = {
        ...template,
        name: jobName,
        type: 'Mortal',
      };
      creatures.push(creature);
    }
  }

  return creatures;
}

function parseAnimals(text: string): Partial<Creature>[] {
  // Animals use Compact Stat Blocks.
  // parseBestiary handles the standard "Level X AC Y" format which line 1 of compact blocks usually matches.
  const creatures = parseBestiary(text);

  return creatures.map((c) => {
    // 1. Name Normalization (already existing)
    if (c.name && c.name.includes(',')) {
      c.name = toTitleCase(c.name);
    }

    // 2. Fix Kerning in Name
    if (c.name) {
      // Since parseBestiary might have captured "BAT, VA MPIR E", we need to fix it.
      // But wait, toTitleCase might have messed it up if it lowercased everything?
      // "VA MPIR E" -> "Va Mpir E" via toTitleCase.
      // So we should cleanKerning BEFORE title casing if possible.
      // However, parseBestiary returns the creature with the raw name found in the previous line.
      // If the raw line was "BAT,   VA MPIR E", parseBestiary sets name="BAT,   VA MPIR E".

      // So let's clean it first.
      const cleaned = cleanKerning(c.name);
      // Then Title Case if needed (if it has comma)
      if (cleaned.includes(',')) {
        c.name = toTitleCase(cleaned);
      } else {
        c.name = cleaned;
      }
    }
    return c;
  });
}

// --- Compact Stat Block Logic ---

function cleanKerning(text: string): string {
  // Logic: Detect sequences of single uppercase letters separated by spaces and collapse them.
  // e.g. "V A M P I R E" -> "VAMPIRE"

  let current = text;
  let previous = '';
  let iterations = 0;

  while (current !== previous && iterations < 10) {
    previous = current;
    // Look for single uppercase letter (or title case if already processed?)
    // If the input is raw CAPS "V A M P I R E", this regex works:
    // \b([A-Z])\s+(?=[A-Z]\b)

    // If the input was already title-cased "V A M P I R E" -> "V A M P I R E", it still works.
    // If it was "Va Mpir E" (result of toTitleCase on kerning), it's harder.
    // Ideally we call cleanKerning on the RAW string.

    current = current.replace(/\b([A-Z])\s+(?=[A-Z]\b)/g, '$1');
    iterations++;
  }

  // Specific fix for "VA MPIR E" (chunks)
  current = current.replace(/VA\s+MPIR\s+E/i, 'VAMPIRE');

  return current;
}

function parseCompactSecondaryStats(
  lines: string[],
  currentIndex: number,
  creature: Partial<Creature>,
) {
  // Look at the next few lines for Att, Speed, Morale, XP, Enc
  let k = currentIndex + 1;
  const maxLookAhead = 3;

  while (k < lines.length && k < currentIndex + maxLookAhead) {
    const line = lines[k].trim();
    if (!line) {
      k++;
      continue;
    }

    // Stop if we hit a new creature (Level X) or Section Header
    if (line.startsWith('Level ') || /^[A-Z\s]+$/.test(line)) {
      break;
    }

    // if (creature.name?.includes('Bat') || creature.name?.includes('Cleric')) {
    //   console.log(
    //     `[DEBUG] Parsing stats for ${creature.name}, line: "${line}"`,
    //   );
    // }

    // Attacks (Att or Attacks)
    const attMatch = line.match(
      /^(Att|Attacks?)[:]?\s+(.*?)(?=\s+(?:Speed|Move|Swim|Fly|Burrow|Climb)\b|$)/i,
    );
    if (attMatch && !creature.attacks) {
      creature.attacks = [attMatch[2].trim()];
    }

    // Movement
    if (!creature.movement) {
      const moveMatch = line.match(
        /(?:Speed|Move|Swim|Fly|Burrow|Climb)[:]?\b.*?(?=\s+(?:Morale|XP|Enc)\b|$)/i,
      );
      if (moveMatch) {
        // Check if this line actually contains movement keywords
        const hasMove = /(?:Speed|Move|Swim|Fly|Burrow|Climb)[:]?\s+\d/.test(
          line,
        );
        if (hasMove) {
          // We want to capture "Speed 10 Fly 60"
          let moveStr = moveMatch[0];
          // Strip the leading keyword
          moveStr = moveStr.replace(
            /^(Speed|Move|Swim|Fly|Burrow|Climb)[:]?\s+/i,
            '',
          );
          // Clean up trailing bits if regex missed
          moveStr = moveStr.replace(/\s+(?:Morale|XP|Enc).*$/, '').trim();
          creature.movement = isNaN(Number(moveStr))
            ? moveStr
            : Number(moveStr);
        }
      }
    }

    // Morale
    const moraleMatch = line.match(/Morale[:]?\s+(\d+)/i);
    if (moraleMatch) creature.morale = Number(moraleMatch[1]);

    // XP
    const xpMatch = line.match(/XP[:]?\s+([\d,]+)/i);
    if (xpMatch) creature.xp = Number(xpMatch[1].replace(/,/g, ''));

    // Enc (Number Appearing)
    const encMatch = line.match(/Enc[:]?\s+([\dd+]+)/i);
    if (encMatch) creature.numberAppearing = encMatch[1];

    k++;
  }
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Re-using the logic from the original parseCreatures, encapsulated
function parseBestiary(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];
  const lines = text.split(/\r?\n/);

  // Pattern: Level 6 AC 17 HP 6d8 (27) Saves D9 R10 H11 B12 S13
  const statsLineRegex =
    /Level\s+([\w]+)\s+AC\s+(\d+)\s+HP\s+([\dd]+).*?Saves\s+(.*)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const statsMatch = line.match(statsLineRegex);

    if (statsMatch) {
      const creature: Partial<Creature> = {};

      creature.level = isNaN(Number(statsMatch[1]))
        ? statsMatch[1]
        : Number(statsMatch[1]);
      creature.armourClass = Number(statsMatch[2]);
      creature.hitDice = statsMatch[3];
      creature.save = statsMatch[4].trim();

      // Look Backwards for Name and Alignment
      let j = i - 1;
      let foundAlignment = false;

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
        } else {
          // Stop conditions
          if (
            /^\d+$/.test(prevLine) ||
            /part two/i.test(prevLine) ||
            /Names:/i.test(prevLine) ||
            /Adventurers/i.test(prevLine) ||
            prevLine === 'Everyday Mortals' ||
            prevLine === 'Animals' ||
            // New stop condition: Don't pick up "AC" or "Level" as names if they appear on their own lines (artifacts)
            /^AC\b/.test(prevLine) ||
            /^Level\b/.test(prevLine)
          ) {
            break;
          }

          // Name Heuristic
          if (prevLine.length < 50 && !prevLine.endsWith('.')) {
            // Clean kerning right here to get the "real" name
            creature.name = cleanKerning(prevLine);
            break;
          }
        }
        j--;
      }

      // Try compact stats parsing first (it handles the "Att ... Speed ..." line style)
      // If it doesn't find anything, we can fallback to parseForwardStats
      // Actually, let's use a unified approach or check which one to use.
      // Animals/Appendices use compact style.

      // We can try parseCompactSecondaryStats. If it finds Attacks/Speed, good.
      parseCompactSecondaryStats(lines, i, creature);

      // If we didn't find attacks/movement yet, try the standard forward parser
      if (!creature.attacks || !creature.movement) {
        parseForwardStats(lines, i, creature);
      }

      if (creature.name) {
        if (!creature.numberAppearing) {
          creature.numberAppearing = '1 (Unique)';
        }
        creatures.push(creature);
      }
    }
  }

  return creatures;
}

// Extracted helper for forward stats parsing (Attacks, Speed, XP, etc)
function parseForwardStats(
  lines: string[],
  currentIndex: number,
  creature: Partial<Creature>,
) {
  let k = currentIndex + 1;
  while (k < lines.length && k < currentIndex + 10) {
    const nextLine = lines[k].trim();

    // Stop if we hit a new creature stat block (starts with Level X)
    if (/^Level\s+\d+/i.test(nextLine)) {
      break;
    }

    const attacksMatch = nextLine.match(/^(Attacks?|Att)\b/i);
    if (attacksMatch) {
      let attacksVal = nextLine.replace(attacksMatch[0], '').trim();

      const inlineStats = parseSecondaryStats(nextLine, creature);
      if (inlineStats) {
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

      const lookAheadIndex = k + 1;
      if (lookAheadIndex < lines.length) {
        const possibleContinuation = lines[lookAheadIndex].trim();
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
          k++;
        }
      }
      creature.attacks = [attacksVal];
    }

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
}

function parseSecondaryStats(
  line: string,
  creature: Partial<Creature>,
): boolean {
  let found = false;

  const speedMatch = line.match(
    /(?:Speed|Swim|Fly|Burrow|Climb)\s+([\w\s]+?)\s+Morale/i,
  );
  if (speedMatch) {
    const rawMove = speedMatch[1].trim();
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
  const alignMatch = line.match(/(Chaotic|Neutral|Lawful|Any)/i);
  if (alignMatch) {
    const val = alignMatch[1].toLowerCase();
    return val.charAt(0).toUpperCase() + val.slice(1);
  }
  return undefined;
}
