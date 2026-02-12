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
 * 3. Assign factions from Python-extracted factions JSON
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

  // 3. Assign factions from Python-extracted factions JSON
  console.log('  - Assigning factions...');
  let enrichedCreatures = allCreatures;

  try {
    const factionMap = await readJson<Record<string, string[]>>(
      PATHS.PY_FACTIONS_JSON,
    );

    // Build a lowercase-keyed lookup for case-insensitive matching
    const lowerFactionMap = new Map<string, string[]>();
    for (const [name, factions] of Object.entries(factionMap)) {
      lowerFactionMap.set(name.toLowerCase(), factions);
    }

    let assigned = 0;
    enrichedCreatures = allCreatures.map((creature) => {
      const factions = lowerFactionMap.get(creature.name.toLowerCase());
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
    console.warn('    - Factions JSON not found, skipping faction assignment.');
    console.warn(
      '      Run the Python extractor first: python3 packages/etl/scripts/extract_dmb.py',
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
