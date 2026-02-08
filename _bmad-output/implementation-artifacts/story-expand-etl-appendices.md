---
title: 'Story: Expand ETL for Appendices'
status: 'draft'
created: '2026-02-08'
---

# Story: Expand ETL to Load Adventurers, Mortals, and Animals

**As a** Developer
**I want** the ETL pipeline to parse creatures from "Part Three: Appendices" of the DMB
**So that** I can import Adventurers, Everyday Mortals, and Animals into the game assets.

## Context

The current ETL pipeline successfully parses "Part Two: Bestiary" (Monsters). However, standard NPCs and animals are located in "Part Three: Appendices". These entities use the same stat block format as monsters and should be treated as `Creature` entities in our system.

### Parsing Specifics (from analysis of `dmb-raw.txt`)

1.  **Adventurers**:
    - **Section**: Starts at header **"Adventurers"** (approx line 6515). Ends at header **"Adventuring Parties"** (approx line 6833).
    - **Type**: Set `type` to `"Mortal"`.
    - **Stat Blocks**: Defined by Class (e.g., "Bard").
    - **Levels**: Source lists Level 1, 3, and 5 variants (e.g., "Level 1 Bard (Rhymer)", "Level 3 Bard...").
    - **Constraint**: **Extract ONLY the Level 1 stat block** for this iteration.
    - **Name**: Extract only the Class name (e.g., "Bard") from the Level 1 line (e.g., "Level 1 Bard (Rhymer)").

2.  **Everyday Mortals**:
    - **Section**: Starts at header **"Everyday Mortals"** (approx line 6948). Ends at header **"Animals"** (approx line 7133).
    - **Structure**: A list of "Jobs" (e.g., ANGLER, CRIER, FORTUNE-TELLER, LOST SOUL) followed by a **single shared stat block** titled "Everyday Mortal".
    - **Logic**:
      1.  Extract the generic "Everyday Mortal" stat block.
      2.  Identify all "Job" headers in this section (ALL CAPS headings like "ANGLER", "CRIER").
      3.  Create a separate `Creature` entry for each Job, using the stats from "Everyday Mortal".
    - **Name**: The creature name should be the Job (e.g., "Angler", "Crier") in Title Case.

3.  **Animals**:
    - **Section**: Starts at header **"Animals"** (approx line 7133). Ends at header **"Monster Rumours"** (approx line 7780).
    - **Format**: Standard unique stat blocks.
    - **Naming**: Handle "NAME, COMMA" -> "Name, Comma" (e.g., "BAT, GIANT" -> "Bat, Giant").

## Acceptance Criteria

1.  **Scope Expansion**: The `transform` step must parse text from "Part Three" with specific start/end markers for the three new sections.
2.  **Adventurer Parsing**:
    - Identify Class-based blocks.
    - Extract **only** Level 1 stats.
    - Set type to "Mortal".
3.  **Everyday Mortal Parsing**:
    - Extract the single "Everyday Mortal" stat block.
    - Identify distinct Jobs (Angler, Crier, etc.).
    - Generate multiple creatures: "Angler", "Crier", etc., all using the shared stats.
4.  **Animal Parsing**:
    - Extract animals between "Animals" and "Monster Rumours".
    - Fix capitalization and comma formatting in names.
5.  **Schema Compliance**: All entities valid against `CreatureSchema`.

## Technical Tasks

- [ ] **Task 1**: Update `packages/etl/src/steps/transform.ts`:
  - Add distinct parsing logic for the 3 new sections (Adventurers, Everyday Mortals, Animals) based on their specific headers.
  - **Adventurers**: Regex to match "Level 1 [Class]" and ignore Level 3/5.
  - **Everyday Mortals**:
    - Regex to find ALL CAPS headers (Jobs) within the section.
    - Regex to find the "Everyday Mortal" stat block.
    - Post-processing loop to clone the stats for each Job.
  - **Animals**: Standard parsing but with name normalization (Title Case + Comma fix).
- [ ] **Task 2**: Add Test Cases (`packages/etl/test/transform.spec.ts`):
  - Mock text with "Level 1 Class", "Level 3 Class" -> Verify only Level 1 is extracted.
  - Mock text with "JOB A", "JOB B", "Everyday Mortal stats" -> Verify "Job A" and "Job B" creatures exist with correct stats.
  - Mock text with "BAT, GIANT" -> Verify "Bat, Giant".

## Risky Areas

- **Job Identification**: Identifying the "Job" headers might be tricky if they look like other text. They are usually ALL CAPS lines.
- **Shared Stats**: Ensuring the "Everyday Mortal" stats are correctly applied to _all_ jobs found in that specific section range.
