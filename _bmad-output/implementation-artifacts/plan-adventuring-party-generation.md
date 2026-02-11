# Adventuring Party Generation

## Context

When the encounter system rolls "Adventuring Party" on the Common - Mortal table, it currently tries to look up a creature that doesn't exist. In the source material, "Adventuring Party" is not a creature — it's a 13-step generation procedure that produces a party of 5-8 adventurers, each with a kindred, class, level, equipment, and spells.

This is an encounter-within-an-encounter: the outer system resolves "Adventuring Party" and then an inner system builds the party.

### What Already Exists

- **9 adventurer stat blocks** extracted by ETL (Bard, Cleric, Enchanter, Fighter, Friar, Hunter, Knight, Magician, Thief), each with L1 base + L3/L5 variants.
- **`EncounterGenerator`** in Core with recursive table resolution and creature lookup.
- **`Creature` schema** with `variants: CreatureVariant[]` for multi-level stat blocks.
- **`common-encounters.yaml`** referencing `Adventuring Party` as `type: Creature`.

### What's Missing

The generation tables (Kindred, Class-by-Kindred, Alignment, Quest) are not in the system. The `EncounterGenerator` has no concept of composite encounters. There's no party generation logic anywhere.

---

## Architecture Decision

The party generation procedure is **domain logic** — it uses dice rolls, weighted tables, and game rules to produce structured output. It belongs in **Core**, not ETL.

The generation tables (Kindred, Class-by-Kindred, etc.) are **static reference data** — they should be extracted by **ETL** into YAML and loaded through a repository port, consistent with how encounter tables work today.

The `EncounterGenerator` needs a dispatch mechanism to recognize "Adventuring Party" as a composite encounter and delegate to a `PartyGenerator` service.

---

## Phase 2: ETL — Extract Party Generation Tables

Extract the four tables from the "Adventuring Parties" section (~line 6544 of normalized text) into a new YAML file.

### Step 2.1: PartyTableSlicer

- [ ] **Test**: `packages/etl/test/processors/PartyTableSlicer.spec.ts`
  - Slices from "Adventuring Parties" header to end of section (or next appendix boundary).
  - Returns empty string with warning if section not found.
- [ ] **Implement**: `packages/etl/src/processors/PartyTableSlicer.ts`
  - Start boundary: `^Adventuring Parties$` (the header after the individual adventurer stat blocks).
  - End boundary: Next major section header or EOF.

### Step 2.2: PartyTableParser

- [ ] **Test**: `packages/etl/test/processors/PartyTableParser.spec.ts`
  - Parses the Adventurer Kindred table (d12 → kindred, 6 entries).
  - Parses the Adventurer Class by Kindred table (d20 × 6 kindreds → class).
  - Parses the Alignment table (d6 → alignment).
  - Parses the 3 Quest tables (d6 × 3 alignments → quest description).
- [ ] **Implement**: `packages/etl/src/processors/PartyTableParser.ts`
  - Returns a structured object with all four table groups.
  - Each table has a `die` field and entries with `min`/`max`/`result`.

### Step 2.3: Wire into Pipeline

- [ ] Add `transformPartyTables()` to `packages/etl/src/steps/transform.ts`.
- [ ] Add YAML output path to `packages/etl/src/config.ts`.
- [ ] Wire into `transform` and `all` commands in `packages/etl/src/index.ts`.
- [ ] Output: `assets/party-tables.yaml` (or similar).

### Step 2.4: Integration Test

- [ ] `packages/etl/test/processors/PartyTableParser.integration.spec.ts`
  - Runs against real normalized text (skipIf no source data).
  - Validates all tables are parsed with correct entry counts.
  - Kindred table: 6 kindreds, die d12.
  - Class-by-Kindred table: 6 kindred rows, die d20, all 9 classes represented.
  - Alignment table: 3 entries, die d6.
  - Quest tables: 3 tables (Lawful/Neutral/Chaotic), 6 entries each, die d6.

### Output Schema (target YAML structure)

```yaml
kindred:
  die: 1d12
  entries:
    - min: 1
      max: 3
      result: Breggle
    - min: 4
      max: 4
      result: Elf
    # ...

classByKindred:
  die: 1d20
  kindreds:
    Breggle:
      - min: 1
        max: 3
        result: Bard
      # ...
    Elf:
      - min: 1
        max: 2
        result: Bard
      # ...

alignment:
  die: 1d6
  entries:
    - min: 1
      max: 2
      result: Lawful
    - min: 3
      max: 4
      result: Neutral
    - min: 5
      max: 6
      result: Chaotic

quests:
  die: 1d6
  Lawful:
    - min: 1
      max: 1
      result: '...'
    # ...
  Neutral:
    # ...
  Chaotic:
    # ...
```

---

## Phase 3: Core — Domain Model & Ports

Define the schemas, types, and port interfaces that the party generator needs.

### Step 3.1: Party Generation Schemas

- [ ] **Test**: Add to `packages/core/src/schemas/schemas.spec.ts`
  - Validates `PartyMemberSchema` (kindred, class, level, creature ref).
  - Validates `AdventuringPartySchema` (members, alignment, treasure, quest).
- [ ] **Implement**: `packages/core/src/schemas/party.ts`
  - `PartyMemberSchema`: `{ kindred, className, level, creatureName }` — references a creature by name + level for stat block resolution.
  - `AdventuringPartySchema`: `{ members: PartyMember[], alignment, treasure, quest?, mounted }`.
  - `PartyTablesSchema`: Validates the YAML structure from Phase 2.

### Step 3.2: Port Interface

- [ ] `packages/core/src/ports/PartyTableRepository.ts`
  - `getPartyTables(): Promise<Result<PartyTables>>` — loads the kindred, class-by-kindred, alignment, and quest tables.
  - This is a Driven Port (secondary adapter in `packages/data`).

### Step 3.3: Data Adapter

- [ ] `packages/data/src/repositories/YamlPartyTableRepository.ts`
  - Implements `PartyTableRepository`.
  - Loads from `assets/party-tables.yaml`, validates with `PartyTablesSchema`.

---

## Phase 4: Core — Party Generator Service

Implement the 13-step procedure as a pure domain service.

### Step 4.1: PartyGenerator — Party Size & Level Tier

- [ ] **Test**: `packages/core/src/services/PartyGenerator.spec.ts`
  - Given a seeded RNG, party size is `1d4+4` (range 5-8).
  - 1-in-6 chance of high-level party (level `1d6+3`, range 4-9).
  - Otherwise low-level party (level `1d3`, range 1-3).
- [ ] **Implement**: `packages/core/src/services/PartyGenerator.ts`
  - `generateParty(tables, random): AdventuringParty`
  - Step 1: Roll party size.
  - Step 2: Roll level tier.

### Step 4.2: PartyGenerator — Member Generation

- [ ] **Test**: Continue in `PartyGenerator.spec.ts`
  - For each member: rolls kindred on the kindred table, then class on the class-by-kindred table for that kindred.
  - Character level rolled from the tier dice (`1d3` or `1d6+3`).
  - Resolves to a creature name + variant level.
- [ ] **Implement**:
  - Step 3: Roll kindred per member.
  - Step 4: Roll class per member (filtered by kindred).
  - Step 5: Roll individual level per member.

### Step 4.3: Level-to-Variant Resolution

- [ ] **Test**: Level resolution logic.
  - L1-2 → use base creature (L1 stat block).
  - L3-4 → use L3 variant.
  - L5+ → use L5 variant.
- [ ] **Implement**: A `resolveVariantLevel(level: number): 1 | 3 | 5` helper.
  - This maps actual character level to the nearest stat block tier.
  - The `PartyMember` records both the actual level and the resolved creature/variant reference.

### Step 4.4: PartyGenerator — Secondary Details

- [ ] **Test**: Treasure, mounts, alignment, quest.
  - Treasure: `1d100cp`, `1d100sp`, `1d100gp`, 10% for `1d4` gems, 10% for `1d4` art objects.
  - Mounts: 75% chance on roads/settled areas (context-dependent).
  - Alignment: Roll on alignment table (per party or per member — configurable).
  - Quest: Roll on quest table matching alignment.
- [ ] **Implement**: Steps 7-13 of the procedure.

### Step 4.5: Full Integration Test

- [ ] **Test**: `packages/core/src/services/PartyGenerator.integration.spec.ts`
  - With mocked tables and seeded RNG, generates a complete party.
  - Validates party size is in range 5-8.
  - Each member has valid kindred, class, level.
  - Treasure totals are within expected ranges.

---

## Phase 5: Core — Wire into EncounterGenerator

Connect the party generator to the existing encounter flow.

### Step 5.1: New EncounterResult Variant

- [ ] **Extend** `EncounterResult` discriminated union in `EncounterGenerator.ts`:
  ```typescript
  | { kind: 'party'; party: AdventuringParty; count: number; name: string }
  ```
- [ ] **Extend** `EncounterSchema.details` to optionally include `party: AdventuringPartySchema`.

### Step 5.2: Dispatch in resolveCreature

- [ ] **Test**: When `entry.ref` is `"Adventuring Party"`, the generator delegates to `PartyGenerator` instead of doing a creature lookup.
- [ ] **Implement**: In `resolveCreature()`, detect the special ref and call `partyGenerator.generateParty()`.
  - The `count` from the table entry (`1d6`) means the number of **parties**, not members.
  - Each party is generated independently.

### Step 5.3: Constructor Update

- [ ] **Update** `EncounterGenerator` constructor to accept `PartyGenerator` (or `PartyTableRepository`) as a dependency.
- [ ] **Update** CLI wiring in `packages/cli` to inject the new dependency.

---

## Phasing & Dependencies

```
Phase 2 (ETL tables)  →  Phase 3 (schemas & ports)  →  Phase 4 (generator)  →  Phase 5 (wiring)
```

Phases 2 and 3.1 (schemas) can be developed in parallel since the YAML schema is defined upfront. Phase 4 depends on Phase 3. Phase 5 depends on Phase 4.

## Testing Strategy

- **Unit tests** with synthetic table data and seeded RNG (no copyrighted content).
- **Integration tests** with real source data guarded by `skipIf(!hasSourceData)`.
- **Schema validation tests** ensuring ETL output conforms to Core schemas.
- **BDD-style naming**: `describe('given a low-level party', () => { it('should roll 1d3 for each member level', ...) })`.

## Open Questions

1. **Per-member vs per-party alignment**: The source says "roll once per character or once for the whole party." Should we default to per-party (simpler) and make per-member optional?
2. **Quest table IP concerns**: Quest entries reference specific hex locations and NPC names from the setting. These may need to be excluded or genericized for the public repo. Deferring quest extraction is an option.
3. **Spell selection**: Step 5 of the procedure says "choose or roll memorised spells." This is a deep rabbit hole (requires the full spell list). Recommend deferring to a later phase.
4. **Equipment randomization**: Step 6 references "randomised class equipment from the Player's Book" which is a separate source. Recommend deferring.
5. **Magic item generation**: Step 8 involves rolling per magic item category per character. This is its own mini-system. Recommend implementing the percentage chance but deferring actual item table lookups.

## Recommended Scope for First Implementation

Focus on the **structural party generation** (size, level tier, kindred, class, level per member) and defer equipment, spells, magic items, and quest details. This gives us a working "Adventuring Party" encounter result that lists party composition with stat block references, which is the most immediately useful output for the Referee.
