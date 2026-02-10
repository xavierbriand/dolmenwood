import { Normalizer } from '../processors/Normalizer.js';
import { Chunker } from '../processors/Chunker.js';

export function normalizeText(rawText: string): {
  normalizedText: string;
  pages: string[];
} {
  console.log('  - Running Stage 1: Normalization...');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawText);

  console.log('  - Running Stage 2: Chunking...');
  const chunker = new Chunker();

  // 1. Extract Bestiary Section
  console.log('    - Extracting Bestiary section...');
  const bestiaryText = chunker.extractBestiarySection(normalizedText);

  // 2. Split by Page
  console.log('    - Splitting pages...');
  const pages = chunker.splitBestiaryPages(bestiaryText);
  console.log(`    - Found ${pages.length} pages.`);

  return { normalizedText, pages };
}
