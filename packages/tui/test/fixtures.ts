import type {
  Creature,
  Encounter,
  RolledTreasure,
  SessionState,
} from '@dolmenwood/core';

let seq = 0;

export function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  seq += 1;
  const stamp = `2026-09-0${Math.min(seq, 9)}T12:00:00.000Z`;
  return {
    id: `session-${seq}-aaaaaaaa`,
    createdAt: stamp,
    updatedAt: stamp,
    context: { partyLevel: 1, timeOfDay: 'Day', currentRegionId: undefined },
    history: [],
    ...overrides,
  };
}

export function makeCreature(overrides: Partial<Creature> = {}): Creature {
  return {
    name: 'Forest Sprite',
    level: 2,
    alignment: 'Neutral',
    xp: 25,
    numberAppearing: '1d6',
    armourClass: 14,
    movement: { walk: 120 },
    hitDice: '2',
    attacks: ['Claw (1d4)', 'Bite (1d6)'],
    morale: 7,
    description: 'A small fey creature of the deep woods.',
    ...overrides,
  };
}

export function makeTreasure(
  overrides: Partial<RolledTreasure> = {},
): RolledTreasure {
  return {
    coins: { copper: 0, silver: 120, gold: 45, pellucidium: 0 },
    gems: [{ type: 'Amethyst', category: 'semi-precious', value: 100 }],
    artObjects: [{ type: 'chalice', material: 'silver', value: 60 }],
    magicItems: [{ category: 'potion', name: 'Potion of Healing', value: 0 }],
    totalValue: 265,
    ...overrides,
  };
}

export function makeCreatureEncounter(
  details: Partial<Encounter['details']> = {},
): Encounter {
  const creature = details.creature ?? makeCreature();
  return {
    type: 'Creature',
    summary: `3 x ${creature.name}`,
    details: {
      creature,
      count: 3,
      isLair: false,
      distance: '180 feet',
      surprise: 'Players surprised',
      activity: 'Foraging',
      reaction: 'Hostile',
      ...details,
    },
  };
}
