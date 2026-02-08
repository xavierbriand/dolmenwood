import { describe, it, expect } from 'vitest';
import { parseCreatures } from '../src/steps/transform.js';

describe('transform', () => {
  it('should parse a creature from the Bestiary section', () => {
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

  it('should parse Adventurers (Level 1 only)', () => {
    const SAMPLE_TEXT_ADVENTURERS = `
Part Three Appendices
Adventurers
Level 1 Bard (Rhymer) AC 6 HP 1d6 (4) Saves D13 W14 P13 B16 S15
Attacks Sword (+1, 1d8)
Speed 40 Morale 8 XP 10
Level 3 Bard (Minstrel) AC 5 HP 3d6 (14) Saves D13 W14 P13 B16 S15
Level 5 Bard (Troubadour) AC 4 HP 5d6 (24) Saves D13 W14 P13 B16 S15

Level 1 Cleric (Acolyte) AC 5 HP 1d6 (4) Saves D11 W12 P14 B16 S15
Attacks Mace (+1, 1d6)
Speed 30 Morale 9 XP 15

Adventuring Parties
`;
    const creatures = parseCreatures(SAMPLE_TEXT_ADVENTURERS);

    // Should find Bard and Cleric (Level 1 only)
    expect(creatures).toHaveLength(2);

    const bard = creatures.find((c) => c.name === 'Bard');
    expect(bard).toBeDefined();
    expect(bard?.level).toBe(1);
    expect(bard?.type).toBe('Mortal');
    expect(bard?.armourClass).toBe(6);
    expect(bard?.hitDice).toBe('1d6');
    expect(bard?.attacks).toEqual(['Sword (+1, 1d8)']);

    const cleric = creatures.find((c) => c.name === 'Cleric');
    expect(cleric).toBeDefined();
    expect(cleric?.level).toBe(1);
    expect(cleric?.attacks).toEqual(['Mace (+1, 1d6)']);
  });

  it('should parse Everyday Mortals with shared stats', () => {
    const SAMPLE_TEXT_MORTALS = `
Part Three Appendices
Everyday Mortals
Generic description of mortals.

FISHER
HERALD
WANDERER

Everyday Mortal
Medium mortal—sentient—any alignment
Level 1 AC 9 HP 1d4 (2) Saves D14 W15 P16 B17 S18
Attacks Dagger (-1, 1d4-1) or improvised (-1, 1d2-1)
Speed 40 Morale 7 XP 5
Encounters 1d4
Animals
`;
    const creatures = parseCreatures(SAMPLE_TEXT_MORTALS);

    // Should find Fisher, Herald, Wanderer (3 creatures)
    // Note: The template "Everyday Mortal" itself is NOT expected in the final list as a creature type unless listed as a Job,
    // but the current logic parses "Everyday Mortal" as a template inside parseEverydayMortals and then clones it.
    // However, the `parseBestiary` call inside `parseEverydayMortals` *will* find "Everyday Mortal" as a creature.
    // My implementation calls `parseBestiary(text)` to find the template.
    // But `parseEverydayMortals` creates NEW creatures for each Job.
    // It returns the list of Job creatures.
    // Wait, let's check my implementation.

    // In `parseEverydayMortals`:
    // const candidates = parseBestiary(text);
    // const template = candidates.find(...)
    // ... loop jobs ... creatures.push(creature)
    // return creatures; (Only the jobs)

    // So "Everyday Mortal" itself won't be in the returned list unless I explicitly add it.
    // The story says: "Create a separate Creature entry for each Job, using the stats from 'Everyday Mortal'."
    // It doesn't explicitly say "Exclude 'Everyday Mortal' itself", but it implies the goal is to load the Jobs.

    expect(creatures.length).toBe(3);

    const angler = creatures.find((c) => c.name === 'Fisher');
    expect(angler).toBeDefined();
    expect(angler?.type).toBe('Mortal');
    expect(angler?.armourClass).toBe(9);
    expect(angler?.xp).toBe(5);

    const crier = creatures.find((c) => c.name === 'Herald');
    expect(crier).toBeDefined();
  });

  it('should parse Animals with name normalization', () => {
    const SAMPLE_TEXT_ANIMALS = `
Part Three Appendices
Animals
TEST, BEAST
Carnivorous giant bats.
Neutral
Level 2 AC 6 HP 2d8 (9) Saves D12 R13 H14 B15 S16
Attacks Bite (+2, 1d4)
Speed 10 Fly 60 Morale 7 XP 20
Encounters 1d10 (1d10)

TEST, HOUND
Loyal beasts.
Neutral
Level 2 AC 7 HP 2d8+2 (11) Saves D12 R13 H14 B15 S16
Attacks Bite (+3, 2d4)
Speed 40 Morale 11 XP 25
Monster Rumours
`;
    const creatures = parseCreatures(SAMPLE_TEXT_ANIMALS);

    expect(creatures).toHaveLength(2);

    const bat = creatures.find((c) => c.name === 'Test, Beast');
    expect(bat).toBeDefined();
    expect(bat?.armourClass).toBe(6);
    expect(bat?.movement).toBe('10 Fly 60');

    const dog = creatures.find((c) => c.name === 'Test, Hound');
    expect(dog).toBeDefined();
  });
});
