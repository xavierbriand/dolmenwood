import { describe, it, expect } from 'vitest';
import { parseCreatures } from '../src/steps/transform.js';

const SAMPLE_TEXT_GHOST = `
1d6 hours. Generic preamble text.
Names: 1. Name1, 2. Name2.

part two | Bestiary
79
Generic Ghost
A terrifying spirit from beyond the veil. It haunts the living.
MeDiuM unDeaD—sentient—chaotic
Level 5 AC 15 HP 4d8 (18) Saves D10 R11 H12 B13 S14
Attacks Touch (+4, 1d6 + drain)
Speed 40 Fly 80 Morale 10 XP 500
Encounters 1d6 (50% in lair)
Behaviour Scary, mean
Speech Whispers
Possessions None
Abilities: Scary stuff.
TRAITS
1. Trait 1
2. Trait 2
ENCOUNTERS
1. Encounter 1
2. Encounter 2
LAIRS
1. Lair 1
2. Lair 2
Names: 1. GhostName1, 2. GhostName2.

part two | Bestiary
80
Mini Fairy
Small flying creature.
Part Three Appendices
`;

const SAMPLE_TEXT_KNIGHT = `
Names: See Generic Kindred, DPB and Faction.

part two | Bestiary
38
Generic Knight
Haughty warriors in the service of a noble. Lithe of frame, exquisitely preened, and Haughty warriors in the service of a noble. Lithe of frame, exquisitely preened, and
heavily armed. Roam the world on quests of derring-do or romance.heavily armed. Roam the world on quests of derring-do or romance.
MeDiuM human—sentient—any alignMent
Level 4 AC 17 HP 4d8 (18) Saves D10 R11 H12 B13 S14
Attacks Longsword (+5, 1d8+2)  
or lance (+3, 1d6, when mounted)
Speed 20 Morale 9 XP 130
Encounters 1d4 (no lairs in the mortal world)
Behaviour Romantic, arrogant, resolute
Speech Poetic bravado. Common, High Tongue
Possessions 2d4gp + 1d6pp Hoard None
Cold iron: As fairies, knights suffer 1 extra point of 
damage when hit with cold iron weapons.
Longsword: Knights wield a Longsword of 
unusual make (see Magic Swords—magic item value 
4,000gp). These swords possess a capricious sentience and 
resist possession by others: a non-knight wielding a sword 
must Save Versus Spell or come under its control for 1d6 
Rounds, attempting to slay all mortals within sight.
Mount: Knights are usually mounted. Roll 1d6 to deter-
mine the type of mount: 1–4: horse (p40), 5: charger 
(DPB), 6: special (dire wolf, giant snail, giant boar, etc.).
TRAITS
1Opalescent skin dusted with powdered crystal.
2Armour of plated ice shards.
3Golden feathered nightingale on shoulder.
4Hair of gold filigree.
5Amber or greem eyes without pupils.
6Armour of scintillating brid feathers.
Frost Knights
Alignment: 3-in-6 chance of being Chaotic.
Warm touch: May attack in melee by touch, instead of 
by weapon, inflicting 1d3 heat damage.
Snow-clad ground: Pass without leaving a trace.
IN THE SERVICE OF
1The Warm Prince. Wild knight—see below.
2Duke August-Fleur.
3The Duke Who Cherishes Dreams.
4The Earl of Red.
5The Lady of Noon.
6Prince Mallowlung. Frost knight—see below.
7Princess Endramethios.
8The King Who Is Nine.
9The King of Turtoise.
10Regent Stone.
ENCOUNTERS
1Gazing at a fallen leaf, composing an ode to the wondrous 
and tragic beauty of mortality.
2In battle with 1d3 goblins (p114), attempt-
ing to restrain the beasts with chains.
3Performing 
MAGIC SWORDS
1Floral. Leaves a trail of ephemeral blossoms when swung.
2Celestial. Reflects the stars and moon, even during the 
day or when the heavens are obscured by clouds.
3Hair’s breadth. Blade has no thickness.
4Perfumed. Produces subtle wafts of rose scent in the 
presence of Lawful beings.
Names: See Kindred, DPB and Faction, DCB. See also: Nobles and Their Dominions, DCB.

part two | Bestiary
39
Wanderer
`;

describe('transform', () => {
  it('should parse a creature from the Bestiary section', () => {
    const creatures = parseCreatures(SAMPLE_TEXT_GHOST);

    // It should find 2 creatures: Generic Ghost and Mini Fairy
    expect(creatures.length).toBeGreaterThanOrEqual(1);

    const ghost = creatures.find((c) => c.name === 'Generic Ghost');
    expect(ghost).toBeDefined();

    if (ghost) {
      expect(ghost.name).toBe('Generic Ghost');
      expect(ghost.level).toBe(5);
      expect(ghost.alignment).toBe('Chaotic');
      expect(ghost.xp).toBe(500);
      expect(ghost.armourClass).toBe(15);
      expect(ghost.hitDice).toBe('4d8');
      expect(ghost.attacks).toEqual(['Touch (+4, 1d6 + drain)']);
      expect(ghost.movement).toBe('40 Fly 80');
      expect(ghost.morale).toBe(10);
    }
  });

  it('should parse another creature from the Bestiary section', () => {
    const creatures = parseCreatures(SAMPLE_TEXT_KNIGHT);

    const knight = creatures.find((c) => c.name === 'Generic Knight');
    expect(knight).toBeDefined();

    if (knight) {
      expect(knight.name).toBe('Generic Knight');
      expect(knight.level).toBe(4);
      expect(knight.alignment).toBe('Any');
      expect(knight.xp).toBe(130);
      expect(knight.armourClass).toBe(17);
      expect(knight.hitDice).toBe('4d8');
      expect(knight.attacks).toEqual([
        'Longsword (+5, 1d8+2) or lance (+3, 1d6, when mounted)',
      ]);
      expect(knight.movement).toBe(20);
      expect(knight.morale).toBe(9);
    }
  });
});
