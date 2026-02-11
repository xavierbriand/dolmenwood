import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FactionParser } from '../../src/processors/FactionParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NORMALIZED_TEXT_PATH = path.resolve(
  __dirname,
  '../../../../tmp/etl/dmb-normalized.md',
);
const CREATURES_JSON_PATH = path.resolve(
  __dirname,
  '../../../../tmp/etl/creatures.json',
);

const hasSourceData =
  fs.existsSync(NORMALIZED_TEXT_PATH) && fs.existsSync(CREATURES_JSON_PATH);

describe.skipIf(!hasSourceData)('FactionParser Integration', () => {
  const normalizedText = hasSourceData
    ? fs.readFileSync(NORMALIZED_TEXT_PATH, 'utf-8')
    : '';
  const creatures: Array<{ name: string }> = hasSourceData
    ? JSON.parse(fs.readFileSync(CREATURES_JSON_PATH, 'utf-8'))
    : [];
  const parser = new FactionParser();

  it('should extract the Creatures and Factions section', () => {
    const section = parser.extractSection(normalizedText);

    expect(section).toContain('Creatures and Factions');
    expect(section.length).toBeGreaterThan(100);
  });

  it('should parse exactly 7 factions', () => {
    const section = parser.extractSection(normalizedText);
    const factions = parser.parseFactions(section);

    expect(factions.size).toBe(7);
  });

  it('should parse all expected faction names', () => {
    const section = parser.extractSection(normalizedText);
    const factions = parser.parseFactions(section);
    const factionNames = [...factions.keys()];

    expect(factionNames).toContain('Atanuw\u00EB');
    expect(factionNames).toContain('Cold Prince');
    expect(factionNames).toContain('Drune');
    expect(factionNames).toContain('Human nobility');
    expect(factionNames).toContain('Longhorn nobility');
    expect(factionNames).toContain('Pluritine Church');
    expect(factionNames).toContain('Witches');
  });

  it('should map faction creatures to known creature names', () => {
    const creatureFactionMap = parser.parse(normalizedText);
    const creatureNames = new Set(creatures.map((c) => c.name.toLowerCase()));

    // Count how many faction creatures match actual parsed creatures
    let matched = 0;
    let unmatched: string[] = [];

    for (const [creatureName] of creatureFactionMap) {
      if (creatureNames.has(creatureName)) {
        matched++;
      } else {
        unmatched.push(creatureName);
      }
    }

    // Most faction creatures should match parsed creatures.
    // Some (like Knight, Cleric, Friar) may not exist in the bestiary.
    expect(matched).toBeGreaterThan(15);

    // Log unmatched for visibility
    if (unmatched.length > 0) {
      console.log(
        `Unmatched faction creatures (${unmatched.length}):`,
        unmatched,
      );
    }
  });

  it('should correctly map multi-faction creatures', () => {
    const creatureFactionMap = parser.parse(normalizedText);

    // Knight appears in both Human nobility and Longhorn nobility
    const knightFactions = creatureFactionMap.get('knight');
    expect(knightFactions).toBeDefined();
    expect(knightFactions!.length).toBeGreaterThanOrEqual(2);
  });
});
