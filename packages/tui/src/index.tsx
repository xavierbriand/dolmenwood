#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { render } from 'ink';
import {
  EncounterGenerator,
  DefaultRandomProvider,
  SessionService,
  TreasureGenerator,
} from '@dolmenwood/core';
import {
  YamlTableRepository,
  YamlCreatureRepository,
  JsonSessionRepository,
  JsonTreasureTableRepository,
} from '@dolmenwood/data';
import { App } from './App.js';
import type { HeaderSession } from './components/Header.js';
import { ServicesProvider } from './context/ServicesContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dist/index.js -> ../../../assets  (mirrors packages/cli/src/index.ts)
const ASSETS_PATH = path.resolve(__dirname, '../../../assets');
const SESSION_DIR = path.join(os.homedir(), '.dolmenwood', 'sessions');

const tableRepo = new YamlTableRepository(ASSETS_PATH);
const creatureRepo = new YamlCreatureRepository(ASSETS_PATH);
const sessionRepo = new JsonSessionRepository(SESSION_DIR);
const treasureTableRepo = new JsonTreasureTableRepository(
  path.join(ASSETS_PATH, 'treasure-tables.json'),
);
const random = new DefaultRandomProvider();
const sessionService = new SessionService(sessionRepo);

/** Entry point body — reused by `deg` (no args) once the cutover lands (Phase 5). */
export async function runTui(): Promise<void> {
  const treasureTables = await treasureTableRepo.getTreasureTables();
  const treasureGen =
    treasureTables.kind === 'success'
      ? new TreasureGenerator(treasureTables.data, random)
      : undefined;

  const generator = new EncounterGenerator(
    tableRepo,
    creatureRepo,
    random,
    treasureGen,
  );

  const latest = await sessionService.getLatestSession();
  const session: HeaderSession | null =
    latest.kind === 'success'
      ? { id: latest.data.id, partyLevel: latest.data.context.partyLevel }
      : null;

  const { waitUntilExit } = render(
    <ServicesProvider value={{ generator, sessionService, tableRepo }}>
      <App session={session} />
    </ServicesProvider>,
  );
  await waitUntilExit();
}

// Auto-run only when invoked directly (`deg-tui` / `pnpm start:tui`), not when
// imported by `@dolmenwood/cli` during the Phase 5 cutover.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runTui().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
