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

2.  Create `assets/creatures.yaml` and `assets/regions.yaml`.

### File Formats

**`assets/creatures.yaml`** (List of creatures)
```yaml
- name: Elf-Wanderer
  level: 1
  alignment: Any
  xp: 15
  numberAppearing: 1d6
  armourClass: 12
  movement: 40
  hitDice: 1d8
  attacks:
    - Weapon (+0)
  morale: 7
  treasure: 2d4gp
  description: Optional flavor text.
```

**`assets/regions.yaml`** (Encounter tables)
```yaml
- name: Encounter Type - Daytime - Road
  die: 1d8
  entries:
    - min: 1
      max: 1
      type: Animal
      ref: Common - Animal # References another table
    - min: 2
      max: 2
      type: Monster
      ref: Common - Monster

- name: Common - Animal
  die: 1d20
  entries:
    - min: 1
      max: 20
      type: Creature
      ref: Bat, Giant # References a name in creatures.yaml
      count: 1d10
```

## 🎮 Usage

Run the CLI using `pnpm`:

```bash
# Syntax
pnpm --filter @dolmenwood/cli start -- encounter "<Table Name>"

# Example
pnpm --filter @dolmenwood/cli start -- encounter "Encounter Type - Daytime - Road"
```

## 🛠️ Development

- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Lint:** `pnpm lint`

### Architecture

- **`packages/core`**: Pure domain logic, entities, and port interfaces.
- **`packages/data`**: Adapters for loading data (YAML).
- **`packages/cli`**: The command-line interface adapter.
