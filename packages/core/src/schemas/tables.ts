import { z } from 'zod';

export const TableEntrySchema = z.object({
  min: z.number().int().min(1),
  max: z.number().int().min(1),
  type: z.string(), // Could be stricter
  ref: z.union([z.string(), z.array(z.string())]),
  count: z.coerce.string().optional(),
  qualifier: z.string().optional(),
  description: z.string().optional(),
});

export const RegionTableSchema = z
  .object({
    name: z.string(),
    die: z.string().regex(/^\d+d\d+$/), // e.g. "1d6", "1d20", "2d6"
    entries: z.array(TableEntrySchema),
  })
  .refine(
    (data) => {
      const [numDice, dieSize] = data.die.split('d').map(Number);
      const minSum = numDice;
      const maxSum = numDice * dieSize;

      // Check if ranges cover minSum to maxSum
      const covered = new Set<number>();
      for (const entry of data.entries) {
        if (entry.min > entry.max) return false;
        for (let i = entry.min; i <= entry.max; i++) {
          covered.add(i);
        }
      }

      // Check if size matches
      if (covered.size !== maxSum - minSum + 1) return false;

      // Check if minSum..maxSum are all present
      for (let i = minSum; i <= maxSum; i++) {
        if (!covered.has(i)) return false;
      }

      return true;
    },
    { message: 'Entries do not strictly cover the die range' },
  );

export const SettlementTableSchema = RegionTableSchema;
export const EncounterTableSchema = RegionTableSchema;

export type TableEntry = z.infer<typeof TableEntrySchema>;
export type RegionTable = z.infer<typeof RegionTableSchema>;
export type Table = RegionTable;
