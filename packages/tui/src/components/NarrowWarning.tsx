import { Text, useStdout } from 'ink';

export const MIN_COLUMNS = 80;

/**
 * Non-blocking hint shown only when the terminal is narrower than
 * {@link MIN_COLUMNS}. Ink's layout still wraps; this just sets expectations.
 */
export function NarrowWarning() {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? MIN_COLUMNS;

  if (columns >= MIN_COLUMNS) {
    return null;
  }

  return (
    <Text dimColor>
      Terminal is narrow ({columns} cols) — resize to ≥ {MIN_COLUMNS} columns for
      the best layout.
    </Text>
  );
}
