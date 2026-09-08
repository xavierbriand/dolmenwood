import { Text } from 'ink';
import type { View } from '../types.js';

/** Context-sensitive keybind hints at the bottom of the screen. */
export function StatusBar({ view }: { view: View }) {
  let hints: string;
  switch (view) {
    case 'home':
      hints = '[G]enerate   [S]essions   [Q]uit';
      break;
    case 'encounter-result':
      hints = '[G] Reroll   [Enter] New encounter   [Esc] Home';
      break;
    default:
      hints = '[Esc] Back';
  }
  return <Text dimColor>{hints}</Text>;
}
