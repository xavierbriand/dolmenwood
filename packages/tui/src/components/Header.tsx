import { Box, Text } from 'ink';
import { Badge } from '@inkjs/ui';

export interface HeaderSession {
  id: string;
  partyLevel: number;
}

/** App title plus an optional active-session badge. */
export function Header({ session }: { session?: HeaderSession | null }) {
  return (
    <Box>
      <Text bold color="green">
        🌲 Dolmenwood Encounter Generator
      </Text>
      {session ? (
        <Box marginLeft={1}>
          <Badge color="green">{`L${session.partyLevel}`}</Badge>
          <Text dimColor> {session.id.slice(0, 8)}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
