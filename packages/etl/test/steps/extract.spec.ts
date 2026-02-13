import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runExtraction, type ExtractionDeps } from '../../src/steps/extract.js';
import { PATHS } from '../../src/config.js';

function makeDeps(overrides: Partial<ExtractionDeps> = {}): ExtractionDeps {
  return {
    checkPython: vi.fn(),
    fileExists: vi.fn().mockReturnValue(true),
    execScript: vi.fn(),
    getFileSize: vi.fn().mockReturnValue(1024),
    ...overrides,
  };
}

describe('runExtraction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('given python3 is not available', () => {
    it('then it throws with install instructions', () => {
      const deps = makeDeps({
        checkPython: vi.fn(() => {
          throw new Error('python3 not found');
        }),
      });

      expect(() => runExtraction(deps)).toThrow(/python3/i);
      expect(deps.execScript).not.toHaveBeenCalled();
    });
  });

  describe('given DMB PDF is missing', () => {
    it('then it throws listing the expected path', () => {
      const deps = makeDeps({
        fileExists: vi.fn((p: string) => !p.endsWith('DMB.pdf')),
      });

      expect(() => runExtraction(deps)).toThrow(/DMB\.pdf/);
      expect(deps.execScript).not.toHaveBeenCalled();
    });
  });

  describe('given DCB PDF is missing', () => {
    it('then it throws listing the expected path', () => {
      const deps = makeDeps({
        fileExists: vi.fn((p: string) => !p.endsWith('DCB.pdf')),
      });

      expect(() => runExtraction(deps)).toThrow(/DCB\.pdf/);
      expect(deps.execScript).not.toHaveBeenCalled();
    });
  });

  describe('given both PDFs are missing', () => {
    it('then it throws listing both expected paths', () => {
      const deps = makeDeps({
        fileExists: vi.fn().mockReturnValue(false),
      });

      expect(() => runExtraction(deps)).toThrow(/DMB\.pdf/);
      expect(() => runExtraction(deps)).toThrow(/DCB\.pdf/);
      expect(deps.execScript).not.toHaveBeenCalled();
    });
  });

  describe('given all prerequisites are met', () => {
    it('then it runs extract_dmb.py with correct args', () => {
      const deps = makeDeps();

      runExtraction(deps);

      expect(deps.execScript).toHaveBeenCalledWith('python3', [
        PATHS.PY_EXTRACT_DMB,
        PATHS.DMB_PDF,
        PATHS.TMP_DIR,
      ]);
    });

    it('then it runs extract_dcb_treasure.py with correct args', () => {
      const deps = makeDeps();

      runExtraction(deps);

      expect(deps.execScript).toHaveBeenCalledWith('python3', [
        PATHS.PY_EXTRACT_DCB_TREASURE,
        PATHS.DCB_PDF,
        PATHS.TMP_DIR,
      ]);
    });

    it('then it runs DMB extraction before DCB extraction', () => {
      const callOrder: string[] = [];
      const deps = makeDeps({
        execScript: vi.fn((_, args: string[]) => {
          const script = args[0] ?? '';
          if (script.includes('extract_dmb')) callOrder.push('dmb');
          if (script.includes('extract_dcb')) callOrder.push('dcb');
        }),
      });

      runExtraction(deps);

      expect(callOrder).toEqual(['dmb', 'dcb']);
    });

    it('then it returns a summary with file count and total size', () => {
      const deps = makeDeps({
        getFileSize: vi.fn().mockReturnValue(2048),
      });

      const result = runExtraction(deps);

      expect(result.fileCount).toBeGreaterThan(0);
      expect(result.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('given extract_dmb.py fails', () => {
    it('then it propagates the error', () => {
      const deps = makeDeps({
        execScript: vi.fn((_, args: string[]) => {
          const script = args[0] ?? '';
          if (script.includes('extract_dmb')) {
            throw new Error('Script exited with code 1');
          }
        }),
      });

      expect(() => runExtraction(deps)).toThrow(/extract_dmb/i);
    });
  });

  describe('given extract_dcb_treasure.py fails', () => {
    it('then it propagates the error', () => {
      const deps = makeDeps({
        execScript: vi.fn((_, args: string[]) => {
          const script = args[0] ?? '';
          if (script.includes('extract_dcb')) {
            throw new Error('Script exited with code 1');
          }
        }),
      });

      expect(() => runExtraction(deps)).toThrow(/extract_dcb/i);
    });
  });

  describe('post-extraction output verification', () => {
    it('then it checks that expected output files exist', () => {
      const deps = makeDeps();

      runExtraction(deps);

      // After extraction, fileExists should be called for output files
      const fileExistsCalls = (
        deps.fileExists as ReturnType<typeof vi.fn>
      ).mock.calls.map((call) => call[0] as string);

      // Should check for the DMB output files
      expect(fileExistsCalls).toContainEqual(PATHS.PY_BESTIARY_JSON);
      expect(fileExistsCalls).toContainEqual(PATHS.PY_DCB_TREASURE_JSON);
    });

    it('then it throws when expected output files are missing after extraction', () => {
      let extractionDone = false;
      const deps = makeDeps({
        execScript: vi.fn(() => {
          extractionDone = true;
        }),
        fileExists: vi.fn((p: string) => {
          // PDFs exist (pre-extraction check)
          if (p.endsWith('.pdf') || p.endsWith('.PDF')) return true;
          // After extraction, output files are missing
          if (extractionDone && p.endsWith('.json')) return false;
          return true;
        }),
      });

      expect(() => runExtraction(deps)).toThrow(/output/i);
    });
  });
});
