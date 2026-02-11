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

  it('should have 88 merged creature blocks', () => {
    expect(mergedBlocks.length).toBe(88);
  });

  it('should parse at least 87 of 88 creatures (Wyrm overview expected to fail)', () => {
    const errors: Array<{ name: string; error: string }> = [];
    const creatures = [];

    for (const block of mergedBlocks) {
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
      console.warn('Parse errors:', errors);
    }

    expect(creatures.length).toBeGreaterThanOrEqual(87);
    expect(errors.length).toBeLessThanOrEqual(1);
  });

  it('should produce creatures that all validate against CreatureSchema', () => {
    const validationErrors: Array<{
      name: string;
      errors: unknown;
    }> = [];

    for (const block of mergedBlocks) {
      try {
        const creature = parser.parse(block);
        const result = CreatureSchema.safeParse(creature);
        if (!result.success) {
          validationErrors.push({
            name: creature.name,
            errors: result.error.issues,
          });
        }
      } catch {
        // Skip blocks that fail to parse (handled in other test)
      }
    }

    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
    }

    expect(validationErrors).toHaveLength(0);
  });

  it('should produce creatures with valid structural fields', () => {
    const creatures = mergedBlocks
      .map((block) => {
        try {
          return parser.parse(block);
        } catch {
          return null;
        }
      })
      .filter((c) => c !== null);

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
    const creatures = mergedBlocks
      .map((block) => {
        try {
          return parser.parse(block);
        } catch {
          return null;
        }
      })
      .filter((c) => c !== null);

    for (const creature of creatures) {
      expect(creature.type).toBe('Bestiary');
    }
  });

  it('should produce unique creature names', () => {
    const creatures = mergedBlocks
      .map((block) => {
        try {
          return parser.parse(block);
        } catch {
          return null;
        }
      })
      .filter((c) => c !== null);

    const names = creatures.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(creatures.length);
  });
});
