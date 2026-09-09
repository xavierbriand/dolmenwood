import { z } from 'zod';

export const DTableEntrySchema = z.object({
  roll: z.string(),
  text: z.string(),
});

export const AbilitySchema = z.object({
  name: z.string(),
  text: z.string(),
});

/**
 * Movement rates in feet per round, split by mode. Every field is optional:
 * a creature that only swims has just `swim`, an unknown rate is `{}`.
 * `mounted` is the rate while riding (e.g. the Headless Rider's ghostly horse);
 * `notes` carries any qualifier the ETL could not turn into a number.
 */
export const MovementSchema = z.object({
  walk: z.number().optional(),
  fly: z.number().optional(),
  swim: z.number().optional(),
  burrow: z.number().optional(),
  climb: z.number().optional(),
  webs: z.number().optional(),
  mounted: z.number().optional(),
  notes: z.string().optional(),
});

/**
 * `MovementSchema` that also accepts the pre-structured shape — a bare number
 * of feet, or a string — so creature stat blocks persisted by older builds
 * (e.g. session history JSON) still load. Legacy values become `{ walk: n }`,
 * or `{ notes: s }` when the string is not purely numeric.
 */
export const MovementLike = z.preprocess((value) => {
  if (typeof value === 'number') return { walk: value };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const n = Number(trimmed);
    return trimmed !== '' && Number.isFinite(n) ? { walk: n } : { notes: value };
  }
  return value;
}, MovementSchema);

export const CreatureVariantSchema = z.object({
  label: z.string(), // e.g. "Level 3 Bard (Troubadour)"
  level: z.number().or(z.string()),
  xp: z.number(),
  armourClass: z.number(),
  movement: MovementLike,
  hitDice: z.string(),
  attacks: z.array(z.string()),
  morale: z.number(),
  numberAppearing: z.string().or(z.number().transform((n) => n.toString())),
  save: z.string().optional(),
  description: z.string().optional(),
});

export const CreatureSchema = z.object({
  name: z.string(),
  level: z.number().or(z.string()), // Optional as per B/X standard usually implying HD, but some systems differ
  alignment: z.string(), // 'Chaotic', 'Neutral', 'Lawful' etc.
  xp: z.number(),
  numberAppearing: z.string().or(z.number().transform((n) => n.toString())),
  armourClass: z.number(),
  movement: MovementLike,
  hitDice: z.string(),
  attacks: z.array(z.string()),
  morale: z.number(),
  treasure: z.string().optional(),
  save: z.string().optional(), // 'D12 W13 P14 B15 S16 (2)'
  kindred: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  faction: z.array(z.string()).optional(),
  variants: z.array(CreatureVariantSchema).optional(),
  // Enrichment fields (from Phase A1 Python extractor)
  behaviour: z.string().optional(),
  speech: z.string().optional(),
  possessions: z.string().optional(),
  creatureAbilities: z.array(AbilitySchema).optional(),
  sections: z.record(z.string(), z.array(DTableEntrySchema)).optional(),
  names: z.string().optional(),
});

export type DTableEntry = z.infer<typeof DTableEntrySchema>;
export type Ability = z.infer<typeof AbilitySchema>;
export type Movement = z.infer<typeof MovementSchema>;
export type CreatureVariant = z.infer<typeof CreatureVariantSchema>;
export type Creature = z.infer<typeof CreatureSchema>;

const MOVEMENT_LABELS: ReadonlyArray<[keyof Movement, (n: number) => string]> = [
  ['walk', (n) => `${n}`],
  ['fly', (n) => `Fly ${n}`],
  ['swim', (n) => `Swim ${n}`],
  ['burrow', (n) => `Burrow ${n}`],
  ['climb', (n) => `Climb ${n}`],
  ['webs', (n) => `Webs ${n}`],
  ['mounted', (n) => `(${n} mounted)`],
];

/**
 * Render a {@link Movement} as a single line for stat blocks, e.g.
 * `{ walk: 30, fly: 60 }` → `"30 Fly 60"`, `{ swim: 40 }` → `"Swim 40"`,
 * `{ walk: 30, mounted: 80 }` → `"30 (80 mounted)"`. An empty rate → `"—"`.
 */
export function formatMovement(movement: Movement): string {
  const parts = MOVEMENT_LABELS.flatMap(([key, render]) => {
    const value = movement[key];
    return typeof value === 'number' ? [render(value)] : [];
  });
  if (movement.notes) {
    parts.push(movement.notes);
  }
  return parts.length > 0 ? parts.join(' ') : '—';
}
