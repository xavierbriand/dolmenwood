import { z } from 'zod';
import { CreatureSchema } from './creature.js';

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

export type { Creature, CreatureVariant } from './creature.js';
export { CreatureSchema, CreatureVariantSchema } from './creature.js';

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
