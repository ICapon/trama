import type { TramaProviderSeed } from '../../../libs/providers';

export interface ScrapeJobPayload {
  scrapeJobId: string;
  personId: string;
  source: string;
  seed: TramaProviderSeed;
}
