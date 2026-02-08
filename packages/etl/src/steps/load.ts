import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { CreatureSchema, Creature } from '@dolmenwood/core';
import { PATHS } from '../config.js';

export async function loadCreatures(): Promise<void> {
  console.log('Loading intermediate JSON...');

  const jsonContent = await fs.readFile(PATHS.INTERMEDIATE_JSON, 'utf-8');
  const rawData = JSON.parse(jsonContent);

  if (!Array.isArray(rawData)) {
    throw new Error(
      'Invalid intermediate data: Expected an array of creatures.',
    );
  }

  const validCreatures: Creature[] = [];
  const errors: Array<{ name: string; issues: unknown }> = [];

  for (const item of rawData) {
    const result = CreatureSchema.safeParse(item);

    if (result.success) {
      validCreatures.push(result.data);
    } else {
      errors.push({
        name: (item as any).name || 'Unknown',
        issues: result.error.errors,
      });
    }
  }

  if (errors.length > 0) {
    console.warn(
      `\n⚠️  Validation Errors (${errors.length} creatures skipped):`,
    );
    errors.forEach((e) => {
      console.warn(`- ${e.name}:`, JSON.stringify(e.issues));
    });
  }

  if (validCreatures.length === 0) {
    throw new Error('No valid creatures found to load.');
  }

  console.log(
    `\nWriting ${validCreatures.length} valid creatures to ${PATHS.CREATURES_YAML}...`,
  );

  const yamlString = yaml.dump(validCreatures, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
  });

  await fs.writeFile(PATHS.CREATURES_YAML, yamlString, 'utf-8');
  console.log('✅ Load complete.');
}
