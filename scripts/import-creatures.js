import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust paths relative to script location
const dumpPath = path.resolve(__dirname, '../assets/dmb-dump.txt');
const yamlPath = path.resolve(__dirname, '../assets/creatures.yaml');

const dumpContent = fs.readFileSync(dumpPath, 'utf-8');

// Simple YAML writer
function toYaml(entries) {
  let output = '';
  for (const entry of entries) {
    output += `- name: ${entry.name}\n`;
    if (entry.level) output += `  level: ${entry.level}\n`;
    if (entry.alignment) output += `  alignment: ${entry.alignment}\n`;
    if (entry.xp) output += `  xp: ${entry.xp}\n`;
    if (entry.numberAppearing)
      output += `  numberAppearing: ${entry.numberAppearing}\n`;
    if (entry.armourClass) output += `  armourClass: ${entry.armourClass}\n`;
    if (entry.movement) output += `  movement: ${entry.movement}\n`;
    if (entry.hitDice) output += `  hitDice: "${entry.hitDice}"\n`; // Quote HD to be safe
    if (entry.attacks && entry.attacks.length > 0) {
      output += `  attacks:\n`;
      for (const atk of entry.attacks) {
        output += `    - ${atk}\n`;
      }
    }
    if (entry.morale) output += `  morale: ${entry.morale}\n`;
    if (entry.treasure) output += `  treasure: ${entry.treasure}\n`;
    if (entry.description) {
      // Use JSON.stringify to safely escape the string for YAML/JSON
      output += `  description: ${JSON.stringify(entry.description)}\n`;
    }
    output += '\n';
  }
  return output;
}

// Parsing the Dump
const creatures = [];
const lines = dumpContent.split('\n').map((l) => l.trim());

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detection of Stats Block Line 1
  // Regex: ^Level \d+ AC \d+ HP .+ Saves
  if (/^Level \d+.*AC \d+.*HP .+Saves/.test(line)) {
    // Found a creature block anchor.
    // Extract stats
    const levelMatch = line.match(/Level (\d+)/);
    const acMatch = line.match(/AC (\d+)/);
    const hpMatch = line.match(/HP (.+?) Saves/);

    // Go back to find Name and Alignment
    let descIndex = i - 1;
    while (descIndex > 0 && lines[descIndex].length === 0) descIndex--;

    const descriptorLine = lines[descIndex];

    // Extract Alignment
    let alignment = 'Neutral'; // Default
    if (descriptorLine.toLowerCase().includes('chaotic')) alignment = 'Chaotic';
    else if (descriptorLine.toLowerCase().includes('lawful'))
      alignment = 'Lawful';
    else if (descriptorLine.toLowerCase().includes('neutral'))
      alignment = 'Neutral';
    else if (descriptorLine.toLowerCase().includes('any alignment'))
      alignment = 'Any';

    // Go back to find Name
    let nameIndex = descIndex - 1;
    let descriptionLines = [];

    while (nameIndex >= 0) {
      const txt = lines[nameIndex];

      // Check if this line is the Name
      if (
        txt.length > 0 &&
        txt.length < 40 &&
        !txt.includes('|') &&
        !/^\d+$/.test(txt)
      ) {
        // Likely the name
        break;
      }

      if (txt.length > 0 && !txt.startsWith('part two') && !/^\d+$/.test(txt)) {
        descriptionLines.unshift(txt);
      }
      nameIndex--;
    }

    const nameLine = lines[nameIndex];
    const name = nameLine;

    // Extract other stats from following lines
    // i is at Stats Line 1

    // Next line: Attacks
    let speedLine = '';
    let treasureLine = '';
    let encountersLine = '';

    // Parse forward from i
    let j = i + 1;

    const attacks = [];
    while (j < lines.length) {
      const l = lines[j];
      if (l.startsWith('Speed')) {
        speedLine = l;
        break;
      }
      if (l.startsWith('Attacks')) {
        attacks.push(l.replace('Attacks ', ''));
      } else {
        attacks.push(l);
      }
      j++;
    }

    // Parse Speed line for Morale and XP too?
    let speed = '120'; // default
    let morale = '7';
    let xp = '0';

    if (speedLine) {
      const speedMatch = speedLine.match(/Speed (\d+)/);
      if (speedMatch) speed = (parseInt(speedMatch[1]) * 3).toString(); // Convert 40 -> 120

      const moraleMatch = speedLine.match(/Morale (\d+)/);
      if (moraleMatch) morale = moraleMatch[1];

      const xpMatch = speedLine.match(/XP ([\d,]+)/);
      if (xpMatch) xp = xpMatch[1].replace(',', '');
    }

    // Look for Encounters
    j++;
    while (j < lines.length) {
      if (lines[j].startsWith('Encounters')) {
        encountersLine = lines[j];
        break;
      }
      j++;
    }

    // Look for Hoard
    let k = j;
    while (k < lines.length && k < j + 10) {
      // Limit search
      if (lines[k].includes('Hoard')) {
        const parts = lines[k].split('Hoard');
        treasureLine = parts[1].trim();
        break;
      }
      k++;
    }

    // Clean up data
    const acVal = parseInt(acMatch[1]);
    const dac = acVal; // Keep Ascending AC as requested

    const hpVal = hpMatch[1].split('(')[0].trim(); // "4d8"

    let numAppearing = '1d6';
    if (encountersLine) {
      // "Encounters 2d4 (75% in lair)"
      numAppearing = encountersLine
        .replace('Encounters ', '')
        .split('(')[0]
        .trim();
    }

    creatures.push({
      name: name,
      level: levelMatch[1],
      alignment: alignment,
      xp: parseInt(xp),
      numberAppearing: numAppearing,
      armourClass: dac,
      movement: speed,
      hitDice: hpVal,
      attacks: attacks,
      morale: parseInt(morale),
      treasure: treasureLine || 'None',
      description: descriptionLines.join(' '),
    });
  }
}

// Write result
// We are REPLACING the file content entirely with what we found in the DMB.
// No merging.

fs.writeFileSync(yamlPath, toYaml(creatures));
console.log(`Imported ${creatures.length} creatures from DMB.`);
