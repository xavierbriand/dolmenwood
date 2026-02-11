---
title: 'Tech Spec: Animals Pipeline'
status: 'revised'
created: '2026-02-11'
revised: '2026-02-11'
parent: 'tech-spec-dmb-creature-etl-pipeline'
---

# Tech Spec: Animals Pipeline

## Overview

### Problem Statement

The current ETL pipeline handles "Part Two: Bestiary" where each creature occupies one or more full pages. The **Animals** section (Part Three: Appendices, Pages 112-119) is structurally different: **multiple creatures are packed onto each page** in a dense, condensed format. The existing `splitBestiaryPages` + `PageMerger` strategy does not work here because page boundaries do not align with creature boundaries.

### Solution

Implement a 3-step Animals sub-pipeline:

1. **Slice** — Extract only the Animals section text from the normalized document.
2. **Split** — Split that text into individual creature blocks using a regex-based splitter keyed on ALL CAPS creature names.
3. **Parse** — Parse each block into a `Creature` object using a compact stat block parser tailored to the Animals format.

### Scope

- **In Scope:** 53 animals (Ant, Giant through Yegril) as listed in the TOC.
- **Out of Scope:** Adventurers, Everyday Mortals (separate sub-pipelines), Monster Rumours.

---

## Source Data Analysis

### Section Boundaries

From `tmp/etl/dmb-normalized.md`:

| Marker        | Line | Content                                                                |
| ------------- | ---- | ---------------------------------------------------------------------- |
| Section Start | 6828 | `Animals` (preceded by page header `part three \| appenDices` + `112`) |
| Section End   | 7452 | `Monster Rumours` (preceded by page header + `120`)                    |

### Page Break Noise

Page breaks appear inline between creatures as:

```text
\npart three | appenDices\n{pageNum}\n
```

Pages: 112, 113, 114, 115, 116, 117, 118, 119. These must be stripped or ignored during splitting.

### Creature Block Format

Each animal follows this consistent structure:

```
NAME[, QUALIFIER]                          ← ALL CAPS creature name
Description paragraph(s)...               ← 1+ lines of prose
{size} {type}-{intelligence}-{alignment}  ← Meta line (mixed case, e.g. "MeDiuM aniMal-aniMal intelligence-neutral")
Level {n} AC {n} HP {dice} ({avg}) Saves {saves}   ← Stat Line 1
Att {attacks} Speed {n} [...] Morale {n} XP {n} Enc {dice} [Hoard {hoard}]  ← Stat Line 2
[Special ability: description]...          ← 0+ ability lines
```

**Concrete Example — Ant, Giant:**

```text
ANT, GIANT
Giant (6′ long), omnivorous, black ants. Rapaciously
consume everything in their path. Known to mine veins
of crystal beneath ley lines.
MeDiuM Bug-aniMal intelligence-neutral
Level 4 AC 16 HP 4d8 (18) Saves D10 R11 H12 B13 S14
Att Bite (+3, 2d6) Speed 60 Morale 7 (12 in melee)
XP 80 Enc 3d4 Hoard Gold or crystals (see below)
Morale: Attack relentlessly, once engaged in melee (Morale
12). Pursue even through flames.
Hoard: 30% chance of 1d10 × 1,000gp worth of gold nuggets
or crystals, mined by the ants.
```

### Key Observations

1. **Names are ALL CAPS** — e.g. `ANT, GIANT`, `BAT, VAMPIRE`, `SNAKE-ADDER`.
2. **Names may contain commas** — `ANT, GIANT` but also simple names like `BEAR`, `BOAR`.
3. **Names may contain hyphens** — `SNAKE-ADDER`, `SNAKE-GIANT PYTHON`.
4. **Meta line uses odd mixed case** — `MeDiuM`, `sMall`, `aniMal`, `seMi-intelligent`. This is a PDF artifact from the decorative font.
5. **Stat Line 2 may wrap** — The `Att` line and `XP`/`Enc` can appear on the same line or wrap to a second line depending on attack length.
6. **53 creatures** confirmed in the TOC (Pages 112-119).
7. **No creatures span multiple pages** — each creature fits within a single page's worth of text.
8. **Kerning artifacts in both TOC and body text** — e.g. `Fly, Gia nt` (TOC line 154) and `GEL ATINOUS APE` (body line 7014). The Normalizer's kerning dictionary does **not** currently cover all affected names. **Prerequisite:** Extend the Normalizer kerning dictionary to include `GELATINOUS` (and any other affected names found during implementation) before running the Animals pipeline.

---

## Prerequisites

Before implementing the Animals pipeline, complete the following:

1. **Extend Normalizer kerning dictionary** — Add `GELATINOUS` (and any other broken words discovered during implementation) to the kerning fix dictionary in `packages/etl/src/processors/Normalizer.ts`. Verify by running the Normalizer on the raw text and confirming `GEL ATINOUS` is corrected to `GELATINOUS` in the output.

2. **Verify TOC animal count** — Run `parseAppendicesList` on the current normalized text and confirm it returns exactly 53 animal entries. This count is used as the validation target throughout the pipeline.

---

## Implementation Plan

### Step 1: Slice — `AnimalSlicer`

**Goal:** Extract the raw text of the Animals section from the full normalized document.

**File:** `packages/etl/src/processors/AnimalSlicer.ts`

**Strategy:**

Use two regex patterns to find the start and end boundaries, then slice the text between them.

```typescript
// Start: The "Animals" section header following a page break
// Match: "Animals\n" that appears after "part three | appenDices\n112"
// We anchor on the "Animals" header that is followed by the introductory paragraph.
//
// IMPORTANT: In the current normalized output, line 6829 contains a doubled subtitle
// artifact: "Mundane animals and their giant cousins...Wood.Mundane animals and their..."
// (no space before the second "Mundane"). The regex uses a prefix match so this is safe,
// but if the Normalizer is updated to strip duplicate subtitles, this pattern must be
// re-verified.
const ANIMALS_START = /^Animals\nMundane animals/m;

// End: The "Monster Rumours" section header
const ANIMALS_END = /^Monster Rumours$/m;
```

**Algorithm:**

1. Find `ANIMALS_START` match in the full normalized text.
2. Find `ANIMALS_END` match in the full normalized text.
3. If start is not found, log a warning and return `''`.
4. If end is not found, slice from start to EOF (graceful degradation).
5. Return `text.slice(startMatch.index, endMatch.index).trim()`.

**Edge Case:** The word "Animals" also appears in the TOC (line 139) and in the introductory paragraph. The regex anchors on the double line `Animals\nMundane animals` to disambiguate.

**Output:** A single string containing everything from the "Animals" header through the last creature (Yegril), excluding the "Monster Rumours" header.

**Test Cases:**

| #   | Scenario        | Input                                    | Expected                                                      |
| --- | --------------- | ---------------------------------------- | ------------------------------------------------------------- |
| 1   | Happy path      | Full normalized text                     | Text from "Animals\nMundane animals..." through "...Enc\n3d8" |
| 2   | Start not found | Text without Animals section             | Returns empty string                                          |
| 3   | End not found   | Text with Animals but no Monster Rumours | Returns text from Animals to EOF                              |

---

### Step 2: Split — `AnimalSplitter`

**Goal:** Split the Animals section text into individual creature text blocks.

**File:** `packages/etl/src/processors/AnimalSplitter.ts`

**Strategy:**

Split on ALL CAPS creature name headers. A creature name header is defined as a line that:

- Consists entirely of uppercase letters, spaces, commas, and hyphens
- Contains at least 3 uppercase letters (the regex `[A-Z][A-Z, -]+` requires 2+ characters total, but the shortest real creature name is `BEAR` at 4 chars; the 3-letter minimum is enforced by adding `{2,}` to the trailing character class)
- Is on its own line (anchored with `^...$` and multiline flag — this is the primary protection against false positives like inline `AC`, `HP`, etc.)

**Primary Split Regex:**

```typescript
// Matches a line that is an ALL CAPS creature name.
// Creature names: uppercase letters, optional comma+space, optional hyphen.
// Examples: "ANT, GIANT", "BEAR", "SNAKE-ADDER", "GEL ATINOUS APE"
// Must be on its own line (^...$) with multiline flag.
// The {2,} ensures at least 3 total characters, avoiding 2-char matches.
const CREATURE_HEADER = /^([A-Z][A-Z, -]{2,})$/gm;
```

**Pre-processing — Strip Page Breaks:**

Before splitting, remove all page break noise:

```typescript
// Remove page breaks: "part three | appenDices\n{pageNum}"
// These appear between creatures and would interfere with splitting.
const PAGE_BREAK = /\n?part three \| appenDices\n\d+\n?/gi;
text = text.replace(PAGE_BREAK, '\n');
```

**Pre-processing — Strip Section Preamble:**

Remove the introductory paragraph (from "Animals" header through "...described briefly here."):

```typescript
// The preamble ends with the line "...described briefly here."
const PREAMBLE = /^Animals\n.*?described briefly here\.\n/s;
text = text.replace(PREAMBLE, '');
```

**Splitting Algorithm:**

1. Strip page breaks from the sliced text.
2. Strip the section preamble.
3. Find all `CREATURE_HEADER` matches with their indices.
4. For each match at index `i`, the creature block is `text.slice(matches[i].index, matches[i+1]?.index ?? text.length)`.
5. Return an array of `{ name: string, text: string }` where `name` is the matched header and `text` is the full block (including the name line).

**Blocklist — False Positive Headers:**

Some ALL CAPS lines within creature descriptions could false-match. Known safe because:

- Stat keywords (`LEVEL`, `AC`, `HP`, `ATT`, `SPEED`, `MORALE`, `XP`, `ENC`, `HOARD`) are part of inline stat lines, not standalone lines.
- Ability names like `Morale:`, `Hoard:`, `Poison:` use Title Case with a colon, not ALL CAPS.

However, we should validate against the TOC list (53 names) as a post-split sanity check.

**Post-Split Validation:**

Compare the number of split blocks against the expected count from the TOC (53). Log a warning if they differ. Optionally, match each block's name against the TOC after name normalization.

**Test Cases:**

| #   | Scenario                       | Input                                                           | Expected                      |
| --- | ------------------------------ | --------------------------------------------------------------- | ----------------------------- |
| 1   | Two creatures                  | `"ANT, GIANT\ndesc\nstats\nBAT, GIANT\ndesc\nstats"`            | 2 blocks                      |
| 2   | Page break between creatures   | Text with `part three \| appenDices\n113` between two creatures | Page break stripped, 2 blocks |
| 3   | Creature with kerning artifact | `"GEL ATINOUS APE\ndesc..."`                                    | Matched as a single creature  |
| 4   | Name with hyphen               | `"SNAKE-ADDER\ndesc..."`                                        | Matched correctly             |
| 5   | Count validation               | Full Animals section text                                       | 53 blocks                     |

---

### Step 3: Parse — `AnimalStatParser`

**Goal:** Parse a single creature text block into a `Creature` object conforming to `CreatureSchema`.

**File:** `packages/etl/src/processors/AnimalStatParser.ts`

**Strategy:**

Parse the condensed stat format using targeted regex patterns for each line type.

#### 3a. Name Normalization

Convert the ALL CAPS header to Title Case:

```typescript
function normalizeName(raw: string): string {
  // "ANT, GIANT" -> "Ant, Giant"
  // "SNAKE-ADDER" -> "Snake-Adder"
  // "GEL ATINOUS APE" -> "Gelatinous Ape" (after kerning fix)
  return raw
    .split(/([, -]+)/) // Split on delimiters, keeping them
    .map(
      (segment) =>
        segment.match(/^[, -]+$/)
          ? segment // Keep delimiters as-is
          : segment.charAt(0).toUpperCase() + // Capitalize first letter
            segment.slice(1).toLowerCase(), // Lowercase rest
    )
    .join('');
}
```

Kerning artifacts (e.g. `GEL ATINOUS`) should be cleaned by the existing `Normalizer` kerning dictionary before this stage. If not, a fallback kerning clean step can be applied here.

#### 3b. Meta Line Parser

```typescript
// Matches: "MeDiuM Bug-aniMal intelligence-neutral"
// or:      "sMall aniMal-seMi-intelligent-chaotic"
// or:      "large aniMal-aniMal intelligence-neutral"
//
// FRAGILITY NOTE: The literal alternation (sMall|MeDiuM|large) depends on
// how pdf-parse renders the decorative font used in the source PDF. The
// mixed case is a consistent artifact of the current extraction. If the
// Normalizer or pdf-parse version changes, these literals may need updating.
// A case-insensitive fallback is provided as a secondary match.
const META_LINE = /^(sMall|MeDiuM|large)\s+(\S+)-(.*?)$/im;
const META_LINE_FALLBACK = /^(small|medium|large)\s+(\S+)-(.*?)$/im;
```

**Parser logic:** Try `META_LINE` first. If no match, try `META_LINE_FALLBACK`. If neither matches, throw a descriptive error including the creature name for debugging.

Extracts:

- **Size**: Group 1 → normalize to `"Small"`, `"Medium"`, `"Large"`
- **Type**: Group 2 → normalize (e.g. `"aniMal"` → `"Animal"`, `"Bug"` → `"Bug"`)
- **Intelligence + Alignment**: Group 3 → split on `-` → e.g. `["aniMal intelligence", "neutral"]` → `"Animal Intelligence"`, `"Neutral"`

#### 3c. Stats Blob Pre-Join (Required)

Before parsing stat lines, join the raw stat content into a single string ("stats blob"). This is **required** because Stat Line 2 fields can wrap across lines in the source text. For example, Yegril (line 7447-7448):

```
Att 2 hooves (+3, 1d6) Speed 40 Morale 6 XP 80 Enc
3d8
```

Here `Enc` and its value `3d8` are split across two lines.

**Algorithm:**

1. Locate the meta line (size/type/alignment) in the creature block.
2. Locate the first special ability header (a line matching `/^[A-Z][a-z].*:/`) or the end of the block.
3. Extract everything from the meta line through the line before the first ability header.
4. Replace all newlines with spaces and collapse multiple spaces.
5. Parse the resulting single-line blob with Stat Line 1 and Stat Line 2 patterns.

```typescript
function buildStatsBlob(block: string): string {
  // Find from meta line to first ability header (or end of block)
  // Uses case-insensitive match to handle both primary (sMall/MeDiuM/large)
  // and fallback (small/medium/large) forms of the meta line.
  const metaStart = block.search(/^(?:small|medium|large)\s+/im);
  if (metaStart === -1) throw new Error('Meta line not found');

  const abilityMatch = block.slice(metaStart).search(/^[A-Z][a-z][^:]+:\s/m);
  const statsSection =
    abilityMatch === -1
      ? block.slice(metaStart)
      : block.slice(metaStart, metaStart + abilityMatch);

  return statsSection.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}
```

All subsequent Stat Line 1 and Stat Line 2 patterns operate on the output of `buildStatsBlob()`, not on individual lines.

#### 3d. Stat Line 1 Parser

```typescript
// Matches: "Level 4 AC 16 HP 4d8 (18) Saves D10 R11 H12 B13 S14"
const STAT_LINE_1 =
  /Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+([\dd+]+)\s*\((\d+)\)\s+Saves\s+(D\d+\s+R\d+\s+H\d+\s+B\d+\s+S\d+)/i;
```

Extracts:
| Group | Field | Example |
|-------|-------|---------|
| 1 | `level` | `4` |
| 2 | `armourClass` | `16` |
| 3 | `hitDice` | `"4d8"` |
| 4 | `hitPoints` (avg) | `18` |
| 5 | `save` | `"D10 R11 H12 B13 S14"` |

#### 3e. Stat Line 2 Parser

This is the most complex section because it has many optional fields. Since the stats blob pre-join (Step 3c) has already collapsed multi-line wrapping into a single string, all patterns here operate on that single-line blob.

```typescript
// Stat Line 2 contains: Att, Speed (optional), Fly/Swim/Burrow/Webs (optional),
// Morale, XP, Enc, Hoard (optional), Possessions (optional)
//
// Examples (after blob join — all single-line):
//   "...Att Bite (+3, 2d6) Speed 60 Morale 7 (12 in melee) XP 80 Enc 3d4 Hoard Gold or crystals (see below)"
//   "...Att Bite (+1, 1d4) Speed 10 Fly 60 Morale 8 XP 20 Enc 1d10"
//   "...Att Bite (+7, 2d8) and 4 barbels (+7, 1d4) Swim 30 Morale 8 XP 1,040 Enc 1d2"
//   "...Att 2 hooves (+3, 1d6) Speed 40 Morale 6 XP 80 Enc 3d8"  ← was wrapped in source

// Strategy: Parse field-by-field using named anchors on the blob.
// Since the blob is a single line, the /s flag is NOT needed.

const ATT_PATTERN = /Att\s+(.*?)\s+(?=Speed|Fly|Swim|Burrow|Webs|Morale)/i;
const SPEED_PATTERN = /Speed\s+(\d+)/i;
const FLY_PATTERN = /Fly\s+(\d+)/i;
const SWIM_PATTERN = /Swim\s+(\d+)/i;
const BURROW_PATTERN = /Burrow\s+(\d+)/i;
const WEBS_PATTERN = /Webs\s+(\d+)/i;
const MORALE_PATTERN = /Morale\s+(\d+)/i; // Extract ONLY the first number
const XP_PATTERN = /XP\s+([\d,]+)/i;
const ENC_PATTERN = /Enc\s+([\dd+]+|\d+)/i;
// HOARD and POSS patterns match to end of blob (safe because blob
// is bounded — it excludes ability text below the stat lines).
const HOARD_PATTERN = /Hoard\s+(.+)/i;
const POSS_PATTERN = /Possessions\s+(.+)/i;
```

**Attacks parsing:**

The `Att` field is the trickiest. It contains compound attacks joined by `and`:

```
Att 2 claws (+3, 1d3 + bear hug) and bite (+3, 1d6)
Att Bite (+1, 1d4 + unconsciousness)
Att Bite (+7, 2d8) and 4 barbels (+7, 1d4)
Att Bite (+0, 1d4) or urine spray (+0, stench, range 10′)
```

Strategy: Extract the full `Att` string and split on `and` / `or` to produce an array of attack strings.

```typescript
function parseAttacks(attStr: string): string[] {
  // Split on " and " or " or " at word boundaries.
  // NOTE: This naive split could break if "and"/"or" appears inside
  // parenthetical text (e.g. "(fire and ice damage)"). Analysis of all
  // 53 Animals confirms no such cases exist in this section, so the
  // simple approach is safe here. If reused for other sections, a
  // parenthesis-aware splitter should be considered.
  return attStr
    .split(/\s+(?:and|or)\s+/i)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}
```

**Movement parsing:**

Compose a movement string from the optional fields:

```typescript
// Primary: "Speed 40" or just "Fly 60" (no Speed if creature only flies/swims)
// Additional: "Fly 60", "Swim 20", "Burrow 20", "Webs 40"
// Output for CreatureSchema.movement: "40" or "40 Fly 60" etc.
```

#### 3f. Special Abilities Parser

Everything after stat line 2 (excluding page break noise) is special abilities text. Each ability starts with a **Title Case name followed by a colon**:

```
Morale: Attack relentlessly, once engaged in melee...
Hoard: 30% chance of 1d10 × 1,000gp...
Poison: Save Versus Doom or...
```

```typescript
const ABILITY_HEADER = /^([A-Z][a-z][^:]+):\s*/gm;
```

These are captured as part of the `description` field or as a structured abilities list (depending on schema needs). For `CreatureSchema` compliance, they fold into the `description` field.

#### 3g. Description Extraction

The description is the prose text between the creature name and the meta line:

```typescript
// Everything between the name line and the meta line
const DESC_PATTERN =
  /^[A-Z][A-Z, -]+\n([\s\S]*?)(?=^(?:sMall|MeDiuM|large)\s)/m;
```

#### 3h. Mapping to `CreatureSchema`

| Schema Field      | Source                              | Notes                                                                                                                                                        |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`            | Header → `normalizeName()`          | Title Case                                                                                                                                                   |
| `level`           | Stat Line 1 → Group 1               | Number                                                                                                                                                       |
| `armourClass`     | Stat Line 1 → Group 2               | Number                                                                                                                                                       |
| `hitDice`         | Stat Line 1 → Group 3               | String, e.g. `"4d8"`                                                                                                                                         |
| `save`            | Stat Line 1 → Group 5               | String, e.g. `"D10 R11 H12 B13 S14"`                                                                                                                         |
| `attacks`         | Stat Line 2 → `parseAttacks()`      | Array of strings                                                                                                                                             |
| `movement`        | Stat Line 2 → Speed/Fly/Swim/Burrow | Number or composite string                                                                                                                                   |
| `morale`          | Stat Line 2 → `MORALE_PATTERN`      | Number — `parseInt` the first `\d+` group only; parenthetical notes like `(12 in melee)` are discarded from the numeric field but preserved in `description` |
| `xp`              | Stat Line 2 → `XP_PATTERN`          | Number (strip commas)                                                                                                                                        |
| `numberAppearing` | Stat Line 2 → `ENC_PATTERN`         | String, e.g. `"3d4"`                                                                                                                                         |
| `treasure`        | Stat Line 2 → `HOARD_PATTERN`       | Optional string                                                                                                                                              |
| `alignment`       | Meta line → last segment            | `"Neutral"`, `"Chaotic"`, `"Lawful"`                                                                                                                         |
| `type`            | `"Animal"`                          | Hardcoded for all Animals                                                                                                                                    |
| `kindred`         | Meta line → type segment            | `"Animal"`, `"Bug"`                                                                                                                                          |
| `description`     | Prose + special abilities           | Concatenated string                                                                                                                                          |

**Test Cases:**

| #   | Scenario             | Input Block                           | Key Assertions                                                                                      |
| --- | -------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Simple creature      | Bear block                            | `name: "Bear"`, `level: 4`, `AC: 13`, `attacks: ["2 claws (+3, 1d3 + bear hug)", "bite (+3, 1d6)"]` |
| 2   | Comma name           | `"ANT, GIANT"` block                  | `name: "Ant, Giant"`                                                                                |
| 3   | Hyphen name          | `"SNAKE-ADDER"` block                 | `name: "Snake-Adder"`                                                                               |
| 4   | Multiple movement    | Bat, Giant block                      | `movement` includes `Speed 10 Fly 60`                                                               |
| 5   | No Speed (swim only) | Catfish, Giant block                  | `movement` includes `Swim 30`                                                                       |
| 6   | Hoard present        | Ant, Giant block                      | `treasure: "Gold or crystals (see below)"`                                                          |
| 7   | Hoard absent         | Boar block                            | `treasure: undefined`                                                                               |
| 8   | XP with comma        | Giant Catfish (`XP 1,040`)            | `xp: 1040`                                                                                          |
| 9   | Morale with note     | Ant, Giant (`Morale 7 (12 in melee)`) | `morale: 7`                                                                                         |
| 10  | Wrapped Att line     | Bat, Vampire (Att wraps to next line) | Attacks parsed correctly                                                                            |
| 11  | `or` attack          | Woad (`bite or urine spray`)          | 2 attacks                                                                                           |
| 12  | Possessions field    | Shaggy Mammoth (`Possessions Ivory`)  | `treasure: "Ivory"`                                                                                 |

---

## Integration with Existing Pipeline

### New Files

| File                                                    | Purpose                                       |
| ------------------------------------------------------- | --------------------------------------------- |
| `packages/etl/src/processors/AnimalSlicer.ts`           | Step 1: Extract Animals section text          |
| `packages/etl/src/processors/AnimalSplitter.ts`         | Step 2: Split into individual creature blocks |
| `packages/etl/src/processors/AnimalStatParser.ts`       | Step 3: Parse block → `Creature`              |
| `packages/etl/test/processors/AnimalSlicer.spec.ts`     | Tests for slicer                              |
| `packages/etl/test/processors/AnimalSplitter.spec.ts`   | Tests for splitter                            |
| `packages/etl/test/processors/AnimalStatParser.spec.ts` | Tests for parser                              |

### Modified Files

| File                                  | Change                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/etl/src/steps/transform.ts` | Add `transformAnimals()` function that orchestrates Slicer → Splitter → Parser |
| `packages/etl/src/index.ts`           | Wire `transformAnimals` into the `transform` and `all` commands                |

### Pipeline Flow (updated)

```
Extract (PDF → raw text)
  ↓
Normalize (Normalizer)
  ↓
  ├── Bestiary Pipeline (existing)
  │     Chunker.extractBestiarySection → splitBestiaryPages → filterValidPages → PageMerger → [StatParser]
  │
  └── Animals Pipeline (new)
        AnimalSlicer.slice → AnimalSplitter.split → AnimalStatParser.parse (×53)
  ↓
Merge all Creature[] arrays
  ↓
Load (validate via CreatureSchema → write YAML)
```

### Orchestration in `transform.ts`

```typescript
export function transformAnimals(normalizedText: string): Creature[] {
  const slicer = new AnimalSlicer();
  const splitter = new AnimalSplitter();
  const parser = new AnimalStatParser();

  // Step 1: Slice
  const animalsText = slicer.slice(normalizedText);
  if (!animalsText) {
    console.warn(
      '    - Animals section not found in normalized text. Skipping.',
    );
    return [];
  }

  // Step 2: Split
  const blocks = splitter.split(animalsText);
  console.log(`    - Split into ${blocks.length} animal blocks.`);

  if (blocks.length === 0) {
    console.warn('    - No animal blocks found after splitting. Skipping.');
    return [];
  }

  // Step 3: Parse each block
  const creatures: Creature[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const block of blocks) {
    try {
      const creature = parser.parse(block.name, block.text);
      creatures.push(creature);
    } catch (e) {
      errors.push({ name: block.name, error: (e as Error).message });
    }
  }

  if (errors.length > 0) {
    console.warn(`    - Failed to parse ${errors.length} animals:`);
    errors.forEach((e) => console.warn(`      - ${e.name}: ${e.error}`));
  }

  console.log(`    - Parsed ${creatures.length} animals successfully.`);
  return creatures;
}
```

---

## Verification Plan

### Unit Tests (TDD — Red/Green/Refactor)

1. **AnimalSlicer.spec.ts**
   - Slices correct text boundaries from full normalized document mock.
   - Returns empty string when section is missing.

2. **AnimalSplitter.spec.ts**
   - Splits 2 creatures from minimal input.
   - Handles page break removal.
   - Handles kerning artifacts in names.
   - Validates count against expected (53 from TOC).

3. **AnimalStatParser.spec.ts**
   - Parses all field types from a representative creature block (use generic test data, not proprietary names — per AGENTS.md).
   - Handles each edge case from the test matrix above.
   - Output validates against `CreatureSchema`.

### Integration Test

Run the full Animals pipeline on the actual normalized text and assert:

- **53 creatures** produced.
- **0 validation errors** against `CreatureSchema`.
- **Structural spot-checks**: First and last entries have non-empty `name`, valid `level`, `armourClass`, and `attacks`.

> **IP Compliance (AGENTS.md Section 3):** Integration tests in committed code must NOT assert specific proprietary creature names. Use count-based and structural assertions only. Name-based verification may be done ad-hoc during development but must not appear in committed test files.

### Pre-Push Verification

```bash
pnpm build && pnpm lint && pnpm test
```

---

## Risk Assessment

| Risk                                                               | Likelihood                   | Impact | Mitigation                                                                                                              |
| ------------------------------------------------------------------ | ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Stat Line 2 wraps unpredictably                                    | Medium                       | High   | **Resolved:** Stats blob pre-join (Step 3c) concatenates all stat lines into a single string before parsing             |
| Kerning artifacts in creature names                                | **Confirmed** (GEL ATINOUS)  | High   | **Prerequisite:** Extend Normalizer kerning dictionary to cover `GELATINOUS` and verify all 53 names post-normalization |
| ALL CAPS false positive in ability text                            | Low                          | Medium | Validate split count against TOC; `{2,}` quantifier on regex; `^...$` line anchoring                                    |
| `Att` regex fails on complex compound attacks                      | Medium                       | High   | Field-anchored parsing on blob (Att...Speed/Morale); extensive test coverage for compound attacks                       |
| `Possessions` field (Shaggy Mammoth) not in existing Hoard pattern | Low                          | Low    | `POSS_PATTERN` added as fallback for `treasure` field                                                                   |
| META_LINE regex depends on PDF font artifacts                      | Low (stable across versions) | High   | Case-insensitive fallback regex added; descriptive error on match failure                                               |

---

## Open Questions

1. ~~**Stat Line 2 wrapping**~~ **Resolved — promoted to required Step 3c.** The stats blob pre-join is now a required pre-processing step, not optional. See Section 3c above.

2. **Shared code with future Adventurer/Mortal parsers**: The meta line and stat line patterns are identical across all Appendices sections. Should `AnimalStatParser` be a generic `CompactStatParser` reused by all three? **Recommendation: Name the class `CompactStatParser` from the start (in file `CompactStatParser.ts`) to avoid a rename later. The Animals-specific orchestration (`AnimalSlicer`, `AnimalSplitter`) remains separate, but the stat parsing logic itself is generic. This also simplifies the file listing — replace `AnimalStatParser.ts` with `CompactStatParser.ts` in the New Files table.**

3. **`description` field granularity**: Should special abilities be stored separately from the prose description, or concatenated? The current `CreatureSchema` has a single `description` field. **Recommendation: Concatenate for now; refactor schema later if abilities need to be structured.**
