import { Text } from 'ink';
import type { View } from '../types.js';

/** Context-sensitive keybind hints at the bottom of the screen. */
export function StatusBar({ view }: { view: View }) {
  const hints =
    view === 'home' ? '[G]enerate   [S]essions   [Q]uit' : '[Esc] Back';
  return <Text dimColor>{hints}</Text>;
}
