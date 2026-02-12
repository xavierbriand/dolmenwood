import { describe, it, expect } from 'vitest';
import { AnimalMapper } from '../../src/mappers/AnimalMapper.js';
import type { Creature } from '@dolmenwood/core';

describe('AnimalMapper', () => {
  const mapper = new AnimalMapper();

  const sampleInput = {
    name: 'Giant Beetle',
    meta: 'Medium Bug—Animal Intelligence—Neutral',
    stats: {
      level: '2',
      ac: '15',
      hp: '2d8 (9)',
      saves: 'D11 R12 H13 B14 S15',
      attacks: 'Bite (+1, 1d6)',
      speed: '30',
      morale: '7',
      xp: '25',
      encounters: '1d6',
      hoard: 'Luminous glands (see below)',
    },
    abilities: [{ name: 'Glow', text: 'Glands emit light in 10-foot radius.' }],
  };

  describe('given a standard animal creature', () => {
    let result: Creature;

    it('should map without throwing', () => {
      result = mapper.map(sampleInput);
      expect(result).toBeDefined();
    });

    it('should map name', () => {
      result = mapper.map(sampleInput);
      expect(result.name).toBe('Giant Beetle');
    });

    it('should map level as number', () => {
      result = mapper.map(sampleInput);
      expect(result.level).toBe(2);
    });

    it('should map armourClass', () => {
      result = mapper.map(sampleInput);
      expect(result.armourClass).toBe(15);
    });

    it('should strip HP average from hitDice', () => {
      result = mapper.map(sampleInput);
      expect(result.hitDice).toBe('2d8');
    });

    it('should map attacks as array', () => {
      result = mapper.map(sampleInput);
      expect(result.attacks).toEqual(['Bite (+1, 1d6)']);
    });

    it('should map movement as number', () => {
      result = mapper.map(sampleInput);
      expect(result.movement).toBe(30);
    });

    it('should map morale', () => {
      result = mapper.map(sampleInput);
      expect(result.morale).toBe(7);
    });

    it('should map xp', () => {
      result = mapper.map(sampleInput);
      expect(result.xp).toBe(25);
    });

    it('should map numberAppearing', () => {
      result = mapper.map(sampleInput);
      expect(result.numberAppearing).toBe('1d6');
    });

    it('should map hoard from stats to treasure', () => {
      result = mapper.map(sampleInput);
      expect(result.treasure).toBe('Luminous glands (see below)');
    });

    it('should set type to Animal', () => {
      result = mapper.map(sampleInput);
      expect(result.type).toBe('Animal');
    });

    it('should parse alignment from meta', () => {
      result = mapper.map(sampleInput);
      expect(result.alignment).toBe('Neutral');
    });

    it('should parse kindred from meta', () => {
      result = mapper.map(sampleInput);
      expect(result.kindred).toBe('Bug');
    });

    it('should concatenate abilities into description', () => {
      result = mapper.map(sampleInput);
      expect(result.description).toBe(
        'Glow: Glands emit light in 10-foot radius.',
      );
    });
  });

  describe('given an animal without hoard', () => {
    it('should leave treasure undefined', () => {
      const input = {
        ...sampleInput,
        stats: {
          ...sampleInput.stats,
          hoard: undefined,
        },
      };
      // Remove hoard key entirely
      delete (input.stats as Record<string, unknown>)['hoard'];
      const result = mapper.map(input);
      expect(result.treasure).toBeUndefined();
    });
  });

  describe('given an animal with composite movement', () => {
    it('should compose speed + fly', () => {
      const input = {
        ...sampleInput,
        stats: { ...sampleInput.stats, speed: '10', fly: '60' },
      };
      const result = mapper.map(input);
      expect(result.movement).toBe('10 Fly 60');
    });

    it('should handle fly-only', () => {
      const input = {
        ...sampleInput,
        stats: {
          ...sampleInput.stats,
          speed: undefined,
          fly: '50',
        },
      };
      delete (input.stats as Record<string, unknown>)['speed'];
      const result = mapper.map(input);
      expect(result.movement).toBe('Fly 50');
    });
  });

  describe('given an animal with description', () => {
    it('should prepend description before abilities', () => {
      const input = {
        ...sampleInput,
        description: 'A large burrowing insect.',
      };
      const result = mapper.map(input);
      expect(result.description).toBe(
        'A large burrowing insect.\nGlow: Glands emit light in 10-foot radius.',
      );
    });
  });

  describe('mapAll', () => {
    it('should map an array of raw animals', () => {
      const results = mapper.mapAll([sampleInput]);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Giant Beetle');
      expect(results[0].type).toBe('Animal');
    });
  });
});
