import { Normalizer } from '../processors/Normalizer.js';
import { Chunker, CreatureBlock } from '../processors/Chunker.js';

export function parseCreatures(text: string): CreatureBlock[] {
  console.log('  - Running Stage 1: Normalization...');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(text);

  console.log('  - Running Stage 2: Chunking...');
  const chunker = new Chunker();
  const pages = chunker.splitByPage(normalizedText);

  const allBlocks: CreatureBlock[] = [];

  pages.forEach((pageText, index) => {
    // Pages are 1-indexed for humans
    const pageNum = index + 1;
    const blocks = chunker.identifyCreatureBlocks(pageText, pageNum);
    allBlocks.push(...blocks);
  });

  console.log(`  - Found ${allBlocks.length} creature blocks.`);

  // Return blocks for inspection (Stage 3 will map these to real Creature objects)
  return allBlocks;
}
