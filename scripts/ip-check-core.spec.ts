import { describe, it, expect } from 'vitest';
import {
  normalizeForComparison,
  findContentMatch,
  isProtectedPath,
  MIN_CHUNK_LENGTH,
} from './ip-check-core.js';

describe('IP Compliance Core', () => {
  describe('normalizeForComparison', () => {
    it('should collapse whitespace and lowercase', () => {
      expect(normalizeForComparison('  Hello   World  ')).toBe('hello world');
    });

    it('should normalize newlines and tabs to spaces', () => {
      expect(normalizeForComparison('Line 1\nLine 2\tLine 3')).toBe(
        'line 1 line 2 line 3',
      );
    });
  });

  describe('findContentMatch', () => {
    const sourceText = normalizeForComparison(
      'A large hairy creature that roams the deep forests hunting for prey in the moonlight. ' +
        'It has sharp claws and glowing red eyes that can see in complete darkness.',
    );

    it('should detect a verbatim chunk from source material', () => {
      const line = normalizeForComparison(
        'creature that roams the deep forests hunting for prey in the moonlight',
      );
      const result = findContentMatch(line, sourceText);
      expect(result).not.toBeNull();
    });

    it('should not flag short lines below the threshold', () => {
      const line = normalizeForComparison('short text');
      const result = findContentMatch(line, sourceText);
      expect(result).toBeNull();
    });

    it('should not flag content that does not appear in source material', () => {
      const line = normalizeForComparison(
        'this is a completely original sentence that does not appear in any book at all ever',
      );
      const result = findContentMatch(line, sourceText);
      expect(result).toBeNull();
    });

    it('should detect partial line matches via sliding window', () => {
      // The line has extra content before/after, but a 40+ char chunk matches
      const line = normalizeForComparison(
        'DESCRIPTION: sharp claws and glowing red eyes that can see in complete darkness. END',
      );
      const result = findContentMatch(line, sourceText);
      expect(result).not.toBeNull();
    });

    it('should respect the minimum chunk length threshold', () => {
      // "glowing red eyes" is in the source but only 16 chars -- below threshold
      const line = normalizeForComparison(
        'the beast has glowing red eyes and fangs',
      );
      // This is 40 chars but doesn't appear verbatim in source
      expect(line.length).toBeGreaterThanOrEqual(MIN_CHUNK_LENGTH);
      const result = findContentMatch(line, sourceText);
      expect(result).toBeNull();
    });
  });

  describe('isProtectedPath', () => {
    it('should include files in packages/core/', () => {
      expect(isProtectedPath('packages/core/src/domain/Creature.ts')).toBe(
        true,
      );
    });

    it('should include files in packages/data/', () => {
      expect(isProtectedPath('packages/data/src/index.ts')).toBe(true);
    });

    it('should include files in packages/cli/', () => {
      expect(isProtectedPath('packages/cli/src/index.ts')).toBe(true);
    });

    it('should include files in scripts/', () => {
      expect(isProtectedPath('scripts/ip-check.ts')).toBe(true);
    });

    it('should exclude files in packages/etl/', () => {
      expect(isProtectedPath('packages/etl/src/steps/extract.ts')).toBe(false);
    });

    it('should exclude files outside protected directories', () => {
      expect(isProtectedPath('README.md')).toBe(false);
      expect(isProtectedPath('.github/workflows/ci.yml')).toBe(false);
      expect(isProtectedPath('package.json')).toBe(false);
    });
  });
});
