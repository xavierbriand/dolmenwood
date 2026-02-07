# Agentic Coding Guidelines

This document provides instructions for AI agents and developers working on the **Dolmenwood Encounter Generator**. Follow these guidelines strictly to ensure code quality, consistency, and architectural integrity.

## 1. Build, Test, and Lint Commands

This project is a **TypeScript Monorepo** using `pnpm`.

### Core Commands
- **Install Dependencies:**
  ```bash
  pnpm install
  ```
- **Build All Packages:**
  ```bash
  pnpm build
  # or specifically:
  pnpm --filter @dolmenwood/core build
  ```
- **Run Tests (Vitest):**
  ```bash
  # Run all tests
  pnpm test
  
  # Run a specific test file
  pnpm test packages/core/src/domain/SomeTest.spec.ts
  ```
- **Linting & Formatting:**
  ```bash
  pnpm lint
  # Fix auto-fixable issues
  pnpm lint --fix
  ```

### Development
- **Run CLI (during dev):**
  Use `tsx` or `ts-node` via package scripts if available, or build and run the node executable.
  ```bash
  pnpm --filter @dolmenwood/cli start
  ```

## 2. Development Workflow (TDD Cycle)

For each new feature or fix, strictly follow this loop:

1.  **Branching:**
    - Always create a new branch for the feature/fix (e.g., `feature/wandering-monsters` or `fix/yaml-parsing`).
    - **Do not** commit directly to `main`.

2.  **Red (Tests First):**
    - Create the test file first (e.g., `packages/core/src/domain/Encounter.spec.ts`).
    - Define the test cases/specs ensuring they fail (Red).
    - Verify failure by running `pnpm test <file>`.

3.  **Green (Implement):**
    - Implement the minimal code necessary to pass the tests.
    - Run the tests again to confirm they pass (Green).

4.  **Refactor & Verify:**
    - Clean up and type-check the code.
    - Ensure strict adherence to architectural boundaries (Hexagonal).
    - Run full checks: `pnpm build && pnpm lint && pnpm test`.

5.  **Merge:**
    - Commit the changes once local CI checks pass.
    - **Ask for confirmation** from the user to merge the branch back to `main`.

## 3. Project Architecture

The project follows a **Hexagonal Architecture (Ports & Adapters)** structure within a Monorepo.

- **`packages/core`**: Pure domain logic, Entities, and Port Interfaces.
  - **Forbidden:** External infrastructure dependencies (fs, http, cli, etc.).
  - **Allowed:** `zod` (for domain validation), `ts-pattern` (for logic).
- **`packages/data`**: Secondary Adapters (Persistence/Loading).
  - Implements "Driven Ports" defined in `core`.
  - Handles YAML file loading and parsing.
- **`packages/cli`**: Primary Adapter (Driving).
  - Uses `commander`, `inquirer`, `chalk`.
  - Wires up the application using dependency injection.

**Dependency Rule:** `CLI -> Data -> Core`. Core knows nothing of the outer world.

## 4. Code Style & Conventions

### Language Standards
- **Runtime:** Node.js v20+ (LTS).
- **Language:** TypeScript 5.x with **Strict Mode** enabled.
- **Module System:** **Pure ESM** (`"type": "module"`).
  - **Critical:** You **MUST** use `.js` extensions for relative imports in source code.
    ```typescript
    // CORRECT
    import { Encounter } from './Encounter.js';
    
    // INCORRECT (Will fail in Node ESM)
    import { Encounter } from './Encounter';
    ```

### Naming Conventions
- **Files/Classes:** `PascalCase` (e.g., `EncounterTable.ts`, `RollResult.ts`).
- **Functions/Variables:** `camelCase` (e.g., `generateEncounter`, `terrainType`).
- **Interfaces:** `PascalCase` (e.g., `EncounterRepository`). Do not prefix with `I`.
- **Constants:** `UPPER_SNAKE_CASE` for global constants.

### Typing Rules
- **No `any`:** Strictly avoid `any`. Use `unknown` if necessary and narrow types safely.
- **Zod Schemas:** Use `zod` for all data validation at system boundaries (input arguments, file loading).
- **Discriminated Unions:** Use discriminated unions for domain states (e.g., `type Result = { kind: 'success', data: T } | { kind: 'failure', error: E }`).

### Error Handling
- **Typed Results:** Prefer returning `Result` types (Success/Failure) over throwing exceptions for domain errors.
- **Exceptions:** Throw exceptions only for truly exceptional system failures (e.g., out of memory, missing required configuration).

### Libraries & Patterns
- **Pattern Matching:** Use `ts-pattern` for complex game logic tables (e.g., resolving encounter types based on dice rolls).
- **Immutability:** Prefer immutable data structures. Methods should return new instances rather than mutating state when possible.

## 5. Implementation Rules (The "Foolproof" Checklist)

1.  **Check Context:** Before editing, read `packages/core/src/...` to understand the domain model.
2.  **Verify Imports:** Ensure all internal imports end in `.js`.
3.  **Boundary Checks:** Never import `cli` code into `core`.
4.  **Test Coverage:** Write tests for all new domain logic in `core`. Use BDD-style naming (e.g., `describe('given... when... then...')`).

## 6. Reference Documentation

- See `tech_stack.md` for detailed technical constraints.
- See `rules/Encounter rules.md` for domain logic and tables.
