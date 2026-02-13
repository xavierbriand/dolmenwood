import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { PATHS } from '../config.js';

/**
 * Injectable dependencies for extraction — enables unit testing
 * without real Python or file system access.
 */
export interface ExtractionDeps {
  /** Verify that python3 is available on PATH. Throws if not. */
  checkPython: () => void;
  /** Check whether a file exists at the given path. */
  fileExists: (path: string) => boolean;
  /** Run a command via execFileSync with inherited stdio. */
  execScript: (command: string, args: string[]) => void;
  /** Return the size of a file in bytes. */
  getFileSize: (path: string) => number;
}

export interface ExtractionResult {
  fileCount: number;
  totalBytes: number;
}

/** Default deps that hit the real file system and child_process. */
export function createDefaultDeps(): ExtractionDeps {
  return {
    checkPython: () => {
      try {
        execFileSync('python3', ['--version'], { stdio: 'pipe' });
      } catch {
        throw new Error(
          'python3 is not available. Please install Python 3:\n' +
            '  macOS:  brew install python3\n' +
            '  Linux:  sudo apt install python3\n' +
            '  Or visit https://www.python.org/downloads/',
        );
      }
    },
    fileExists: (path: string) => fs.existsSync(path),
    execScript: (command: string, args: string[]) => {
      execFileSync(command, args, { stdio: 'inherit' });
    },
    getFileSize: (path: string) => fs.statSync(path).size,
  };
}

/** Expected output files from the DMB extractor. */
const DMB_OUTPUTS = [
  PATHS.PY_BESTIARY_JSON,
  PATHS.PY_ANIMALS_JSON,
  PATHS.PY_MORTALS_JSON,
  PATHS.PY_ADVENTURERS_JSON,
  PATHS.PY_FACTIONS_JSON,
];

/** Expected output files from the DCB treasure extractor. */
const DCB_OUTPUTS = [PATHS.PY_DCB_TREASURE_JSON];

/** All expected output files. */
const ALL_OUTPUTS = [...DMB_OUTPUTS, ...DCB_OUTPUTS];

/** Scripts to run, in order. */
const SCRIPTS = [
  {
    name: 'extract_dmb',
    script: PATHS.PY_EXTRACT_DMB,
    pdf: PATHS.DMB_PDF,
  },
  {
    name: 'extract_dcb_treasure',
    script: PATHS.PY_EXTRACT_DCB_TREASURE,
    pdf: PATHS.DCB_PDF,
  },
];

/**
 * Run the Python extraction scripts to produce JSON from source PDFs.
 *
 * 1. Checks python3 is available.
 * 2. Checks source PDFs exist.
 * 3. Runs each Python script.
 * 4. Verifies expected output files were created.
 * 5. Returns a summary of files produced.
 */
export function runExtraction(deps?: ExtractionDeps): ExtractionResult {
  const d = deps ?? createDefaultDeps();

  // 1. Check python3
  d.checkPython();

  // 2. Check source PDFs exist
  const missingPdfs = SCRIPTS.filter((s) => !d.fileExists(s.pdf)).map(
    (s) => s.pdf,
  );

  if (missingPdfs.length > 0) {
    throw new Error(
      'Source PDFs not found. Please place them at:\n' +
        missingPdfs.map((p) => `  - ${p}`).join('\n') +
        '\n\nSee README for details.',
    );
  }

  // 3. Run each script
  for (const { name, script, pdf } of SCRIPTS) {
    try {
      d.execScript('python3', [script, pdf, PATHS.EXTRACT_DIR]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${name} failed: ${message}`);
    }
  }

  // 4. Verify expected output files
  const missingOutputs = ALL_OUTPUTS.filter((p) => !d.fileExists(p));

  if (missingOutputs.length > 0) {
    throw new Error(
      'Expected output files missing after extraction:\n' +
        missingOutputs.map((p) => `  - ${p}`).join('\n'),
    );
  }

  // 5. Summarize
  const totalBytes = ALL_OUTPUTS.reduce((sum, p) => sum + d.getFileSize(p), 0);

  return {
    fileCount: ALL_OUTPUTS.length,
    totalBytes,
  };
}
