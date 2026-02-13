# Dolmenwood Encounter Generator

A CLI tool for generating random encounters for the [Dolmenwood](https://necroticgnome.com/collections/dolmenwood) TTRPG setting by Necrotic Gnome. Built with a **Hexagonal Architecture** in a TypeScript monorepo.

## Getting Started

### Prerequisites

- **Node.js** v20+
- **pnpm** (`npm install -g pnpm`)
- **Python 3** with [PyMuPDF](https://pymupdf.readthedocs.io/) (`pip install pymupdf`) -- for ETL only

### Installation

```bash
git clone https://github.com/xavierbriand/dolmenwood.git
cd dolmenwood
pnpm install
pnpm build
```

## Importing Data (ETL)

The encounter tables and creature data are proprietary content and **not included** in this repository. If you own the Dolmenwood source books (PDFs), the ETL pipeline can extract and transform the data automatically.

### Step 1: Place PDFs

```bash
cp /path/to/DMB.pdf etl/input/DMB.pdf   # Dolmenwood Monster Book
cp /path/to/DCB.pdf etl/input/DCB.pdf   # Dolmenwood Campaign Book
```

### Step 2: Run the full pipeline

```bash
pnpm --filter @dolmenwood/etl start all
```

This runs all four stages automatically:

0. **Extract** -- invokes Python scripts to parse PDFs into JSON (`etl/output/extract/`)
1. **Transform** -- maps raw JSON into domain `Creature[]` objects (`etl/output/transform/`)
2. **Load** -- validates against Zod schemas, writes `etl/output/load/creatures/creatures.yaml`
3. **Verify** -- cross-references creatures against encounter tables

The `assets/creatures.yaml` symlink points to the ETL load output, so the CLI picks it up automatically.

### ETL Commands

| Command                          | Description                                             |
| -------------------------------- | ------------------------------------------------------- |
| `extract`                        | Run Python extractors on source PDFs                    |
| `extract-text`                   | Extract raw text from PDFs (for IP compliance)          |
| `transform`                      | Transform Python JSON into `creatures.json`             |
| `load`                           | Validate and write `creatures.yaml`                     |
| `verify`                         | Check encounter table references                        |
| `all [--clean] [--skip-extract]` | Run full pipeline (extract → transform → load → verify) |
| `clean`                          | Remove ETL output files                                 |

Run any command with: `pnpm --filter @dolmenwood/etl start <command>`

### ETL Directory Structure

```
etl/
  input/              # Source PDFs (gitignored contents)
  output/
    extract/          # Python extractor JSON + raw text (gitignored contents)
    transform/        # Intermediate creatures.json (gitignored contents)
    load/
      creatures/      # creatures.yaml (gitignored, symlinked from assets/)
      treasure-tables/# treasure-tables.json (future)
```

## Usage

### Interactive Mode

Run the CLI with no arguments for an interactive menu:

```bash
pnpm start
```

This prompts you to select a region, time of day, terrain, and camping status, then generates a full encounter with creature stats.

### Command-Line Mode

```bash
pnpm start -- encounter <region_id> [options]
```

**Options:**

| Flag                  | Description                   | Default    |
| --------------------- | ----------------------------- | ---------- |
| `-t, --time <time>`   | Time of day: `Day` or `Night` | `Day`      |
| `--terrain <terrain>` | Terrain: `Road` or `Off-road` | `Off-road` |
| `-c, --camping`       | Party is camping              | `false`    |

**Example:**

```bash
pnpm start -- encounter "high-wold" --time Night --terrain Road
```

### Session Management

```bash
pnpm start -- session new      # Start a new session
pnpm start -- session list     # List all sessions
pnpm start -- session info     # Show latest session details
```

### Features

- **Context-aware generation** -- region, time, terrain, and camping status select the correct encounter tables
- **Recursive table resolution** -- generic references (e.g., `Common - Animal`) resolve to localized versions (e.g., `Common - Animal - High Wold`) when available
- **Treasure generation** -- treasure codes on creatures are parsed and rolled into concrete loot
- **Full stat blocks** -- complete B/X-style stats for generated creatures

## Development

```bash
pnpm build    # Build all packages
pnpm test     # Run all tests (284 across 4 packages + scripts)
pnpm lint     # Lint all packages
```

### Architecture

```
CLI (driving) --> Data (driven) --> Core (domain)
```

| Package            | Role                                         | Key Dependencies                 |
| ------------------ | -------------------------------------------- | -------------------------------- |
| `@dolmenwood/core` | Pure domain logic, entities, port interfaces | `zod`, `ts-pattern`              |
| `@dolmenwood/data` | Adapters for YAML/JSON data loading          | `js-yaml`, `zod`                 |
| `@dolmenwood/cli`  | Command-line interface, dependency injection | `commander`, `inquirer`, `chalk` |
| `@dolmenwood/etl`  | PDF extraction and data transformation       | `commander`, `js-yaml`, `zod`    |

**Dependency rule:** Core knows nothing of the outer layers. Data implements port interfaces defined in Core. CLI wires everything together.

### Asset Files

The `assets/` directory contains runtime data -- hand-authored encounter tables and symlinks to ETL-generated files:

| File                       | Content                                         | Source        |
| -------------------------- | ----------------------------------------------- | ------------- |
| `creatures.yaml`           | Creature stat blocks                            | ETL (symlink) |
| `encounter-types.yaml`     | Encounter type resolution tables (time/terrain) | Hand-authored |
| `common-encounters.yaml`   | Common/shared encounter tables                  | Hand-authored |
| `regional-encounters.yaml` | Region-specific encounter tables                | Hand-authored |
| `activity.yaml`            | Creature activity tables                        | Hand-authored |
| `reaction.yaml`            | NPC reaction tables                             | Hand-authored |

### IP Compliance

A pre-commit hook scans staged files for verbatim passages (40+ characters) from the Dolmenwood source books. This prevents copyrighted content from leaking into the public repository.

- Runs automatically on every commit via Husky
- Scans against `etl/output/extract/*-raw.txt` (generated by `extract-text` command)
- Skips gracefully if raw text files are not available (e.g., in CI)
- Full scan: `pnpm tsx scripts/ip-check.ts --all`
- `packages/etl/` is exempt (it inherently processes source material)

### CI

GitHub Actions runs on every push to `main` and every PR:

1. `pnpm install`
2. `pnpm audit --prod`
3. `pnpm build`
4. `pnpm lint`
5. `pnpm test`
