import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnimalSlicer } from '../../src/processors/AnimalSlicer.js';
import { AnimalSplitter } from '../../src/processors/AnimalSplitter.js';
import { CompactStatParser } from '../../src/processors/CompactStatParser.js';
import { Normalizer } from '../../src/processors/Normalizer.js';
import { CreatureSchema } from '@dolmenwood/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NORMALIZED_TEXT_PATH = path.resolve(
  __dirname,
  '../../../../tmp/etl/dmb-normalized.md',
);

const hasSourceData = fs.existsSync(NORMALIZED_TEXT_PATH);

describe.skipIf(!hasSourceData)('Animals Pipeline Integration', () => {
  // Re-normalize to ensure kerning fixes are applied
  const rawNormalized = fs.readFileSync(NORMALIZED_TEXT_PATH, 'utf-8');
  const normalizer = new Normalizer();
  const normalizedText = normalizer.process(rawNormalized);

  const slicer = new AnimalSlicer();
  const splitter = new AnimalSplitter();
  const parser = new CompactStatParser();

  const animalsText = slicer.slice(normalizedText);
  const blocks = splitter.split(animalsText);

  it('should slice a non-empty Animals section', () => {
    expect(animalsText.length).toBeGreaterThan(0);
  });

  it('should split into exactly 53 creature blocks', () => {
    expect(blocks.length).toBe(53);
  });

  it('should parse all 53 creatures without errors', () => {
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
    expect(creatures).toHaveLength(53);
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

  it('should produce creatures with valid structural fields', () => {
    const creatures = blocks.map((block) =>
      parser.parse(block.name, block.text),
    );

    // First creature
    const first = creatures[0];
    expect(first.name.length).toBeGreaterThan(0);
    expect(first.level).toBeGreaterThan(0);
    expect(first.armourClass).toBeGreaterThan(0);
    expect(first.attacks.length).toBeGreaterThan(0);
    expect(first.xp).toBeGreaterThan(0);
    expect(first.alignment).toBeTruthy();

    // Last creature
    const last = creatures[creatures.length - 1];
    expect(last.name.length).toBeGreaterThan(0);
    expect(last.level).toBeGreaterThan(0);
    expect(last.armourClass).toBeGreaterThan(0);
    expect(last.attacks.length).toBeGreaterThan(0);
    expect(last.xp).toBeGreaterThan(0);
    expect(last.alignment).toBeTruthy();
  });

  it('should have all creatures with type "Animal"', () => {
    const creatures = blocks.map((block) =>
      parser.parse(block.name, block.text),
    );

    for (const creature of creatures) {
      expect(creature.type).toBe('Animal');
    }
  });

  it('should produce unique creature names', () => {
    const creatures = blocks.map((block) =>
      parser.parse(block.name, block.text),
    );
    const names = creatures.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(53);
  });
});
