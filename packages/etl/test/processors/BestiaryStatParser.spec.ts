import { describe, it, expect } from 'vitest';
import { BestiaryStatParser } from '../../src/processors/BestiaryStatParser.js';
import { CreatureSchema } from '@dolmenwood/core';

describe('BestiaryStatParser', () => {
  const parser = new BestiaryStatParser();

  describe('parse', () => {
    it('should parse a simple bestiary creature block', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark canine spirits that prowl the foggy moors at night. Dark canine spirits that prowl the foggy moors at night. ',
        'Loyal only to their summoners.Loyal only to their summoners.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10 + chill)',
        'Speed 40 Morale 9 XP 180',
        'Encounters 2d4 (75% in lair)',
        'Behaviour Ruthless, relentless, loyal',
        'Speech None',
        'Possessions None Hoard C4 + R4 + M1',
        'Dark sight: Can see normally without light.',
        'Chill bite: Victims lose 1 Strength per hit.',
        'TRAITS',
        '1Glowing red eyes.',
        '2Icy breath visible in the dark.',
        'ENCOUNTERS',
        '1Prowling through a misty graveyard.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.name).toBe('Shadow Hound');
      expect(result.level).toBe(4);
      expect(result.armourClass).toBe(14);
      expect(result.hitDice).toBe('4d8');
      expect(result.save).toBe('D10 R11 H12 B13 S14');
      expect(result.attacks).toEqual(['Bite (+3, 1d10 + chill)']);
      expect(result.movement).toBe(40);
      expect(result.morale).toBe(9);
      expect(result.xp).toBe(180);
      expect(result.numberAppearing).toBe('2d4');
      expect(result.alignment).toBe('Chaotic');
      expect(result.kindred).toBe('Undead');
      expect(result.type).toBe('Bestiary');
    });

    it('should deduplicate description text from PDF column merge', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark canine spirits that prowl. Dark canine spirits that prowl. ',
        'They haunt graveyards.They haunt graveyards.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10)',
        'Speed 40 Morale 9 XP 180',
        'Encounters 2d4 (75% in lair)',
        'Behaviour Ruthless',
        'Speech None',
        'Possessions None',
        'TRAITS',
        '1Glowing eyes.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.description).toContain('Dark canine spirits that prowl.');
      // Should NOT contain the duplicate
      expect(result.description).not.toMatch(
        /Dark canine spirits that prowl\..*Dark canine spirits that prowl\./,
      );
    });

    it('should parse multiple attacks with "and"', () => {
      const block = [
        '55',
        'Forest Guardian',
        'A towering tree-spirit that guards ancient groves.',
        'large fairy-sentient-lawful',
        'Level 7 AC 19 HP 7d8 (31) Saves D8 R9 H10 B11 S12',
        'Attacks 2 branch swipes (+6, 1d8) and stomp (+6, 2d6)',
        'Speed 20 Morale 10 XP 1,980',
        'Encounters 1 (10% in lair)',
        'Behaviour Calm, protective, ancient',
        'Speech Deep rumbling. Sylvan, Woldish',
        'Possessions None Hoard C6 + R7 + M4',
        'TRAITS',
        '1Covered in moss and lichen.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.attacks).toEqual([
        '2 branch swipes (+6, 1d8)',
        'stomp (+6, 2d6)',
      ]);
    });

    it('should parse "or" attacks', () => {
      const block = [
        '14',
        'Tunnel Imp',
        'Small fairies with pots on their heads.',
        'sMall fairy-sentient-any alignMent',
        'Level 3 AC 13 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        "Attacks 2 scratches (+2, 1d4) \nor 2 bramble darts (+2, 1d4, range 20'/40'/60')",
        'Speed 40 Morale 9 XP 40',
        'Encounters 2d6 (25% in lair)',
        'Behaviour Sharp-witted, tricksome',
        'Speech Tinny voice. Sylvan, Woldish (1-in-3 chance)',
        'Possessions None',
        'Hoard C4 + R4 + M1 + 4d20 pots',
        'TRAITS',
        '1Cheeky grin.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.attacks).toEqual([
        '2 scratches (+2, 1d4)',
        "2 bramble darts (+2, 1d4, range 20'/40'/60')",
      ]);
    });

    it('should parse XP with comma thousands separator', () => {
      const block = [
        '13',
        'Frost Shade',
        'Drifting incorporeal shades.',
        'MeDiuM unDeaD-sentient-chaotic',
        'Level 7 AC 19 HP 7d8 (31) Saves D8 R9 H10 B11 S12',
        'Attacks Touch (+6, 1d8 + chill) or wail (death)',
        'Speed 50 Morale 10 XP 1,980',
        'Encounters 1 (10% in lair)',
        'Behaviour Cold, bitter, vengeful',
        'Speech Rasping whisper. High Elfish',
        'Possessions None Hoard C6 + R7 + M4',
        'TRAITS',
        '1Glowing blue eyes.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.xp).toBe(1980);
    });

    it('should parse Encounters with "no lair"', () => {
      const block = [
        '20',
        'Wandering Spirit',
        'Aimless spirits with no home.',
        'MeDiuM unDeaD-seMi-intelligent-neutral',
        'Level 2 AC 12 HP 2d8 (9) Saves D12 R13 H14 B15 S16',
        'Attacks Touch (+1, 1d4)',
        'Speed 30 Morale 6 XP 25',
        'Encounters 1d6 (no lair)',
        'Behaviour Confused, sorrowful',
        'Speech Mournful whispers',
        'Possessions None',
        'TRAITS',
        '1Transparent and flickering.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.numberAppearing).toBe('1d6');
    });

    it('should parse Fly movement', () => {
      const block = [
        '30',
        'Storm Hawk',
        'Magical hawks that ride thunderclouds.',
        'sMall Monstrosity-aniMal intelligence-neutral',
        'Level 3 AC 14 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        'Attacks Talons (+2, 1d6)',
        'Speed 10 Fly 60 Morale 8 XP 40',
        'Encounters 1d4 (no lair)',
        'Behaviour Fierce, territorial',
        'Speech Shrill cries',
        'Possessions None',
        'TRAITS',
        '1Crackling feathers.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.movement).toBe('10 Fly 60');
    });

    it('should parse Swim movement', () => {
      const block = [
        '35',
        'River Serpent',
        'Giant serpents that dwell in deep rivers.',
        'large Monstrosity-aniMal intelligence-neutral',
        'Level 5 AC 15 HP 5d8 (22) Saves D9 R10 H11 B12 S13',
        'Attacks Bite (+4, 2d6)',
        'Speed 20 Swim 40 Morale 7 XP 400',
        'Encounters 1d3 (40% in lair)',
        'Behaviour Languid, hungry',
        'Speech Hissing',
        'Possessions None Hoard C5',
        'TRAITS',
        '1Iridescent scales.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.movement).toBe('20 Swim 40');
    });

    it('should extract special abilities into description', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark canine spirits that prowl the foggy moors.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10 + chill)',
        'Speed 40 Morale 9 XP 180',
        'Encounters 2d4 (75% in lair)',
        'Behaviour Ruthless, relentless',
        'Speech None',
        'Possessions None Hoard C4 + R4 + M1',
        'Dark sight: Can see normally without light.',
        'Chill bite: Victims lose 1 Strength per hit.',
        'TRAITS',
        '1Glowing red eyes.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.description).toContain('Dark sight: Can see normally');
      expect(result.description).toContain(
        'Chill bite: Victims lose 1 Strength',
      );
    });

    it('should parse "any alignMent" meta line', () => {
      const block = [
        '14',
        'Tunnel Imp',
        'Small fairies with pots on their heads.',
        'sMall fairy-sentient-any alignMent',
        'Level 3 AC 13 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        'Attacks 2 scratches (+2, 1d4)',
        'Speed 40 Morale 9 XP 40',
        'Encounters 2d6 (25% in lair)',
        'Behaviour Sharp-witted',
        'Speech Sylvan',
        'Possessions None',
        'TRAITS',
        '1Cheeky.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.alignment).toBe('Any Alignment');
    });

    it('should parse Hoard on a separate line from Possessions', () => {
      const block = [
        '14',
        'Tunnel Imp',
        'Small fairies with pots on their heads.',
        'sMall fairy-sentient-any alignMent',
        'Level 3 AC 13 HP 3d8 (13) Saves D11 R12 H13 B14 S15',
        'Attacks 2 scratches (+2, 1d4)',
        'Speed 40 Morale 9 XP 40',
        'Encounters 2d6 (25% in lair)',
        'Behaviour Sharp-witted',
        'Speech Sylvan',
        'Possessions None',
        'Hoard C4 + R4 + M1 + 4d20 pots',
        'TRAITS',
        '1Cheeky.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.treasure).toBe('C4 + R4 + M1 + 4d20 pots');
    });

    it('should parse Possessions and Hoard on the same line', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark spirits that prowl.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10)',
        'Speed 40 Morale 9 XP 180',
        'Encounters 2d4 (75% in lair)',
        'Behaviour Ruthless',
        'Speech None',
        'Possessions None Hoard C4 + R4 + M1',
        'TRAITS',
        '1Red eyes.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.treasure).toBe('C4 + R4 + M1');
    });

    it('should handle multi-line attacks wrapped across lines', () => {
      const block = [
        '15',
        'Stone Lizard',
        'Many-legged serpentine lizards.',
        'large Monstrosity-aniMal intelligence-neutral',
        'Level 6 AC 15 HP 6d8 (27) Saves D9 R10 H11 B12 S13',
        'Attacks Bite (+5, 1d10) and gaze (petrification)',
        'Speed 20 Morale 9 XP 520',
        'Encounters 1d6 (40% in lair)',
        'Behaviour Languid, curious',
        'Speech Gravelly hissing',
        'Possessions None Hoard C9 + R5 + M10',
        'TRAITS',
        '1Shedding skin.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.attacks).toEqual([
        'Bite (+5, 1d10)',
        'gaze (petrification)',
      ]);
    });

    it('should strip the page number from first line', () => {
      const block = [
        '99',
        'Deep Dweller',
        'Cave creatures of immense age.',
        'large Monstrosity-sentient-neutral',
        'Level 10 AC 18 HP 10d8 (45) Saves D6 R7 H8 B9 S10',
        'Attacks 2 claws (+9, 2d6)',
        'Speed 30 Morale 11 XP 3,500',
        'Encounters 1 (50% in lair)',
        'Behaviour Wise, territorial',
        'Speech Deep growl. Undercommon',
        'Possessions None Hoard C10 + R8',
        'TRAITS',
        '1Ancient scars.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.name).toBe('Deep Dweller');
      // Name should not include "99"
      expect(result.name).not.toContain('99');
    });

    it('should handle abilities that span multiple lines with line wrapping', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark spirits.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10)',
        'Speed 40 Morale 9 XP 180',
        'Encounters 2d4 (75% in lair)',
        'Behaviour Ruthless',
        'Speech None',
        'Possessions None',
        'Dark sight: Can see normally without light. Even in ',
        'total magical darkness.',
        'TRAITS',
        '1Red eyes.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.description).toContain(
        'Dark sight: Can see normally without light.',
      );
      expect(result.description).toContain('total magical darkness.');
    });

    it('should produce output that validates against CreatureSchema', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark canine spirits.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10)',
        'Speed 40 Morale 9 XP 180',
        'Encounters 2d4 (75% in lair)',
        'Behaviour Ruthless',
        'Speech None',
        'Possessions None Hoard C4 + R4',
        'TRAITS',
        '1Red eyes.',
      ].join('\n');

      const result = parser.parse(block);
      const validation = CreatureSchema.safeParse(result);

      expect(validation.success).toBe(true);
    });

    it('should handle Encounters as a plain number', () => {
      const block = [
        '13',
        'Lone Shade',
        'A solitary spectral entity.',
        'MeDiuM unDeaD-sentient-chaotic',
        'Level 7 AC 19 HP 7d8 (31) Saves D8 R9 H10 B11 S12',
        'Attacks Touch (+6, 1d8)',
        'Speed 50 Morale 10 XP 1,980',
        'Encounters 1 (10% in lair)',
        'Behaviour Cold, bitter',
        'Speech Whispers. High Elfish',
        'Possessions None Hoard C6 + R7',
        'TRAITS',
        '1Blue glow.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.numberAppearing).toBe('1');
    });

    it('should handle creature with no Hoard (Possessions only)', () => {
      const block = [
        '20',
        'Wandering Spirit',
        'Aimless spirits.',
        'MeDiuM unDeaD-seMi-intelligent-neutral',
        'Level 2 AC 12 HP 2d8 (9) Saves D12 R13 H14 B15 S16',
        'Attacks Touch (+1, 1d4)',
        'Speed 30 Morale 6 XP 25',
        'Encounters 1d6 (no lair)',
        'Behaviour Confused',
        'Speech Whispers',
        'Possessions None',
        'TRAITS',
        '1Flickering form.',
      ].join('\n');

      const result = parser.parse(block);

      // No hoard, possessions is "None" - treasure should be undefined or "None"
      expect(result.treasure).toBeUndefined();
    });

    it('should handle Hoard with spaces around plus signs', () => {
      const block = [
        '15',
        'Stone Lizard',
        'Serpentine lizards.',
        'large Monstrosity-aniMal intelligence-neutral',
        'Level 6 AC 15 HP 6d8 (27) Saves D9 R10 H11 B12 S13',
        'Attacks Bite (+5, 1d10)',
        'Speed 20 Morale 9 XP 520',
        'Encounters 1d6 (40% in lair)',
        'Behaviour Languid',
        'Speech Hissing',
        'Possessions None Hoard C9 + R 5 + M10',
        'TRAITS',
        '1Shedding skin.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.treasure).toBe('C9 + R 5 + M10');
    });

    it('should handle the Mortal kindred type', () => {
      const block = [
        '50',
        'Hedge Witch',
        'A reclusive practitioner of folk magic.',
        'MeDiuM Mortal-sentient-any alignMent',
        'Level 5 AC 12 HP 5d8 (22) Saves D9 R10 H11 B12 S13',
        'Attacks Staff (+4, 1d6)',
        'Speed 30 Morale 7 XP 400',
        'Encounters 1 (80% in lair)',
        'Behaviour Secretive, knowledgeable',
        'Speech Common, Sylvan',
        'Possessions Staff, herbs Hoard C5 + R3 + M2',
        'TRAITS',
        '1Smells of herbs.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.kindred).toBe('Mortal');
      expect(result.alignment).toBe('Any Alignment');
    });

    it('should parse Saves with spaces between letter and digits', () => {
      const block = [
        '70',
        'Giant Brute',
        'Towering humanoids dwelling in mountain caves.',
        'large Monstrosity-seMi-intelligent-chaotic',
        'Level 13 AC 16 HP 13d8 (58) Saves D4 R 5 H6 B7 S8',
        'Attacks Club (+12, 3d6)',
        'Speed 30 Morale 11 XP 5,000',
        'Encounters 1d2 (30% in lair)',
        'Behaviour Aggressive, territorial',
        'Speech Grunts',
        'Possessions Club, furs Hoard C10 + R8',
        'TRAITS',
        '1Missing an eye.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.level).toBe(13);
      expect(result.armourClass).toBe(16);
      expect(result.hitDice).toBe('13d8');
      expect(result.save).toBe('D4 R 5 H6 B7 S8');
    });

    it('should parse multi-size meta line with abbreviated sizes', () => {
      const block = [
        '90',
        'Vine Creature',
        'Ambulatory plant-beings that vary wildly in size.',
        'sM./MeD./lg. plant-aniMal intelligence-neutral',
        'Level 5 AC 14 HP 5d8 (22) Saves D9 R10 H11 B12 S13',
        'Attacks Vine lash (+4, 1d8)',
        'Speed 20 Morale 8 XP 400',
        'Encounters 1d4 (50% in lair)',
        'Behaviour Passive, territorial',
        'Speech None',
        'Possessions None',
        'TRAITS',
        '1Covered in thorns.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.kindred).toBe('Plant');
      expect(result.alignment).toBe('Neutral');
    });

    it('should parse non-dice HP like "By species"', () => {
      const block = [
        '60',
        'Shape Changer',
        'Creatures that can assume various forms.',
        'MeDiuM fairy-sentient-neutral',
        'Level 1 AC 13 HP By species Saves D12 R13 H14 B15 S16',
        'Attacks Claw (+0, 1d4)',
        'Speed 30 Morale 6 XP 25',
        'Encounters 1 (no lair)',
        'Behaviour Cautious, curious',
        'Speech Common, Sylvan',
        'Possessions Various',
        'TRAITS',
        '1Always fidgeting.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.level).toBe(1);
      expect(result.armourClass).toBe(13);
      expect(result.hitDice).toBe('By species');
      expect(result.save).toBe('D12 R13 H14 B15 S16');
    });

    it('should handle multi-page creature entries (page number in middle)', () => {
      const block = [
        '80',
        'Elder Sprite',
        'Tiny fairies of immense magical power. Tiny fairies of immense magical power. ',
        'Found in ancient groves.Found in ancient groves.',
        'sMall fairy-sentient-lawful',
        'Level 5 AC 16 HP 5d8 (22) Saves D9 R10 H11 B12 S13',
        'Attacks Spell bolt (+4, 2d4)',
        'Speed 20 Fly 40 Morale 8 XP 400',
        'Encounters 2d4 (50% in lair)',
        'Behaviour Mischievous, wise',
        'Speech Musical voice. Sylvan, Woldish',
        'Possessions None Hoard C5 + R4 + M3',
        'Invisibility: Can turn invisible at will.',
        'Spell casting: Can cast 3 spells per day.',
        '81',
        'TRAITS',
        '1Glowing wings.',
        '2Tiny crown of flowers.',
        'ENCOUNTERS',
        '1Dancing in a moonlit glade.',
      ].join('\n');

      const result = parser.parse(block);

      expect(result.name).toBe('Elder Sprite');
      expect(result.description).toContain('Invisibility: Can turn invisible');
      expect(result.description).toContain('Spell casting: Can cast 3 spells');
    });
  });

  describe('isStatBlock', () => {
    it('should return true for a block with a Level line', () => {
      const block = [
        '42',
        'Shadow Hound',
        'Dark canine spirits.',
        'MeDiuM unDeaD-seMi-intelligent-chaotic',
        'Level 4 AC 14 HP 4d8 (18) Saves D10 R11 H12 B13 S14',
        'Attacks Bite (+3, 1d10)',
        'Speed 40 Morale 9 XP 180',
      ].join('\n');

      expect(BestiaryStatParser.isStatBlock(block)).toBe(true);
    });

    it('should return false for a descriptive overview with no Level line', () => {
      const block = [
        '96',
        'Wyrm-Overview',
        'Long limbless wingless monsters related to dragons.',
        'The dragons of the deep wood are varied and dangerous.',
        'Some burrow beneath the earth while others lurk in rivers.',
      ].join('\n');

      expect(BestiaryStatParser.isStatBlock(block)).toBe(false);
    });

    it('should return false for an empty block', () => {
      expect(BestiaryStatParser.isStatBlock('')).toBe(false);
    });
  });
});
