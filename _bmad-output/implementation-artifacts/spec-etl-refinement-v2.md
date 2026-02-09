# ETL Refinement Specification (v2)

## 1. Problem Statement

Running the ETL `load` step resulted in **35 skipped creatures** due to validation errors.
Analysis of `dmb-raw.txt` confirms that **Part Three: Appendices** (Adventurers, Animals) uses a **Compact Stat Block** format different from the main Bestiary.

**Example Compact Block (Animals):**

```text
BAT,   VA MPIR E
...
Level 2 AC 13 HP 2d8 (9) Saves D12 R13 H14 B15 S16
Att Bite (+1, 1d4 + unconsciousness) Speed 10 Fly 60
Morale 8 XP 50 Enc 1d10
```

**Example Compact Block (Adventurers):**

```text
Level 1 Cleric (Acolyte)
...
Level 1 AC 15 HP 1d6 (3) Saves D11 R12 H13 B16 S14
Att Weapon (+0) Speed 20 Morale 8 XP 10 Enc 1d20
```

**Key Issues:**

1.  **Parsing Failures:** The current parser expects standard OSE keys (`Armour Class:`, `Move:`, etc.) and fails to extract data from the compact lines.
2.  **Kerning Artifacts:** "BAT, VA MPIR E" (Spacing in uppercase headers).
3.  **False Positives:** "AC" is detected as a creature name because the regex matches the "AC" in the stat line when the previous parser fails to consume it.

## 2. Proposed Changes (`packages/etl/src/steps/transform.ts`)

### A. Implement `cleanKerning`

- **Function:** `cleanKerning(name: string): string`
- **Logic:** Detect sequences of single uppercase letters separated by spaces (e.g., `V A M P I R E` or `VA MPIR E`) and collapse them.
- **Regex:** `/\b([A-Z])\s+(?=[A-Z]\b)/g` -> replace with `$1`. (Needs careful tuning to avoid merging words like "A BEAR").
- **Better Heuristic:** If a name is all caps and contains multiple single/double letter words that don't make sense, or just specific known patterns.
- **Simpler approach:** If the name is uppercase, remove spaces between single letters. `str.replace(/([A-Z])\s([A-Z])/g, '$1$2')` repeated until no change.

### B. Implement `parseCompactStatBlock`

- **Trigger:** When standard stat parsing fails, or specifically for creatures identified as "Animal" or "Adventurer" (based on section context or regex match).
- **Regex Strategy:**
  - **Line 1:** `^Level\s+(\d+)\s+AC\s+(\d+)\s+HP\s+([\dd+]+)\s*\((\d+)\)\s+Saves\s+(.*)$`
  - **Line 2:** `^Att\s+(.*)\s+Speed\s+(\d+.*)\s+Morale\s+(\d+)\s+XP\s+(\d+)\s+Enc\s+.*$`
- **Mapping:**
  - `AC` -> `armourClass`
  - `HP` -> `hitDice` (and hit points)
  - `Speed` -> `movement`
  - `Att` -> `attacks` (split by comma if needed)
  - `Morale` -> `morale`
  - `XP` -> `xp`

### C. Refine Header Detection

- **Exclude:** Lines starting with `Level \d` (start of compact block) or `AC` / `HP` / `Att` / `Speed`.
- **Logic:** Ensure these lines are consumed by the _previous_ creature's body parsing and never evaluated as potential new headers.

### D. Update Adventurer Parsing

- **Logic:** The "Adventurer" parser currently looks for "Level 1 [Class]". It needs to consume the _next few lines_ using `parseCompactStatBlock` instead of the standard parser.

## 3. Verification Plan

1.  **Test Case:** Add a raw text fixture in `transform.spec.ts` mimicking the "Bat, Vampire" block.
2.  **Execution:** Run `pnpm --filter @dolmenwood/etl start load` and ensure:
    - "Bat, Vampire" is loaded with full stats.
    - "Cleric" is loaded with Level 1 stats.
    - No "AC" creatures are created.
3.  **Success Metric:** Skipped creatures count drops to near 0.
