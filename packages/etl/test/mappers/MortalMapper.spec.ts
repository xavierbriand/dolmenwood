import { describe, it, expect } from 'vitest';
import { MortalMapper } from '../../src/mappers/MortalMapper.js';
import type { Creature } from '@dolmenwood/core';

describe('MortalMapper', () => {
  const mapper = new MortalMapper();

  const sampleInput = {
    name: 'Angler',
    description: 'Fisherfolk bearing nets, rods, and tackle.',
    meta: 'Small/Medium Mortal—Sentient—Any Alignment',
    stats: {
      level: '1',
      ac: '10',
      hp: '1d4 (2)',
      saves: 'D12 R13 H14 B15 S16',
      attacks: 'Weapon (−1)',
      speed: '40',
      morale: '6',
      xp: '10',
    },
    abilities: [
      { name: 'Rations', text: 'May carry 2d6 rations of fresh fish.' },
      { name: 'Weapons', text: 'Club, dagger, or staff.' },
    ],
  };

  describe('given a standard mortal creature', () => {
    let result: Creature;

    it('should map without throwing', () => {
      result = mapper.map(sampleInput);
      expect(result).toBeDefined();
    });

    it('should map name', () => {
      result = mapper.map(sampleInput);
      expect(result.name).toBe('Angler');
    });

    it('should map level', () => {
      result = mapper.map(sampleInput);
      expect(result.level).toBe(1);
    });

    it('should map armourClass', () => {
      result = mapper.map(sampleInput);
      expect(result.armourClass).toBe(10);
    });

    it('should strip HP average from hitDice', () => {
      result = mapper.map(sampleInput);
      expect(result.hitDice).toBe('1d4');
    });

    it('should map attacks as array', () => {
      result = mapper.map(sampleInput);
      expect(result.attacks).toEqual(['Weapon (−1)']);
    });

    it('should map movement', () => {
      result = mapper.map(sampleInput);
      expect(result.movement).toBe(40);
    });

    it('should map morale', () => {
      result = mapper.map(sampleInput);
      expect(result.morale).toBe(6);
    });

    it('should map xp', () => {
      result = mapper.map(sampleInput);
      expect(result.xp).toBe(10);
    });

    it('should hardcode numberAppearing to "1"', () => {
      result = mapper.map(sampleInput);
      expect(result.numberAppearing).toBe('1');
    });

    it('should set type to Everyday Mortal', () => {
      result = mapper.map(sampleInput);
      expect(result.type).toBe('Everyday Mortal');
    });

    it('should set kindred to Mortal', () => {
      result = mapper.map(sampleInput);
      expect(result.kindred).toBe('Mortal');
    });

    it('should parse alignment from meta', () => {
      result = mapper.map(sampleInput);
      expect(result.alignment).toBe('Any');
    });

    it('should concatenate description + abilities into description', () => {
      result = mapper.map(sampleInput);
      expect(result.description).toBe(
        'Fisherfolk bearing nets, rods, and tackle. Rations: May carry 2d6 rations of fresh fish. Weapons: Club, dagger, or staff.',
      );
    });
  });

  describe('given a mortal with sections', () => {
    it('should store sections as enrichment data', () => {
      const input = {
        ...sampleInput,
        name: 'Crier',
        sections: {
          'CRIER NEWS': [
            { roll: '1', text: 'Local festival announced.' },
            { roll: '2', text: 'Tax increase decreed.' },
          ],
        },
      };
      const result = mapper.map(input);
      expect(result.sections).toEqual({
        'CRIER NEWS': [
          { roll: '1', text: 'Local festival announced.' },
          { roll: '2', text: 'Tax increase decreed.' },
        ],
      });
    });
  });

  describe('given a mortal without abilities', () => {
    it('should use only the description', () => {
      const input = {
        ...sampleInput,
        abilities: [],
      };
      const result = mapper.map(input);
      expect(result.description).toBe(
        'Fisherfolk bearing nets, rods, and tackle.',
      );
    });
  });

  describe('mapAll', () => {
    it('should map an array of raw mortals', () => {
      const results = mapper.mapAll([sampleInput]);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Angler');
      expect(results[0].type).toBe('Everyday Mortal');
    });
  });
});
