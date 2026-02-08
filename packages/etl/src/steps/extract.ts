import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PATHS } from '../config.js';

const require = createRequire(import.meta.url);

export async function extractText(
  pdfPath: string = PATHS.PDF_SOURCE,
): Promise<string> {
  console.log(`Reading PDF from: ${pdfPath}`);

  // Use require for pdf-parse as it is a CommonJS module that behaves oddly with ESM import
  const pdf = require('pdf-parse');

  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);

    // Basic cleanup: normalize line endings
    const text = data.text;

    console.log(`Successfully extracted ${text.length} characters.`);
    return text;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `PDF Source file not found at: ${pdfPath}. Please place the DMB PDF there.`,
      );
    }
    throw error;
  }
}
