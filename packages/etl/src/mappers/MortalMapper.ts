/**
 * MortalMapper — transforms Python-extracted mortal creature JSON
 * into Creature objects conforming to the core schema.
 *
 * Everyday Mortals share common stats. The Python extractor already stamps
 * each mortal with the full stat block. The old pipeline hardcodes
 * numberAppearing to "1" since mortals don't have an encounters field.
 */
import type { Creature, DTableEntry } from '@dolmenwood/core';
import {
  parseLevel,
  parseArmourClass,
  parseHitDice,
  parseAttacks,
  parseMovement,
  parseMorale,
  parseXp,
  parseMeta,
} from './StatMapper.js';

/** Shape of a raw mortal creature from the Python extractor. */
export interface RawMortalCreature {
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
    morale: string;
    xp: string;
  };
  abilities?: Array<{ name: string; text: string }>;
  sections?: Record<string, Array<{ roll: string; text: string }>>;
}

export class MortalMapper {
  map(raw: RawMortalCreature): Creature {
    const { alignment } = parseMeta(raw.meta);
    const s = raw.stats;

    // Build description: raw description + abilities concatenated
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
      numberAppearing: '1',
      alignment,
      type: 'Everyday Mortal',
      kindred: 'Mortal',
    };

    if (descParts.length > 0) {
      creature.description = descParts.join(' ');
    }

    // Store sections as enrichment data if present
    if (raw.sections && Object.keys(raw.sections).length > 0) {
      creature.sections = raw.sections as Record<string, DTableEntry[]>;
    }

    return creature;
  }

  mapAll(rawCreatures: RawMortalCreature[]): Creature[] {
    return rawCreatures.map((raw) => this.map(raw));
  }
}
