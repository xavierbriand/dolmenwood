import { Box, Text } from 'ink';
import { Badge, Spinner, StatusMessage } from '@inkjs/ui';
import type { Creature, Encounter, RolledTreasure } from '@dolmenwood/core';

export interface EncounterResultProps {
  encounter: Encounter | null;
  loading: boolean;
  error: string | null;
  /** Shows a "Saved" badge — set when the encounter was auto-saved to a session. */
  saved?: boolean;
}

/** yellow when the players are surprised, magenta when both sides are. */
export function surpriseColor(surprise: string): string | undefined {
  if (surprise.includes('Both')) return 'magenta';
  if (surprise.includes('Players surprised')) return 'yellow';
  return undefined;
}

function coinLine(coins: RolledTreasure['coins']): string | null {
  const parts: string[] = [];
  if (coins.copper) parts.push(`${coins.copper} cp`);
  if (coins.silver) parts.push(`${coins.silver} sp`);
  if (coins.gold) parts.push(`${coins.gold} gp`);
  if (coins.pellucidium) parts.push(`${coins.pellucidium} pp`);
  return parts.length > 0 ? parts.join(', ') : null;
}

function CreatureBlock({ creature }: { creature: Creature }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="cyan">
        {creature.name}
      </Text>
      <Text>
        <Text dimColor>AC </Text>
        {creature.armourClass}
        <Text dimColor> HD </Text>
        {creature.hitDice}
        <Text dimColor> MV </Text>
        {creature.movement}
        <Text dimColor> Morale </Text>
        {creature.morale}
      </Text>
      {creature.attacks.length > 0 && (
        <Text>
          <Text dimColor>Attacks: </Text>
          {creature.attacks.join(', ')}
        </Text>
      )}
      <Text>
        <Text dimColor>Align </Text>
        {creature.alignment}
        <Text dimColor> Level </Text>
        {creature.level}
        <Text dimColor> XP </Text>
        {creature.xp}
      </Text>
      {creature.description && <Text italic>{creature.description}</Text>}
    </Box>
  );
}

function TreasureBlock({ treasure }: { treasure: RolledTreasure }) {
  const coins = coinLine(treasure.coins);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>── Treasure ──</Text>
      {coins && (
        <Text>
          <Text dimColor>Coins: </Text>
          {coins}
        </Text>
      )}
      {treasure.gems.length > 0 && (
        <Text>
          <Text dimColor>Gems: </Text>
          {treasure.gems.map((g) => `${g.type} (${g.value}gp)`).join(', ')}
        </Text>
      )}
      {treasure.artObjects.length > 0 && (
        <Text>
          <Text dimColor>Art: </Text>
          {treasure.artObjects
            .map(
              (a) =>
                `${[a.material, a.type].filter(Boolean).join(' ')} (${a.value}gp)`,
            )
            .join(', ')}
        </Text>
      )}
      {treasure.magicItems.length > 0 && (
        <Text>
          <Text dimColor>Magic: </Text>
          {treasure.magicItems.map((m) => m.name).join(', ')}
        </Text>
      )}
      <Text>
        <Text dimColor>Total Value: </Text>
        {treasure.totalValue} gp
      </Text>
    </Box>
  );
}

/**
 * The single encounter renderer — supersedes both the inline block in
 * `packages/cli/src/index.ts` and `InteractiveService.printEncounter()`.
 */
export function EncounterResult({
  encounter,
  loading,
  error,
  saved = false,
}: EncounterResultProps) {
  if (loading) {
    return <Spinner label="Rolling…" />;
  }
  if (error) {
    return <StatusMessage variant="error">{error}</StatusMessage>;
  }
  if (!encounter) {
    return <Text dimColor>No encounter yet.</Text>;
  }

  const d = encounter.details;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box>
        <Text bold>{encounter.summary}</Text>
        {saved && (
          <Box marginLeft={1}>
            <Badge color="green">Saved</Badge>
          </Box>
        )}
      </Box>

      <Text>
        <Text dimColor>Type: </Text>
        {encounter.type}
        {d.isLair !== undefined &&
          (d.isLair ? (
            <Text bold color="magenta">
              {'  [In Lair]'}
            </Text>
          ) : (
            <Text dimColor>{'  [Wandering]'}</Text>
          ))}
      </Text>

      {d.distance && (
        <Text>
          <Text dimColor>Distance: </Text>
          {d.distance}
        </Text>
      )}
      {d.surprise && (
        <Text>
          <Text dimColor>Surprise: </Text>
          <Text color={surpriseColor(d.surprise)}>{d.surprise}</Text>
        </Text>
      )}
      {d.activity && (
        <Text>
          <Text dimColor>Activity: </Text>
          {d.activity}
        </Text>
      )}
      {d.reaction && (
        <Text>
          <Text dimColor>Reaction: </Text>
          {d.reaction}
        </Text>
      )}

      {d.creature && <CreatureBlock creature={d.creature} />}
      {d.treasure && <TreasureBlock treasure={d.treasure} />}

      {d.possessions && (
        <Box marginTop={1}>
          <Text>
            <Text dimColor>Possessions: </Text>
            {d.possessions}
          </Text>
        </Box>
      )}
    </Box>
  );
}
