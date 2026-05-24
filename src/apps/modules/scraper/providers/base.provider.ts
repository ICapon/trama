import type { ScrapeSeedData, ScrapeProviderResult } from '../scraper.types';

export abstract class BaseScraperProvider {
  abstract readonly source: string;
  abstract readonly description: string;
  abstract canHandle(seed: ScrapeSeedData): boolean;
  abstract execute(personId: string, seed: ScrapeSeedData): Promise<ScrapeProviderResult>;
}
