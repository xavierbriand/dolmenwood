import { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { ConfirmInput, Select, StatusMessage } from '@inkjs/ui';
import type { GenerationContext } from '@dolmenwood/core';
import { useServices } from '../context/ServicesContext.js';
import {
  useEncounterForm,
  type Terrain,
  type TimeOfDay,
} from '../hooks/useEncounterForm.js';

type Step = 'region' | 'time' | 'terrain' | 'camping';

type Option = { label: string; value: string };

const TIME_OPTIONS: Option[] = [
  { label: 'Day', value: 'Day' },
  { label: 'Night', value: 'Night' },
];

const TERRAIN_OPTIONS: Option[] = [
  { label: 'Off-road', value: 'Off-road' },
  { label: 'Road', value: 'Road' },
];

export interface EncounterFormProps {
  onSubmit: (context: GenerationContext) => void;
  onCancel: () => void;
}

const REGION_PREFIX = 'Regional - ';

/**
 * Multi-step encounter parameter form: region -> time -> terrain -> (camping,
 * only at Night). Replaces the four sequential Inquirer prompts in
 * `InteractiveService.handleEncounter`.
 */
export function EncounterForm({ onSubmit, onCancel }: EncounterFormProps) {
  const { tableRepo } = useServices();
  const form = useEncounterForm();
  const { isRawModeSupported } = useStdin();

  const [step, setStep] = useState<Step>('region');
  const [regions, setRegions] = useState<Option[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void tableRepo.listTables().then((res) => {
      if (cancelled) return;
      if (res.kind === 'failure') {
        setLoadFailed(true);
        return;
      }
      setRegions(
        res.data
          .filter((t) => t.name.startsWith(REGION_PREFIX))
          .map((t) => {
            const name = t.name.slice(REGION_PREFIX.length);
            return { label: name, value: name.toLowerCase() };
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tableRepo]);

  useInput(
    (_input, key) => {
      if (key.escape) onCancel();
    },
    { isActive: Boolean(isRawModeSupported) },
  );

  if (loadFailed) {
    return <StatusMessage variant="error">Failed to load regions.</StatusMessage>;
  }
  if (!regions) {
    return <Text dimColor>Loading regions…</Text>;
  }
  if (regions.length === 0) {
    return (
      <StatusMessage variant="warning">
        No regions available — run the ETL import first.
      </StatusMessage>
    );
  }

  const chooseRegion = (value: string) => {
    form.setRegion(value);
    setStep('time');
  };

  const chooseTime = (value: string) => {
    const time = value as TimeOfDay;
    form.setTimeOfDay(time);
    setStep('terrain');
  };

  const chooseTerrain = (value: string) => {
    const terrain = value as Terrain;
    form.setTerrain(terrain);
    if (form.timeOfDay === 'Night') {
      setStep('camping');
      return;
    }
    onSubmit({
      regionId: form.regionId as string,
      timeOfDay: form.timeOfDay,
      terrain,
      camping: false,
    });
  };

  const chooseCamping = (camping: boolean) => {
    form.setCamping(camping);
    onSubmit({
      regionId: form.regionId as string,
      timeOfDay: 'Night',
      terrain: form.terrain,
      camping,
    });
  };

  return (
    <Box flexDirection="column">
      {step === 'region' && (
        <>
          <Text>Select region</Text>
          <Select options={regions} onChange={chooseRegion} />
        </>
      )}

      {step === 'time' && (
        <>
          <Text>Time of day</Text>
          <Select options={TIME_OPTIONS} onChange={chooseTime} />
        </>
      )}

      {step === 'terrain' && (
        <>
          <Text>Terrain</Text>
          <Select options={TERRAIN_OPTIONS} onChange={chooseTerrain} />
        </>
      )}

      {step === 'camping' && (
        <Box>
          <Text>Is the party camping? </Text>
          <ConfirmInput
            defaultChoice="cancel"
            onConfirm={() => chooseCamping(true)}
            onCancel={() => chooseCamping(false)}
          />
        </Box>
      )}
    </Box>
  );
}
