/**
 * Transform V2 — consumes Python-extracted JSON files and produces
 * Creature[] using the new mapper-based pipeline.
 *
 * This replaces the old regex-based transform chain (Normalizer, Chunker,
 * PageMerger, Slicers, Splitters, StatParsers) with a simpler mapping
 * layer that converts pre-structured JSON into domain objects.
 */
import fs from 'node:fs/promises';
import type { Creature } from '@dolmenwood/core';
import { PATHS } from '../config.js';
import { BestiaryMapper } from '../mappers/BestiaryMapper.js';
import { AnimalMapper } from '../mappers/AnimalMapper.js';
import { MortalMapper } from '../mappers/MortalMapper.js';
import { AdventurerMapper } from '../mappers/AdventurerMapper.js';
import { FactionParser } from '../processors/FactionParser.js';

import type { RawBestiaryCreature } from '../mappers/BestiaryMapper.js';
import type { RawAnimalCreature } from '../mappers/AnimalMapper.js';
import type { RawMortalCreature } from '../mappers/MortalMapper.js';
import type { RawAdventurerCreature } from '../mappers/AdventurerMapper.js';

/**
 * Read and parse a JSON file, returning the parsed data.
 */
async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Run the V2 transform pipeline:
 * 1. Read Python-extracted JSON files
 * 2. Map each to Creature[] via type-specific mappers
 * 3. Assign factions using the normalized text
 * 4. Write combined output to creatures.json
 */
export async function transformV2(): Promise<Creature[]> {
  const bestiaryMapper = new BestiaryMapper();
  const animalMapper = new AnimalMapper();
  const mortalMapper = new MortalMapper();
  const adventurerMapper = new AdventurerMapper();

  // 1. Read Python extractor outputs
  console.log('  - Reading Python extractor outputs...');

  const rawBestiary = await readJson<RawBestiaryCreature[]>(
    PATHS.PY_BESTIARY_JSON,
  );
  console.log(`    - Bestiary: ${rawBestiary.length} creatures`);

  const rawAnimals = await readJson<RawAnimalCreature[]>(PATHS.PY_ANIMALS_JSON);
  console.log(`    - Animals: ${rawAnimals.length} creatures`);

  const rawMortals = await readJson<RawMortalCreature[]>(PATHS.PY_MORTALS_JSON);
  console.log(`    - Mortals: ${rawMortals.length} creatures`);

  const rawAdventurers = await readJson<RawAdventurerCreature[]>(
    PATHS.PY_ADVENTURERS_JSON,
  );
  console.log(`    - Adventurers: ${rawAdventurers.length} creatures`);

  // 2. Map to Creature[]
  console.log('  - Mapping creatures...');

  const bestiaryCreatures = bestiaryMapper.mapAll(rawBestiary);
  console.log(`    - Bestiary: ${bestiaryCreatures.length} mapped`);

  const animalCreatures = animalMapper.mapAll(rawAnimals);
  console.log(`    - Animals: ${animalCreatures.length} mapped`);

  const mortalCreatures = mortalMapper.mapAll(rawMortals);
  console.log(`    - Mortals: ${mortalCreatures.length} mapped`);

  const adventurerCreatures = adventurerMapper.mapAll(rawAdventurers);
  console.log(`    - Adventurers: ${adventurerCreatures.length} mapped`);

  const allCreatures = [
    ...bestiaryCreatures,
    ...animalCreatures,
    ...mortalCreatures,
    ...adventurerCreatures,
  ];

  // 3. Assign factions (reuses existing FactionParser with normalized text)
  console.log('  - Assigning factions...');
  let enrichedCreatures = allCreatures;

  try {
    const normalizedText = await fs.readFile(PATHS.NORMALIZED_TEXT, 'utf-8');
    const parser = new FactionParser();
    const creatureFactionMap = parser.parse(normalizedText);

    let assigned = 0;
    enrichedCreatures = allCreatures.map((creature) => {
      const factions = creatureFactionMap.get(creature.name.toLowerCase());
      if (factions && factions.length > 0) {
        assigned++;
        return { ...creature, faction: factions };
      }
      return creature;
    });
    console.log(
      `    - Assigned factions to ${assigned} of ${allCreatures.length} creatures.`,
    );
  } catch {
    console.warn(
      '    - Normalized text not found, skipping faction assignment.',
    );
    console.warn(
      '      Run the legacy "extract" + "transform" first, or provide dmb-normalized.md.',
    );
  }

  // 4. Write output
  await fs.writeFile(
    PATHS.INTERMEDIATE_JSON,
    JSON.stringify(enrichedCreatures, null, 2),
    'utf-8',
  );
  console.log(
    `  - Saved ${enrichedCreatures.length} creatures to: ${PATHS.INTERMEDIATE_JSON}`,
  );

  return enrichedCreatures;
}
