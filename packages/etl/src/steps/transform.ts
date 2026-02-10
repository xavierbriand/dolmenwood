import { Normalizer } from '../processors/Normalizer.js';
import { Chunker } from '../processors/Chunker.js';

export function normalizeText(rawText: string): {
  normalizedText: string;
  pages: string[];
  toc: Array<{ name: string; page: number }>;
} {
  console.log('  - Running Stage 1: Normalization...');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawText);

  console.log('  - Running Stage 2: Chunking...');
  const chunker = new Chunker();

  // 1. Extract TOC
  console.log('    - Extracting Table of Contents...');
  const tocText = chunker.extractTOC(normalizedText);
  const toc = chunker.parseBestiaryList(tocText);
  console.log(`    - Found ${toc.length} creatures in TOC.`);

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
