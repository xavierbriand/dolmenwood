import { z } from 'zod';

export const TableEntrySchema = z.object({
  min: z.number().int().min(1),
  max: z.number().int().min(1),
  type: z.string(), // Could be stricter
  ref: z.string(),
  count: z.string().optional(),
  description: z.string().optional(),
});

export const RegionTableSchema = z.object({
  name: z.string(),
  die: z.string().regex(/^1d\d+$/), // e.g. "1d6", "1d20"
  entries: z.array(TableEntrySchema)
}).refine((data) => {
  const dieSize = parseInt(data.die.split('d')[1]);
  // Check if ranges cover 1 to dieSize
  const covered = new Set<number>();
  for (const entry of data.entries) {
    if (entry.min > entry.max) return false;
    for (let i = entry.min; i <= entry.max; i++) {
      covered.add(i);
    }
  }
  
  // Check if size matches
  if (covered.size !== dieSize) return false;
  
  // Check if 1..dieSize are all present
  for (let i = 1; i <= dieSize; i++) {
    if (!covered.has(i)) return false;
  }
  
  return true;
}, { message: "Entries do not strictly cover the die range" });

export const SettlementTableSchema = RegionTableSchema;
export const EncounterTableSchema = RegionTableSchema;

export type TableEntry = z.infer<typeof TableEntrySchema>;
export type RegionTable = z.infer<typeof RegionTableSchema>;
