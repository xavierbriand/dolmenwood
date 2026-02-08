# Technology Stack & Implementation Rules

This document defines the strict technology stack and implementation constraints for the Dolmenwood Encounter Generator. Implementation agents must adhere to these rules to ensure compatibility, type safety, and architectural integrity.

## 1. Core Technology & Environment
- **Runtime:** Node.js LTS (v20.x or higher).
  - *Constraint:* define `"engines": { "node": ">=20.0.0" }` in the root `package.json`.
- **Language:** TypeScript 5.x.
  - *Constraint:* Strict mode enabled (`"strict": true`).
- **Module System:** **Pure ESM** (ECMAScript Modules).
  - *Constraint:* Root and workspace `package.json` files **MUST** contain `"type": "module"`.
  - *Gotcha:* TypeScript source files must use `.js` extensions in relative imports (e.g., `import { foo } from './bar.js';`) unless a bundler is used. Since this is a CLI/Lib project, we favor `tsc` or `tsx` execution; explicit extensions are required for native Node.js ESM execution.
- **Package Manager:** **pnpm**.
  - *Reason:* Superior handling of monorepo symlinks and phantom dependencies.
  - *Constraint:* Use `pnpm-workspace.yaml` for workspace definitions.

## 2. Architecture: Monorepo & Hexagonal
- **Structure:**
  - `packages/core`: Domain logic, Hexagonal Ports (Interfaces), Entities. **No external infrastructure deps.**
  - `packages/data`: Adapters for data persistence/loading (YAML loaders, static data). Depends on `core`.
  - `packages/cli`: The primary entry point (Driving Adapter). Depends on `core` and `data`.
- **Dependency Flow:** CLI -> Data -> Core. (Or CLI -> Core & CLI -> Data, wired via Dependency Injection). **Core must never depend on CLI or Data.**

## 3. Libraries & Versioning
- **CLI Utilities:**
  - `commander`: For command-line argument parsing.
  - `inquirer`: For interactive prompts.
    - *Gotcha:* `inquirer` v9+ is pure ESM. This aligns with our Pure ESM requirement.
  - `chalk`: For terminal styling.
    - *Gotcha:* `chalk` v5+ is pure ESM.
- **Logic & Validation:**
  - `zod`: For runtime validation of YAML data and user inputs.
  - `js-yaml`: For parsing data files.
- **Utilities:**
  - `ts-pattern` (Optional but Recommended): For exhaustive pattern matching, useful for game logic/encounter tables.

## 4. Testing Strategy
- **Runner:** `vitest`.
  - *Config:* Configure for ESM support.
- **BDD/Gherkin:** `vitest-cucumber`.
  - *Constraint:* Ensure step definitions match the Hexagonal boundaries. Tests should primarily target the `Core` domain logic via Ports.

## 5. Critical Implementation Constraints (The "Foolproof" Checklist)
1.  **TSConfig Configuration:**
    - Use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in `tsconfig.json` to correctly align with Node's native ESM.
2.  **Shebangs:**
    - CLI entry points (e.g., `packages/cli/src/index.ts` or `bin/dolmenwood.js`) must start with `#!/usr/bin/env node`.
3.  **Cross-Package Imports:**
    - Use TypeScript "Project References" (`"references": []`) in `tsconfig.json` for faster builds and strict boundaries.
    - Define `exports` in each package's `package.json` to define public APIs. Avoid reaching into `src` from other packages (e.g., `import ... from '@dolmenwood/core'` not `.../core/src/file'`).
