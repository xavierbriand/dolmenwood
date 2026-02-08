import { z } from 'zod';
import { EncounterSchema } from './encounter.js';

export const SessionContextSchema = z.object({
  partyLevel: z.number().min(1).default(1),
  timeOfDay: z.enum(['Day', 'Night']).default('Day'),
  currentRegionId: z.string().optional(),
});

export type SessionContext = z.infer<typeof SessionContextSchema>;

export const SessionHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  encounter: EncounterSchema,
  regionId: z.string(),
});

export type SessionHistoryEntry = z.infer<typeof SessionHistoryEntrySchema>;

export const SessionStateSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  context: SessionContextSchema,
  history: z.array(SessionHistoryEntrySchema).default([]),
});

export type SessionState = z.infer<typeof SessionStateSchema>;
