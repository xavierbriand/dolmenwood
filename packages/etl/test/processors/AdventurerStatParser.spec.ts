import { describe, it, expect } from 'vitest';
import { AdventurerStatParser } from '../../src/processors/AdventurerStatParser.js';
import { CreatureSchema } from '@dolmenwood/core';

describe('AdventurerStatParser', () => {
  const parser = new AdventurerStatParser();

  const singleLevelBlock = [
    'WARRIOR',
    'Level 1 Warrior (Recruit)',
    'size/type By KinDreD-sentient-any alignMent',
    'Level 1 AC 15 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
    'Att Weapon (+1) Speed 20 Morale 7 XP 10 Enc 2d6',
    'Gear: Chainmail + shield. Longsword (1d8).',
  ].join('\n');

  const multiLevelBlock = [
    'WARRIOR',
    'Level 1 Warrior (Recruit)',
    'size/type By KinDreD-sentient-any alignMent',
    'Level 1 AC 15 HP 1d8 (4) Saves D12 R13 H14 B15 S16',
    'Att Weapon (+1) Speed 20 Morale 7 XP 10 Enc 2d6',
    'Gear: Chainmail + shield. Longsword (1d8).',
    'Level 3 Warrior (Veteran)',
    'size/type By KinDreD-sentient-any alignMent',
    'Level 3 AC 17 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
    'Att Weapon (+2) Speed 20 Morale 8 XP 40 Enc 1d4',
    'Gear: Plate mail + shield. Longsword (1d8).',
    'Companions: 2d4 recruits.',
    'Level 5 Warrior (Champion)',
    'size/type By KinDreD-sentient-any alignMent',
    'Level 5 AC 19 HP 5d8 (22) Saves D10 R11 H12 B13 S14',
    'Att Weapon (+3) Speed 20 Morale 9 XP 260 Enc 1',
    'Gear: Plate mail + Arcane Shield. Magic Longsword (1d8+2).',
    'Companions: 1d4 veterans, 2d6 recruits.',
  ].join('\n');

  describe('parse', () => {
    it('should parse a class block with a single level into a creature without variants', () => {
      const creature = parser.parse('WARRIOR', singleLevelBlock);

      expect(creature.name).toBe('Warrior');
      expect(creature.level).toBe(1);
      expect(creature.armourClass).toBe(15);
      expect(creature.hitDice).toBe('1d8');
      expect(creature.save).toBe('D12 R13 H14 B15 S16');
      expect(creature.attacks).toEqual(['Weapon (+1)']);
      expect(creature.movement).toBe(20);
      expect(creature.morale).toBe(7);
      expect(creature.xp).toBe(10);
      expect(creature.numberAppearing).toBe('2d6');
      expect(creature.alignment).toBe('Any');
      expect(creature.type).toBe('Adventurer');
      expect(creature.variants).toBeUndefined();
    });

    it('should parse a class block with 3 levels into a creature with 2 variants', () => {
      const creature = parser.parse('WARRIOR', multiLevelBlock);

      expect(creature.name).toBe('Warrior');
      expect(creature.level).toBe(1);
      expect(creature.armourClass).toBe(15);
      expect(creature.xp).toBe(10);
      expect(creature.numberAppearing).toBe('2d6');

      expect(creature.variants).toBeDefined();
      expect(creature.variants).toHaveLength(2);

      const v3 = creature.variants![0];
      expect(v3.label).toBe('Level 3 Warrior (Veteran)');
      expect(v3.level).toBe(3);
      expect(v3.armourClass).toBe(17);
      expect(v3.hitDice).toBe('3d8');
      expect(v3.xp).toBe(40);
      expect(v3.numberAppearing).toBe('1d4');
      expect(v3.morale).toBe(8);

      const v5 = creature.variants![1];
      expect(v5.label).toBe('Level 5 Warrior (Champion)');
      expect(v5.level).toBe(5);
      expect(v5.armourClass).toBe(19);
      expect(v5.hitDice).toBe('5d8');
      expect(v5.xp).toBe(260);
      expect(v5.numberAppearing).toBe('1');
      expect(v5.morale).toBe(9);
    });

    it('should parse alignment "lawful or neutral" correctly', () => {
      const block = [
        'HEALER',
        'Level 1 Healer (Acolyte)',
        'size/type By KinDreD-sentient-lawful or neutral',
        'Level 1 AC 15 HP 1d6 (3) Saves D11 R12 H13 B16 S14',
        'Att Weapon (+0) Speed 20 Morale 8 XP 10 Enc 1d20',
        'Gear: Chainmail + shield. Longsword (1d8).',
      ].join('\n');

      const creature = parser.parse('HEALER', block);

      expect(creature.alignment).toBe('Lawful Or Neutral');
    });

    it('should extract class-level description before the first level header', () => {
      const block = [
        'HEALER',
        'Usually humans, occasionally other mortals.',
        'Holy order: Members follow ancient traditions.',
        'Level 1 Healer (Acolyte)',
        'size/type By KinDreD-sentient-lawful or neutral',
        'Level 1 AC 15 HP 1d6 (3) Saves D11 R12 H13 B16 S14',
        'Att Weapon (+0) Speed 20 Morale 8 XP 10 Enc 1d20',
        'Gear: Chainmail + shield. Longsword (1d8).',
      ].join('\n');

      const creature = parser.parse('HEALER', block);

      expect(creature.description).toContain('Usually humans');
      expect(creature.description).toContain('Holy order');
    });

    it('should produce creatures that validate against CreatureSchema', () => {
      const creature = parser.parse('WARRIOR', multiLevelBlock);

      const result = CreatureSchema.safeParse(creature);
      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('should throw when no level blocks are found', () => {
      const block = ['WARRIOR', 'Just some description, no stat blocks.'].join(
        '\n',
      );

      expect(() => parser.parse('WARRIOR', block)).toThrow(
        /No level blocks found/,
      );
    });
  });
});
