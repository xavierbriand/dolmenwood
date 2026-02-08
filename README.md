# Dolmenwood Encounter Generator

A CLI tool for generating random encounters for the Dolmenwood RPG setting. This project uses a **Hexagonal Architecture** within a TypeScript Monorepo.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: Package manager (`npm install -g pnpm`)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/xavierbriand/dolmenwood.git
    cd dolmenwood
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

3.  Build the project:
    ```bash
    pnpm build
    ```

## ⚙️ Configuration (Assets)

Because the encounter tables and creature statistics are proprietary content of Dolmenwood, they are **not included** in this repository. You must provide them manually.

1.  Create an `assets` folder in the root directory:
    ```bash
    mkdir assets
    ```

2.  Populate it with YAML files. You can split data across multiple files (e.g., `creatures.yaml`, `common-tables.yaml`, `regional-tables.yaml`). The system loads all `.yaml` files in the directory.

### File Formats

**Creature Data** (e.g., `assets/creatures.yaml`)
```yaml
- name: Forest Sprite
  level: 1
  alignment: Neutral
  xp: 15
  numberAppearing: 1d6
  armourClass: 12
  movement: 40
  hitDice: 1d8
  attacks:
    - Weapon (+0)
  morale: 7
  treasure: 2d4gp
  description: A small magical creature of the woods.
```

**Table Data** (e.g., `assets/regions.yaml`)
```yaml
# Root regional tables usually follow the naming convention:
# "Encounter Type - {Time} - {Terrain/Condition}"
# e.g., "Encounter Type - Daytime - Wild"

- name: Encounter Type - Daytime - Wild
  die: 1d8
  entries:
    - min: 1
      max: 1
      type: Animal
      ref: Common - Animal # References a generic table
    - min: 2
      max: 2
      type: Regional
      ref: Regional # Will look for "Regional - {Region Name}"

- name: Common - Animal
  die: 1d20
  entries:
    - min: 1
      max: 20
      type: Creature
      ref: Forest Sprite # References a name in creatures.yaml
      count: 1d10
```

## 🎮 Usage

Run the CLI using `pnpm`:

```bash
# Syntax
pnpm --filter @dolmenwood/cli start -- encounter <region_id> [options]

# Options:
#   -t, --time <time>       Time of day: "Day" or "Night" (default: "Day")
#   --terrain <terrain>     Terrain: "Road" or "Off-road" (default: "Off-road")
#   -c, --camping           Is the party camping? (flag)

# Example: Generate an encounter for High Wold, at Night, on a Road
pnpm --filter @dolmenwood/cli start -- encounter "high-wold" --time Night --terrain Road
```

### Features

- **Context-Aware Generation**: Takes region, time, terrain, and camping status into account to select the correct tables.
- **Recursive Lookups**: Automatically resolves generic references (e.g., `Common - Animal`) to localized versions (e.g., `Common - Animal - High Wold`) if they exist.
- **Full Stat Blocks**: Outputs complete B/X stats for generated creatures.

## 🛠️ Development

- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Lint:** `pnpm lint`

### Architecture

- **`packages/core`**: Pure domain logic, entities, and port interfaces.
- **`packages/data`**: Adapters for loading data (YAML).
- **`packages/cli`**: The command-line interface adapter.
