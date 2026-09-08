import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type { RegionTable } from '@dolmenwood/core';
import { EncounterForm } from '../../src/components/EncounterForm.js';
import {
  ServicesProvider,
  type Services,
} from '../../src/context/ServicesContext.js';

const ENTER = '\r';
const DOWN = '\x1B[B';
const ESC = '\x1B';
const tick = () => new Promise((r) => setTimeout(r, 25));

function regionTables(names: string[]): RegionTable[] {
  return names.map((name) => ({ name })) as unknown as RegionTable[];
}

function renderForm(
  overrides: Partial<Services> = {},
  props: Partial<React.ComponentProps<typeof EncounterForm>> = {},
) {
  const tableRepo = {
    listTables: vi.fn().mockResolvedValue({
      kind: 'success',
      data: regionTables([
        'Regional - Hexwood',
        'Regional - Dolmen Moor',
        'Regional - Aldwood',
        'Settlement - Prigwort', // filtered out
      ]),
    }),
    getTable: vi.fn(),
  };
  const services = {
    generator: {} as Services['generator'],
    sessionService: {} as Services['sessionService'],
    tableRepo: tableRepo as unknown as Services['tableRepo'],
    ...overrides,
  };
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const result = render(
    <ServicesProvider value={services}>
      <EncounterForm onSubmit={onSubmit} onCancel={onCancel} {...props} />
    </ServicesProvider>,
  );
  return { ...result, onSubmit, onCancel, tableRepo };
}

describe('<EncounterForm>', () => {
  it('lists only "Regional - " tables, de-prefixed and sorted', async () => {
    const { lastFrame } = renderForm();
    await tick();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Select region');
    expect(frame).toContain('Aldwood');
    expect(frame).toContain('Dolmen Moor');
    expect(frame).toContain('Hexwood');
    expect(frame).not.toContain('Prigwort');
    // sorted: Aldwood before Hexwood
    expect(frame.indexOf('Aldwood')).toBeLessThan(frame.indexOf('Hexwood'));
  });

  it('walks region -> time -> terrain and submits a Day context', async () => {
    const { stdin, lastFrame, onSubmit } = renderForm();
    await tick();

    stdin.write(ENTER); // region: Aldwood (first, sorted)
    await tick();
    expect(lastFrame()).toContain('Time of day');

    stdin.write(ENTER); // time: Day (first)
    await tick();
    expect(lastFrame()).toContain('Terrain');

    stdin.write(ENTER); // terrain: Off-road (first)
    await tick();

    expect(onSubmit).toHaveBeenCalledWith({
      regionId: 'aldwood',
      timeOfDay: 'Day',
      terrain: 'Off-road',
      camping: false,
    });
  });

  it('inserts the camping step at Night and submits camping=true', async () => {
    const { stdin, lastFrame, onSubmit } = renderForm();
    await tick();

    stdin.write(ENTER); // region: Aldwood
    await tick();
    stdin.write(DOWN); // time: move to Night
    stdin.write(ENTER);
    await tick();
    stdin.write(ENTER); // terrain: Off-road
    await tick();

    expect(lastFrame()).toContain('Is the party camping?');
    expect(onSubmit).not.toHaveBeenCalled();

    stdin.write('y'); // confirm camping
    await tick();

    expect(onSubmit).toHaveBeenCalledWith({
      regionId: 'aldwood',
      timeOfDay: 'Night',
      terrain: 'Off-road',
      camping: true,
    });
  });

  it('Enter on the camping step takes the default (not camping)', async () => {
    const { stdin, onSubmit } = renderForm();
    await tick();
    stdin.write(ENTER); // region
    await tick();
    stdin.write(DOWN);
    stdin.write(ENTER); // time: Night
    await tick();
    stdin.write(ENTER); // terrain
    await tick();
    stdin.write(ENTER); // camping: default choice "cancel" => false
    await tick();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ timeOfDay: 'Night', camping: false }),
    );
  });

  it('calls onCancel on Esc', async () => {
    const { stdin, onCancel } = renderForm();
    await tick();
    stdin.write(ESC);
    await tick();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows an error when the region list fails to load', async () => {
    const tableRepo = {
      listTables: vi
        .fn()
        .mockResolvedValue({ kind: 'failure', error: new Error('boom') }),
      getTable: vi.fn(),
    } as unknown as Services['tableRepo'];
    const { lastFrame } = renderForm({ tableRepo });
    await tick();
    expect(lastFrame()).toContain('Failed to load regions');
  });
});
