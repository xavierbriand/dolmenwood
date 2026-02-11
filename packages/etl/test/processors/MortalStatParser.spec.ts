import { describe, it, expect } from 'vitest';
import { MortalStatParser } from '../../src/processors/MortalStatParser.js';
import { CreatureSchema } from '@dolmenwood/core';

describe('MortalStatParser', () => {
  const parser = new MortalStatParser();

  describe('parseSharedStatBlock', () => {
    it('should parse the shared stat block from section text', () => {
      const sectionText = [
        'Everyday Mortals',
        'Non-adventuring folk one may meet along the road.',
        'TOWN GUARD',
        'A loyal soldier.',
        'Everyday Mortal',
        'sMall/MeDiuM Mortal-sentient-any alignMent',
        'Level 1 AC 10 HP 1d4 (2) Saves D12 R13 H14 B15 S16',
        'Att Weapon (-1) Speed 40 Morale 6 XP 10',
        'Weapons: Club (d4), dagger (d4), or staff (d4).',
      ].join('\n');

      const stats = parser.parseSharedStatBlock(sectionText);

      expect(stats).toBeDefined();
      expect(stats.level).toBe(1);
      expect(stats.armourClass).toBe(10);
      expect(stats.hitDice).toBe('1d4');
      expect(stats.save).toBe('D12 R13 H14 B15 S16');
      expect(stats.attacks).toEqual(['Weapon (-1)']);
      expect(stats.movement).toBe(40);
      expect(stats.morale).toBe(6);
      expect(stats.xp).toBe(10);
      expect(stats.alignment).toBe('Any');
    });

    it('should throw when shared stat block is not found', () => {
      const sectionText = [
        'TOWN GUARD',
        'A loyal soldier. No stat block here.',
      ].join('\n');

      expect(() => parser.parseSharedStatBlock(sectionText)).toThrow();
    });
  });

  describe('buildCreature', () => {
    const sharedStats = {
      level: 1,
      armourClass: 10,
      hitDice: '1d4',
      save: 'D12 R13 H14 B15 S16',
      attacks: ['Weapon (-1)'],
      movement: 40 as number | string,
      morale: 6,
      xp: 10,
      alignment: 'Any',
    };

    it('should build a Creature from a name and description block', () => {
      const creature = parser.buildCreature(
        'TOWN GUARD',
        'Loyal soldiers stationed at the gates.\nDuties: Guard the settlement.',
        sharedStats,
      );

      expect(creature.name).toBe('Town Guard');
      expect(creature.level).toBe(1);
      expect(creature.armourClass).toBe(10);
      expect(creature.hitDice).toBe('1d4');
      expect(creature.attacks).toEqual(['Weapon (-1)']);
      expect(creature.movement).toBe(40);
      expect(creature.morale).toBe(6);
      expect(creature.xp).toBe(10);
      expect(creature.type).toBe('Everyday Mortal');
      expect(creature.description).toContain('Loyal soldiers');
    });

    it('should convert ALL CAPS names to Title Case', () => {
      const creature = parser.buildCreature(
        'FORTUNE-TELLER',
        'A seer of the future.',
        sharedStats,
      );

      expect(creature.name).toBe('Fortune-Teller');
    });

    it('should produce creatures that validate against CreatureSchema', () => {
      const creature = parser.buildCreature(
        'TOWN GUARD',
        'A generic guard.',
        sharedStats,
      );

      const result = CreatureSchema.safeParse(creature);
      expect(result.success).toBe(true);
    });

    it('should set numberAppearing to "1" since mortals have no Enc field', () => {
      const creature = parser.buildCreature(
        'TOWN GUARD',
        'A generic guard.',
        sharedStats,
      );

      expect(creature.numberAppearing).toBe('1');
    });
  });
});
