import { createContext, useContext } from 'react';
import type {
  EncounterGenerator,
  SessionService,
  TableRepository,
} from '@dolmenwood/core';

/**
 * Core services injected at the entry point (`src/index.tsx`) and consumed by
 * hooks/components via {@link useServices}. Keeping this behind a context keeps
 * every component rendering-only and trivially mockable in tests.
 */
export interface Services {
  generator: EncounterGenerator;
  sessionService: SessionService;
  tableRepo: TableRepository;
}

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ServicesContext.Provider;

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) {
    throw new Error('useServices must be used within a <ServicesProvider>');
  }
  return ctx;
}
