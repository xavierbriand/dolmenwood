/**
 * AdventurerMapper — transforms Python-extracted adventurer creature JSON
 * into Creature objects conforming to the core schema.
 *
 * Adventurers have 3 level variants (Level 1, 3, 5). Level 1 becomes the
 * base Creature; Levels 3 and 5 become entries in the `variants` array.
 *
 * Each variant carries its own `abilities` array extracted from the PDF.
 */
import type { Creature, CreatureVariant } from '@dolmenwood/core';
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

interface RawAbility {
  name: string;
  text: string;
}

interface RawVariant {
  label: string;
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
    encounters?: string;
  };
  abilities?: RawAbility[];
}

/** Shape of a raw adventurer from the Python extractor. */
export interface RawAdventurerCreature {
  name: string;
  variants: RawVariant[];
}

/** Concatenate abilities into a description string. */
function abilitiesToDescription(abilities: RawAbility[]): string {
  return abilities.map((a) => `${a.name}: ${a.text}`).join(' ');
}

export class AdventurerMapper {
  map(raw: RawAdventurerCreature): Creature {
    if (raw.variants.length < 1) {
      throw new Error(`Adventurer "${raw.name}" has no variants`);
    }

    // Level 1 variant becomes the base creature
    const baseVariant = raw.variants[0];
    const { alignment, kindred } = parseMeta(baseVariant.meta);
    const s = baseVariant.stats;

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
      type: 'Adventurer',
      kindred: kindred ?? 'Mortal',
    };

    // L1 description from base variant abilities
    if (baseVariant.abilities && baseVariant.abilities.length > 0) {
      creature.description = abilitiesToDescription(baseVariant.abilities);
    }

    // Map remaining variants (Level 3, Level 5)
    if (raw.variants.length > 1) {
      creature.variants = raw.variants.slice(1).map((v) => {
        const vs = v.stats;
        const variant: CreatureVariant = {
          label: v.label,
          level: parseLevel(vs.level),
          armourClass: parseArmourClass(vs.ac),
          hitDice: parseHitDice(vs.hp),
          attacks: parseAttacks(vs.attacks),
          movement: parseMovement(vs),
          morale: parseMorale(vs.morale),
          xp: parseXp(vs.xp),
          numberAppearing: vs.encounters
            ? parseNumberAppearing(vs.encounters)
            : '1',
          save: vs.saves,
        };

        // Variant description from its own abilities
        if (v.abilities && v.abilities.length > 0) {
          variant.description = abilitiesToDescription(v.abilities);
        }

        return variant;
      });
    }

    return creature;
  }

  mapAll(rawCreatures: RawAdventurerCreature[]): Creature[] {
    return rawCreatures.map((raw) => this.map(raw));
  }
}
