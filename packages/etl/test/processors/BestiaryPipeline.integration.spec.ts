import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BestiaryStatParser } from '../../src/processors/BestiaryStatParser.js';
import { CreatureSchema } from '@dolmenwood/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BESTIARY_MERGED_PATH = path.resolve(
  __dirname,
  '../../../../tmp/etl/bestiary-merged.json',
);

const hasSourceData = fs.existsSync(BESTIARY_MERGED_PATH);

describe.skipIf(!hasSourceData)('Bestiary Pipeline Integration', () => {
  const mergedBlocks: string[] = JSON.parse(
    fs.readFileSync(BESTIARY_MERGED_PATH, 'utf-8'),
  );
  const parser = new BestiaryStatParser();

  it('should have 88 merged blocks total', () => {
    expect(mergedBlocks.length).toBe(88);
  });

  it('should identify exactly 1 overview block without stats', () => {
    const overviews = mergedBlocks.filter(
      (block) => !BestiaryStatParser.isStatBlock(block),
    );
    expect(overviews.length).toBe(1);
  });

  it('should parse all 87 stat blocks without errors', () => {
    const statBlocks = mergedBlocks.filter((block) =>
      BestiaryStatParser.isStatBlock(block),
    );
    const errors: Array<{ name: string; error: string }> = [];
    const creatures = [];

    for (const block of statBlocks) {
      try {
        const creature = parser.parse(block);
        creatures.push(creature);
      } catch (e) {
        const nameHint =
          block
            .split('\n')
            .find((l) => l.trim() && !/^\d+$/.test(l.trim()))
            ?.trim() ?? 'Unknown';
        errors.push({ name: nameHint, error: (e as Error).message });
      }
    }

    if (errors.length > 0) {
      console.error('Parse errors:', errors);
    }

    expect(errors).toHaveLength(0);
    expect(creatures).toHaveLength(87);
  });

  it('should produce creatures that all validate against CreatureSchema', () => {
    const statBlocks = mergedBlocks.filter((block) =>
      BestiaryStatParser.isStatBlock(block),
    );
    const validationErrors: Array<{
      name: string;
      errors: unknown;
    }> = [];

    for (const block of statBlocks) {
      const creature = parser.parse(block);
      const result = CreatureSchema.safeParse(creature);
      if (!result.success) {
        validationErrors.push({
          name: creature.name,
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
    const statBlocks = mergedBlocks.filter((block) =>
      BestiaryStatParser.isStatBlock(block),
    );
    const creatures = statBlocks.map((block) => parser.parse(block));

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

  it('should have all creatures with type "Bestiary"', () => {
    const statBlocks = mergedBlocks.filter((block) =>
      BestiaryStatParser.isStatBlock(block),
    );
    const creatures = statBlocks.map((block) => parser.parse(block));

    for (const creature of creatures) {
      expect(creature.type).toBe('Bestiary');
    }
  });

  it('should produce unique creature names', () => {
    const statBlocks = mergedBlocks.filter((block) =>
      BestiaryStatParser.isStatBlock(block),
    );
    const creatures = statBlocks.map((block) => parser.parse(block));

    const names = creatures.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(87);
  });
});
