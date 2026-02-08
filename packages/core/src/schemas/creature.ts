import { z } from 'zod';

export const CreatureSchema = z.object({
  name: z.string(),
  level: z.number().or(z.string()), // Optional as per B/X standard usually implying HD, but some systems differ
  alignment: z.string(), // 'Chaotic', 'Neutral', 'Lawful' etc.
  xp: z.number(),
  numberAppearing: z.string(),
  armourClass: z.number(),
  movement: z.number().or(z.string()),
  hitDice: z.string(),
  attacks: z.array(z.string()),
  morale: z.number(),
  treasure: z.string().optional(),
  save: z.string().optional(), // 'D12 W13 P14 B15 S16 (2)'
  description: z.string().optional(),
});

export type Creature = z.infer<typeof CreatureSchema>;
