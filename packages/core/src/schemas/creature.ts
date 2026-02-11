import { z } from 'zod';

export const CreatureVariantSchema = z.object({
  label: z.string(), // e.g. "Level 3 Bard (Troubadour)"
  level: z.number().or(z.string()),
  xp: z.number(),
  armourClass: z.number(),
  movement: z.number().or(z.string()),
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
  movement: z.number().or(z.string()),
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
});

export type CreatureVariant = z.infer<typeof CreatureVariantSchema>;
export type Creature = z.infer<typeof CreatureSchema>;
