/**
 * AnimalMapper — transforms Python-extracted animal creature JSON
 * into Creature objects conforming to the core schema.
 *
 * Animals use compact stat blocks. The hoard field lives inside `stats`.
 * Abilities are concatenated into the description field for compatibility
 * with the existing output format.
 */
import type { Creature } from '@dolmenwood/core';
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

/** Shape of a raw animal creature from the Python extractor. */
export interface RawAnimalCreature {
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
    hoard?: string;
  };
  abilities?: Array<{ name: string; text: string }>;
}

export class AnimalMapper {
  map(raw: RawAnimalCreature): Creature {
    const { alignment, kindred } = parseMeta(raw.meta);
    const s = raw.stats;

    // Build description from raw description + abilities text
    const descParts: string[] = [];
    if (raw.description) {
      descParts.push(raw.description);
    }
    if (raw.abilities && raw.abilities.length > 0) {
      const abilitiesText = raw.abilities
        .map((a) => `${a.name}: ${a.text}`)
        .join(' ');
      descParts.push(abilitiesText);
    }

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
      type: 'Animal',
      kindred,
    };

    if (descParts.length > 0) {
      creature.description = descParts.join('\n');
    }
    if (s.hoard) {
      creature.treasure = s.hoard;
    }

    return creature;
  }

  mapAll(rawCreatures: RawAnimalCreature[]): Creature[] {
    return rawCreatures.map((raw) => this.map(raw));
  }
}
