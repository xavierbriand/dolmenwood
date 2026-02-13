import { TreasureTablesSchema } from '@dolmenwood/core';
import { PATHS } from '../config.js';

export interface LoadTreasureDeps {
  readFile: (path: string, encoding: string) => Promise<string>;
  writeFile: (path: string, content: string, encoding: string) => Promise<void>;
}

const defaultDeps: LoadTreasureDeps = {
  readFile: (await import('node:fs/promises')).readFile as (
    path: string,
    encoding: string,
  ) => Promise<string>,
  writeFile: (await import('node:fs/promises')).writeFile as (
    path: string,
    content: string,
    encoding: string,
  ) => Promise<void>,
};

export async function loadTreasureTables(
  deps: LoadTreasureDeps = defaultDeps,
): Promise<void> {
  console.log('Loading treasure tables...');

  let raw: string;
  try {
    raw = await deps.readFile(PATHS.PY_DCB_TREASURE_JSON, 'utf-8');
  } catch (error: unknown) {
    const isEnoent =
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (isEnoent) {
      throw new Error(
        `Treasure table extract not found: ${PATHS.PY_DCB_TREASURE_JSON}\n` +
          'Run the extract step first: pnpm --filter @dolmenwood/etl start extract',
      );
    }
    throw error;
  }

  const parsed: unknown = JSON.parse(raw);

  const result = TreasureTablesSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Treasure table validation errors:', result.error.format());
    throw new Error('Treasure table validation failed.');
  }

  const output = JSON.stringify(result.data, null, 2);
  await deps.writeFile(PATHS.TREASURE_TABLES_JSON, output, 'utf-8');

  console.log(`✅ Loaded treasure tables to ${PATHS.TREASURE_TABLES_JSON}`);
}
