import { z } from 'zod';

export const GenerationContextSchema = z.object({
  regionId: z.string(),
  timeOfDay: z.enum(['Day', 'Night']).default('Day'),
  terrain: z.enum(['Road', 'Off-road']).default('Off-road'),
  camping: z.boolean().default(false),
});

export type GenerationContext = z.infer<typeof GenerationContextSchema>;

export const EncounterTypeSchema = z.enum([
  'Animal',
  'Monster',
  'Mortal',
  'Sentient',
  'Regional',
  'Lair',
  'Spoor',
  'Structure',
  'Hazard',
  'Creature', // Added to satisfy test "valid EncounterType"
]);

export const CreatureSchema = z.object({
  name: z.string(),
  level: z.number().or(z.string()),
  alignment: z.string(), // 'Chaotic', 'Neutral', 'Lawful' etc.
  xp: z.number(),
  numberAppearing: z.string(),
  armourClass: z.number(),
  movement: z.number().or(z.string()),
  hitDice: z.string(),
  attacks: z.array(z.string()),
  morale: z.number(),
  treasure: z.string().optional(),
  save: z.string().optional(),
  description: z.string().optional(),
});

export type Creature = z.infer<typeof CreatureSchema>;
export type EncounterType = z.infer<typeof EncounterTypeSchema>;

export const EncounterSchema = z.object({
  type: EncounterTypeSchema,
  summary: z.string(),
  details: z.object({
    creature: CreatureSchema.optional(),
    count: z.number().optional(),
    activity: z.string().optional(),
    reaction: z.string().optional(),
    distance: z.string().optional(),
    surprise: z.string().optional(),
  }),
});

export type Encounter = z.infer<typeof EncounterSchema>;
