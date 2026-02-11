import { Normalizer } from '../processors/Normalizer.js';
import { Chunker } from '../processors/Chunker.js';
import { PageMerger } from '../processors/PageMerger.js';
import { AnimalSlicer } from '../processors/AnimalSlicer.js';
import { AnimalSplitter } from '../processors/AnimalSplitter.js';
import { CompactStatParser } from '../processors/CompactStatParser.js';
import { BestiaryStatParser } from '../processors/BestiaryStatParser.js';
import { MortalSlicer } from '../processors/MortalSlicer.js';
import { MortalSplitter } from '../processors/MortalSplitter.js';
import { MortalStatParser } from '../processors/MortalStatParser.js';
import type { Creature } from '@dolmenwood/core';

export function normalizeText(rawText: string): {
  normalizedText: string;
  pages: string[];
  toc: {
    bestiary: Array<{ name: string; page: number }>;
    appendices: {
      adventurers: Array<{ name: string; page: number }>;
      everydayMortals: Array<{ name: string; page: number }>;
      animals: Array<{ name: string; page: number }>;
    };
  };
} {
  console.log('  - Running Stage 1: Normalization...');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawText);

  console.log('  - Running Stage 2: Chunking...');
  const chunker = new Chunker();

  // 1. Extract TOC
  console.log('    - Extracting Table of Contents...');
  const tocText = chunker.extractTOC(normalizedText);

  // 1a. Parse Bestiary
  const bestiaryList = chunker.parseBestiaryList(tocText);
  console.log(`    - Found ${bestiaryList.length} creatures in Bestiary.`);

  // 1b. Parse Appendices
  const appendicesLists = chunker.parseAppendicesList(tocText);
  console.log(
    `    - Found ${appendicesLists.adventurers.length} adventurers, ${appendicesLists.everydayMortals.length} everyday mortals, ${appendicesLists.animals.length} animals.`,
  );

  const toc = {
    bestiary: bestiaryList,
    appendices: appendicesLists,
  };

  // 2. Extract Bestiary Section
  console.log('    - Extracting Bestiary section...');
  const bestiaryText = chunker.extractBestiarySection(normalizedText);

  // 3. Split by Page
  console.log('    - Splitting pages...');
  const rawPages = chunker.splitBestiaryPages(bestiaryText);
  console.log(`    - Found ${rawPages.length} raw chunks.`);

  // 4. Filter Valid Pages
  const pages = chunker.filterValidPages(rawPages);
  console.log(
    `    - Retained ${pages.length} valid pages (filtered intro/noise).`,
  );

  return { normalizedText, pages, toc };
}

export function mergeBestiaryPages(
  pages: string[],
  toc: { bestiary: Array<{ name: string; page: number }> },
): string[] {
  console.log('  - Running Stage 3: Merging Bestiary Pages...');
  const merger = new PageMerger();
  const startPages = new Set(toc.bestiary.map((entry) => entry.page));

  const merged = merger.merge(pages, startPages);
  console.log(`    - Merged into ${merged.length} creature entries.`);

  return merged;
}

export function transformBestiary(mergedBlocks: string[]): Creature[] {
  console.log('  - Running Bestiary Pipeline...');
  const parser = new BestiaryStatParser();

  if (mergedBlocks.length === 0) {
    console.warn('    - No bestiary blocks to parse. Skipping.');
    return [];
  }

  // Filter out overview/descriptive blocks that have no stat block
  const statBlocks = mergedBlocks.filter((block) =>
    BestiaryStatParser.isStatBlock(block),
  );
  const skipped = mergedBlocks.length - statBlocks.length;
  if (skipped > 0) {
    console.log(
      `    - Skipped ${skipped} overview block(s) with no stat data.`,
    );
  }

  const creatures: Creature[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const block of statBlocks) {
    try {
      const creature = parser.parse(block);
      creatures.push(creature);
    } catch (e) {
      // Extract a name hint from the block for error reporting
      const nameHint =
        block
          .split('\n')
          .find((l) => l.trim() && !/^\d+$/.test(l.trim()))
          ?.trim() ?? 'Unknown';
      errors.push({ name: nameHint, error: (e as Error).message });
    }
  }

  if (errors.length > 0) {
    console.warn(`    - Failed to parse ${errors.length} bestiary creatures:`);
    errors.forEach((e) => console.warn(`      - ${e.name}: ${e.error}`));
  }

  console.log(
    `    - Parsed ${creatures.length} bestiary creatures successfully.`,
  );
  return creatures;
}

export function transformAnimals(normalizedText: string): Creature[] {
  console.log('  - Running Animals Pipeline...');
  const slicer = new AnimalSlicer();
  const splitter = new AnimalSplitter();
  const parser = new CompactStatParser();

  // Step 1: Slice
  console.log('    - Slicing Animals section...');
  const animalsText = slicer.slice(normalizedText);
  if (!animalsText) {
    console.warn(
      '    - Animals section not found in normalized text. Skipping.',
    );
    return [];
  }

  // Step 2: Split
  console.log('    - Splitting into creature blocks...');
  const blocks = splitter.split(animalsText);
  console.log(`    - Split into ${blocks.length} animal blocks.`);

  if (blocks.length === 0) {
    console.warn('    - No animal blocks found after splitting. Skipping.');
    return [];
  }

  // Step 3: Parse each block
  const creatures: Creature[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const block of blocks) {
    try {
      const creature = parser.parse(block.name, block.text);
      creatures.push(creature);
    } catch (e) {
      errors.push({ name: block.name, error: (e as Error).message });
    }
  }

  if (errors.length > 0) {
    console.warn(`    - Failed to parse ${errors.length} animals:`);
    errors.forEach((e) => console.warn(`      - ${e.name}: ${e.error}`));
  }

  console.log(`    - Parsed ${creatures.length} animals successfully.`);
  return creatures;
}

export function transformMortals(
  normalizedText: string,
  tocNames: string[],
): Creature[] {
  console.log('  - Running Everyday Mortals Pipeline...');
  const slicer = new MortalSlicer();
  const splitter = new MortalSplitter();
  const parser = new MortalStatParser();

  // Step 1: Slice
  console.log('    - Slicing Everyday Mortals section...');
  const mortalsText = slicer.slice(normalizedText);
  if (!mortalsText) {
    console.warn(
      '    - Everyday Mortals section not found in normalized text. Skipping.',
    );
    return [];
  }

  // Step 2: Parse shared stat block
  console.log('    - Parsing shared stat block...');
  const sharedStats = parser.parseSharedStatBlock(mortalsText);

  // Step 3: Split into blocks
  console.log('    - Splitting into creature blocks...');
  const blocks = splitter.split(mortalsText, tocNames);
  console.log(`    - Split into ${blocks.length} mortal blocks.`);

  if (blocks.length === 0) {
    console.warn('    - No mortal blocks found after splitting. Skipping.');
    return [];
  }

  // Step 4: Build creatures
  const creatures: Creature[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const block of blocks) {
    try {
      const creature = parser.buildCreature(
        block.name,
        block.text,
        sharedStats,
      );
      creatures.push(creature);
    } catch (e) {
      errors.push({ name: block.name, error: (e as Error).message });
    }
  }

  if (errors.length > 0) {
    console.warn(`    - Failed to parse ${errors.length} mortals:`);
    errors.forEach((e) => console.warn(`      - ${e.name}: ${e.error}`));
  }

  console.log(`    - Parsed ${creatures.length} mortals successfully.`);
  return creatures;
}
