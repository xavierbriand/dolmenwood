import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MortalSlicer } from '../../src/processors/MortalSlicer.js';
import { MortalSplitter } from '../../src/processors/MortalSplitter.js';
import { MortalStatParser } from '../../src/processors/MortalStatParser.js';
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

describe.skipIf(!hasSourceData)('Everyday Mortals Pipeline Integration', () => {
  // Re-normalize to ensure kerning fixes are applied
  const rawNormalized = fs.readFileSync(NORMALIZED_TEXT_PATH, 'utf-8');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawNormalized);

  // Extract TOC to get expected mortal names
  const chunker = new Chunker();
  const tocText = chunker.extractTOC(normalizedText);
  const appendices = chunker.parseAppendicesList(tocText);
  const tocNames = appendices.everydayMortals.map((e) => e.name);

  const slicer = new MortalSlicer();
  const splitter = new MortalSplitter();
  const parser = new MortalStatParser();

  const mortalsText = slicer.slice(normalizedText);

  it('should slice a non-empty Everyday Mortals section', () => {
    expect(mortalsText.length).toBeGreaterThan(0);
  });

  it('should parse the shared stat block successfully', () => {
    const stats = parser.parseSharedStatBlock(mortalsText);

    expect(stats.level).toBe(1);
    expect(stats.armourClass).toBe(10);
    expect(stats.hitDice).toBe('1d4');
    expect(stats.morale).toBe(6);
    expect(stats.xp).toBe(10);
    expect(stats.movement).toBe(40);
    expect(stats.attacks).toHaveLength(1);
  });

  const blocks = splitter.split(mortalsText, tocNames);

  it('should split into exactly 9 mortal blocks', () => {
    expect(blocks.length).toBe(9);
  });

  it('should parse all 9 mortals without errors', () => {
    const sharedStats = parser.parseSharedStatBlock(mortalsText);
    const errors: Array<{ name: string; error: string }> = [];
    const creatures = [];

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
      console.error('Parse errors:', errors);
    }

    expect(errors).toHaveLength(0);
    expect(creatures).toHaveLength(9);
  });

  it('should produce creatures that all validate against CreatureSchema', () => {
    const sharedStats = parser.parseSharedStatBlock(mortalsText);
    const validationErrors: Array<{
      name: string;
      errors: unknown;
    }> = [];

    for (const block of blocks) {
      const creature = parser.buildCreature(
        block.name,
        block.text,
        sharedStats,
      );
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

  it('should have all creatures with type "Everyday Mortal"', () => {
    const sharedStats = parser.parseSharedStatBlock(mortalsText);
    const creatures = blocks.map((block) =>
      parser.buildCreature(block.name, block.text, sharedStats),
    );

    for (const creature of creatures) {
      expect(creature.type).toBe('Everyday Mortal');
    }
  });

  it('should produce unique creature names', () => {
    const sharedStats = parser.parseSharedStatBlock(mortalsText);
    const creatures = blocks.map((block) =>
      parser.buildCreature(block.name, block.text, sharedStats),
    );
    const names = creatures.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(9);
  });
});
