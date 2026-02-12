import { z } from 'zod';

// --- Sub-schemas for extracted table data ---

/** A nullable chance/quantity pair used for coin denominations and riches categories */
export const ChanceQuantitySchema = z.object({
  chance: z.number(),
  quantity: z.string(),
});

export type ChanceQuantity = z.infer<typeof ChanceQuantitySchema>;

/** Coins tier row (C1–C12): each denomination is either a chance/quantity pair or null */
export const CoinsTierSchema = z.object({
  type: z.string(),
  averageValue: z.number(),
  copper: ChanceQuantitySchema.nullable(),
  silver: ChanceQuantitySchema.nullable(),
  gold: ChanceQuantitySchema.nullable(),
  pellucidium: ChanceQuantitySchema.nullable(),
});

export type CoinsTier = z.infer<typeof CoinsTierSchema>;

/** Riches tier row (R1–R12): gems and artObjects are nullable chance/quantity pairs */
export const RichesTierSchema = z.object({
  type: z.string(),
  averageValue: z.number(),
  gems: ChanceQuantitySchema.nullable(),
  artObjects: ChanceQuantitySchema.nullable(),
});

export type RichesTier = z.infer<typeof RichesTierSchema>;

/** Magic items tier row (M1–M12) */
export const MagicTierSchema = z.object({
  type: z.string(),
  averageValue: z.number(),
  chance: z.number(),
  items: z.string(),
});

export type MagicTier = z.infer<typeof MagicTierSchema>;

/**
 * Range-based lookup table entry (d100 tables).
 * Used for magicItemType, treasureHoard, gemValue, jewellery, miscArtObjects.
 * Fields beyond min/max vary by table so they use passthrough.
 */
export const RangeEntrySchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .passthrough();

export type RangeEntry = z.infer<typeof RangeEntrySchema>;

/** Single-value roll lookup (d20 tables): preciousMaterials, embellishments, provenance */
export const RollEntrySchema = z.object({
  roll: z.number(),
  value: z.string(),
});

export type RollEntry = z.infer<typeof RollEntrySchema>;

/** Coin appearance table entry: tail is optional (absent on some rolls) */
export const CoinAppearanceSchema = z.object({
  roll: z.number(),
  head: z.string(),
  tail: z.string().optional(),
});

export type CoinAppearance = z.infer<typeof CoinAppearanceSchema>;

/** Gem value table entry with explicit category and gp value */
export const GemValueEntrySchema = z.object({
  min: z.number(),
  max: z.number(),
  category: z.string(),
  value: z.number(),
});

export type GemValueEntry = z.infer<typeof GemValueEntrySchema>;

/** Named magic item summary (amulets, balms, crystals, garments, rings, potions, wondrous) */
export const NamedItemSchema = z.object({
  name: z.string(),
  value: z.number(),
  summary: z.string(),
});

export type NamedItem = z.infer<typeof NamedItemSchema>;

/**
 * Generation sub-table row.
 * Rows use either { min, max } for ranges or { roll } for single values.
 * At least one of these must be present. cells is always a non-empty string array.
 */
export const GenerationSubTableRowSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    roll: z.number().optional(),
    cells: z.array(z.string()).min(1),
  })
  .refine(
    (row) =>
      row.roll !== undefined ||
      (row.min !== undefined && row.max !== undefined),
    {
      message: 'Row must have either roll or both min and max',
    },
  );

export type GenerationSubTableRow = z.infer<typeof GenerationSubTableRowSchema>;

/** A generation sub-table group: a record of sub-table name → array of rows */
const GenerationSubTableGroupSchema = z.record(
  z.string(),
  z.array(GenerationSubTableRowSchema),
);

// --- Complete treasure tables schema ---

/** The full structure of all extracted DCB treasure tables */
export const TreasureTablesSchema = z.object({
  // Core treasure tiers
  coins: z.array(CoinsTierSchema),
  riches: z.array(RichesTierSchema),
  magicItems: z.array(MagicTierSchema),

  // d100 lookup tables
  magicItemType: z.array(RangeEntrySchema),
  treasureHoard: z.array(RangeEntrySchema),
  jewellery: z.array(RangeEntrySchema),
  miscArtObjects: z.array(RangeEntrySchema),

  // Coin appearance
  coinAppearance: z.array(CoinAppearanceSchema),

  // Gem tables
  gemValue: z.array(GemValueEntrySchema),
  gemType: z.record(z.string(), z.array(z.string())),

  // d20 roll tables
  preciousMaterials: z.array(RollEntrySchema),
  embellishments: z.array(RollEntrySchema),
  provenance: z.array(RollEntrySchema),

  // Named magic item summary tables
  amulets: z.array(NamedItemSchema),
  magicBalms: z.array(NamedItemSchema),
  magicCrystals: z.array(NamedItemSchema),
  magicGarments: z.array(NamedItemSchema),
  magicRings: z.array(NamedItemSchema),
  potions: z.array(NamedItemSchema),
  wondrousItems: z.array(NamedItemSchema),

  // Generation sub-table groups
  magicArmour: GenerationSubTableGroupSchema,
  magicInstruments: GenerationSubTableGroupSchema,
  magicWeapons: GenerationSubTableGroupSchema,
  rodsStavesWands: GenerationSubTableGroupSchema,
  scrollsBooks: GenerationSubTableGroupSchema,
});

export type TreasureTables = z.infer<typeof TreasureTablesSchema>;

// --- Parsed treasure code representation ---

/** A single treasure tier code, e.g. { tier: 'C', level: 4 } from "C4" */
export const TreasureCodeSchema = z.object({
  tier: z.enum(['C', 'R', 'M']),
  level: z.number().int().min(1).max(12),
});

export type TreasureCode = z.infer<typeof TreasureCodeSchema>;

/** Parsed treasure spec from hoard code strings like "C4 + R4 + M1" */
export const TreasureSpecSchema = z.object({
  codes: z.array(TreasureCodeSchema),
  extras: z.array(z.string()),
});

export type TreasureSpec = z.infer<typeof TreasureSpecSchema>;

// --- Rolled treasure output ---

/** A rolled gem result */
export const RolledGemSchema = z.object({
  type: z.string(),
  category: z.string(),
  value: z.number(),
});

export type RolledGem = z.infer<typeof RolledGemSchema>;

/** A rolled art object result */
export const RolledArtObjectSchema = z.object({
  type: z.string(),
  material: z.string().optional(),
  embellishment: z.string().optional(),
  value: z.number(),
});

export type RolledArtObject = z.infer<typeof RolledArtObjectSchema>;

/** A rolled magic item result */
export const RolledMagicItemSchema = z.object({
  category: z.string(),
  name: z.string(),
  value: z.number(),
});

export type RolledMagicItem = z.infer<typeof RolledMagicItemSchema>;

/** The complete result of rolling a treasure hoard */
export const RolledTreasureSchema = z.object({
  coins: z.object({
    copper: z.number(),
    silver: z.number(),
    gold: z.number(),
    pellucidium: z.number(),
  }),
  gems: z.array(RolledGemSchema),
  artObjects: z.array(RolledArtObjectSchema),
  magicItems: z.array(RolledMagicItemSchema),
  totalValue: z.number(),
});

export type RolledTreasure = z.infer<typeof RolledTreasureSchema>;
