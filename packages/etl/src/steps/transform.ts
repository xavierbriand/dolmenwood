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
  // Capture group 1: Class Name (e.g. Bard)
  // We need to be careful matching "Level 1" but not "Level 13" (though unlikely for adventurers here)
  const level1Regex = /Level\s+1\s+([A-Za-z]+).*?(?:AC|HP)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(level1Regex);

    if (match) {
      // We found a Level 1 line. This line typically contains the stats too.
      // Use the standard stats parser on this line?
      // The standard parser looks for `Level X AC Y ...`
      // Our line looks like `Level 1 Bard ... AC ...`
      // The standard regex `Level\s+([\w]+)\s+AC` expects `Level 5 AC`.
      // Here we have `Level 1 Class AC`.
      // So we need to normalize or parse manually.

      const className = match[1];
      const creature: Partial<Creature> = {
        name: className,
        type: 'Mortal',
        level: 1,
      };

      // Extract stats from the rest of the line
      // "Level 1 Bard (Rhymer) AC 6 HP 1d6 (4) Saves D13 W14 P13 B16 S15"
      // AC capture
      const acMatch = line.match(/AC\s+(\d+)/);
      if (acMatch) creature.armourClass = Number(acMatch[1]);

      // HP capture
      const hpMatch = line.match(/HP\s+([\dd]+)/);
      if (hpMatch) creature.hitDice = hpMatch[1];

      // Saves capture
      const saveMatch = line.match(/Saves\s+(.*)$/);
      if (saveMatch) creature.save = saveMatch[1].trim();

      // Look ahead for Attacks, Speed, etc. similar to standard parser?
      // Adventurers block in text usually has:
      // Level 1 ...
      // Attacks ...
      // Speed ...
      // So we can use the look-ahead logic from parseBestiary.

      parseForwardStats(lines, i, creature);

      creatures.push(creature);
    }
  }
  return creatures;
}

function parseEverydayMortals(text: string): Partial<Creature>[] {
  const creatures: Partial<Creature>[] = [];

  // 1. Extract the shared "Everyday Mortal" stats.
  // We can use the standard parser on the whole text, find "Everyday Mortal".
  const candidates = parseBestiary(text);
  const template = candidates.find(
    (c) => c.name === 'Everyday Mortal' || c.name === 'Everyday mortal',
  );

  if (!template) {
    // Fallback or error? For now, return empty if template not found.
    return [];
  }

  // 2. Find Job Headers.
  // Jobs are ALL CAPS lines.
  // Exclude "EVERYDAY MORTAL" if it appears as a header.
  const lines = text.split(/\r?\n/);
  const jobRegex = /^[A-Z\s-]+$/; // All caps, spaces, hyphens

  // We need to filter out noise like empty lines or "Level X" lines if they somehow match.
  // And ignore the stat block headers itself if they are all caps.

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heuristics for a Job Header:
    // - All Caps
    // - Not a stat line keyword (AC, HP, XP, etc - though those aren't usually lines on their own)
    // - Not "EVERYDAY MORTAL" (the template name)
    // - Length check?

    if (jobRegex.test(trimmed) && trimmed !== 'EVERYDAY MORTAL') {
      // Exclude lines that are part of the stat block text if any match All Caps (unlikely for description text)
      // Also exclude headers like "ATTACKS", "TRAITS" if they exist in this section (unlikely).
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
  const creatures = parseBestiary(text);

  // Post-process names: "TEST, BEAST" -> "Test, Beast"
  return creatures.map((c) => {
    if (c.name && c.name.includes(',')) {
      // Check if it looks like "NAME, SUFFIX" (usually all caps in source, but parseBestiary might capture the line as is)
      // If the source line was "TEST, BEAST", parseBestiary sets name="TEST, BEAST".
      // We want Title Case.
      c.name = toTitleCase(c.name);
    }
    return c;
  });
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
            /Adventurers/i.test(prevLine) || // Stop at section headers if we crossed boundary (unlikely with split)
            prevLine === 'Everyday Mortals' ||
            prevLine === 'Animals'
          ) {
            break;
          }

          // Name Heuristic
          if (prevLine.length < 50 && !prevLine.endsWith('.')) {
            creature.name = prevLine;
            break;
          }
        }
        j--;
      }

      parseForwardStats(lines, i, creature);

      if (creature.name) {
        // Check for specific default logic
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
