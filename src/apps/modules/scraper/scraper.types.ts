import type { TramaProviderSeed } from '../../../libs/providers';

export interface ScrapeJobPayload {
  scrapeJobId: string;
  entityId: string;
  entityType: string;
  investigationId: string;
  source: string;
  seed: TramaProviderSeed;
  config?: Record<string, unknown>;
}

export interface ScheduledScrapePayload {
  cronJobId: string;
  entityId: string;
  entityType: string;
  investigationId: string;
  source: string;
  seed: TramaProviderSeed;
  config?: Record<string, unknown>;
}
