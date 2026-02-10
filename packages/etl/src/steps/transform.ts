import { Normalizer } from '../processors/Normalizer.js';

export function normalizeText(rawText: string): string {

  console.log('  - Running Stage 1: Normalization...');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawText);

  return normalizedText;
}
