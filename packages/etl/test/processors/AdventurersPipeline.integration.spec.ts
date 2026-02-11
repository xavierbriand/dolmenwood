import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdventurerSlicer } from '../../src/processors/AdventurerSlicer.js';
import { AdventurerSplitter } from '../../src/processors/AdventurerSplitter.js';
import { AdventurerStatParser } from '../../src/processors/AdventurerStatParser.js';
import { Normalizer } from '../../src/processors/Normalizer.js';
import { Chunker } from '../../src/processors/Chunker.js';
import { CreatureSchema } from '@dolmenwood/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NORMALIZED_TEXT_PATH = path.resolve(
  __dirname,
  '../../../../tmp/etl/dmb-normalized.md',
);

const hasSourceData = fs.existsSync(NORMALIZED_TEXT_PATH);

describe.skipIf(!hasSourceData)('Adventurers Pipeline Integration', () => {
  // Re-normalize to ensure kerning fixes are applied
  const rawNormalized = fs.readFileSync(NORMALIZED_TEXT_PATH, 'utf-8');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawNormalized);

  // Extract TOC to get expected adventurer names
  const chunker = new Chunker();
  const tocText = chunker.extractTOC(normalizedText);
  const appendices = chunker.parseAppendicesList(tocText);
  const tocNames = appendices.adventurers.map((e) => e.name);

  const slicer = new AdventurerSlicer();
  const splitter = new AdventurerSplitter();
  const parser = new AdventurerStatParser();

  const adventurersText = slicer.slice(normalizedText);

  it('should slice a non-empty Adventurers section', () => {
    expect(adventurersText.length).toBeGreaterThan(0);
  });

  it('should find 9 adventurer classes in the TOC', () => {
    expect(tocNames).toHaveLength(9);
  });

  const blocks = splitter.split(adventurersText, tocNames);

  it('should split into exactly 9 class blocks', () => {
    expect(blocks.length).toBe(9);
  });

  it('should parse all 9 classes without errors', () => {
    const errors: Array<{ name: string; error: string }> = [];
    const creatures = [];

    for (const block of blocks) {
      try {
        const creature = parser.parse(block.name, block.text);
        creatures.push(creature);
      } catch (e) {
        errors.push({ name: block.name, error: (e as Error).message });
      }
    }

    if (errors.length > 0) {
      console.error('Parse errors:', errors);
    }

    expect(errors).toHaveLength(0);
    expect(creatures).toHaveLength(9);
  });

  it('should produce creatures that all validate against CreatureSchema', () => {
    const validationErrors: Array<{
      name: string;
      errors: unknown;
    }> = [];

    for (const block of blocks) {
      const creature = parser.parse(block.name, block.text);
      const result = CreatureSchema.safeParse(creature);
      if (!result.success) {
        validationErrors.push({
          name: block.name,
          errors: result.error.issues,
        });
      }
    }

    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
    }

    expect(validationErrors).toHaveLength(0);
  });

  it('should have all creatures with 2 variants (Levels 3 and 5)', () => {
    for (const block of blocks) {
      const creature = parser.parse(block.name, block.text);
      expect(
        creature.variants,
        `${creature.name} should have variants`,
      ).toBeDefined();
      expect(
        creature.variants,
        `${creature.name} should have 2 variants`,
      ).toHaveLength(2);
    }
  });

  it('should have all creatures with type "Adventurer"', () => {
    const creatures = blocks.map((block) =>
      parser.parse(block.name, block.text),
    );

    for (const creature of creatures) {
      expect(creature.type).toBe('Adventurer');
    }
  });

  it('should produce unique creature names', () => {
    const creatures = blocks.map((block) =>
      parser.parse(block.name, block.text),
    );
    const names = creatures.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(9);
  });
});
