import { Normalizer } from '../processors/Normalizer.js';
import { Chunker } from '../processors/Chunker.js';
import { PageMerger } from '../processors/PageMerger.js';

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
