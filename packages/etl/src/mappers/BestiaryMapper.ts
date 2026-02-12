/**
 * BestiaryMapper — transforms Python-extracted bestiary creature JSON
 * into Creature objects conforming to the core schema.
 */
import type { Creature, Ability, DTableEntry } from '@dolmenwood/core';
import {
  parseLevel,
  parseArmourClass,
  parseHitDice,
  parseAttacks,
  parseMovement,
  parseMorale,
  parseXp,
  parseNumberAppearing,
  parseMeta,
} from './StatMapper.js';

/** Shape of a raw bestiary creature from the Python extractor. */
export interface RawBestiaryCreature {
  name: string;
  description?: string;
  meta: string;
  stats: {
    level: string;
    ac: string;
    hp: string;
    saves: string;
    attacks: string;
    speed?: string;
    fly?: string;
    swim?: string;
    burrow?: string;
    webs?: string;
    morale: string;
    xp: string;
    encounters?: string;
  };
  behaviour?: string;
  speech?: string;
  possessions?: string;
  hoard?: string;
  abilities?: Array<{ name: string; text: string }>;
  sections?: Record<string, Array<{ roll: string; text: string }>>;
  names?: string;
}

export class BestiaryMapper {
  map(raw: RawBestiaryCreature): Creature {
    const { alignment, kindred } = parseMeta(raw.meta);
    const s = raw.stats;

    const creature: Creature = {
      name: raw.name,
      level: parseLevel(s.level),
      armourClass: parseArmourClass(s.ac),
      hitDice: parseHitDice(s.hp),
      save: s.saves,
      attacks: parseAttacks(s.attacks),
      movement: parseMovement(s),
      morale: parseMorale(s.morale),
      xp: parseXp(s.xp),
      numberAppearing: s.encounters ? parseNumberAppearing(s.encounters) : '1',
      alignment,
      type: 'Bestiary',
      kindred,
    };

    // Optional fields
    if (raw.description) {
      creature.description = raw.description;
    }
    if (raw.hoard) {
      creature.treasure = raw.hoard;
    }
    if (raw.behaviour) {
      creature.behaviour = raw.behaviour;
    }
    if (raw.speech) {
      creature.speech = raw.speech;
    }
    if (raw.possessions) {
      creature.possessions = raw.possessions;
    }
    if (raw.abilities && raw.abilities.length > 0) {
      creature.creatureAbilities = raw.abilities as Ability[];
    }
    if (raw.sections && Object.keys(raw.sections).length > 0) {
      creature.sections = raw.sections as Record<string, DTableEntry[]>;
    }
    if (raw.names) {
      creature.names = raw.names;
    }

    return creature;
  }

  mapAll(rawCreatures: RawBestiaryCreature[]): Creature[] {
    return rawCreatures.map((raw) => this.map(raw));
  }
}
