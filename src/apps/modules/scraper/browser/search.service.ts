import { Inject, Injectable, Logger } from '@nestjs/common';
import { SearchEngineBase, type SearchResult, type SearchEngineId } from './engines/search-engine.base';

export const SEARCH_ENGINES_TOKEN = 'SEARCH_ENGINES';

export type SearchMode = 'auto' | SearchEngineId;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly engines: Map<SearchEngineId, SearchEngineBase>;

  constructor(
    @Inject(SEARCH_ENGINES_TOKEN)
    engines: SearchEngineBase[],
  ) {
    this.engines = new Map(engines.map((e) => [e.id, e]));
  }

  async search(
    query: string,
    maxResults = 10,
    mode: SearchMode = 'auto',
  ): Promise<SearchResult[]> {
    if (mode !== 'auto') {
      const engine = this.engines.get(mode);
      if (!engine) {
        this.logger.warn(`Engine "${mode}" not registered`);
        return [];
      }
      if (!engine.isAvailable()) {
        const fallbackId = mode === 'brave' ? 'brave-browser' : undefined;
        const fallback = fallbackId ? this.engines.get(fallbackId) : undefined;
        if (fallback?.isAvailable()) {
          this.logger.log(`Engine "${mode}" unavailable, falling back to "${fallbackId}"`);
          return fallback.search(query, maxResults);
        }
        this.logger.warn(`Engine "${mode}" is not available (missing config)`);
        return [];
      }
      return engine.search(query, maxResults);
    }

    // auto cascade: Brave API → Brave Browser → SearXNG → DDG browser
    const cascade: SearchEngineId[] = ['brave', 'brave-browser', 'searxng', 'ddg-browser'];
    for (const id of cascade) {
      const engine = this.engines.get(id);
      if (!engine?.isAvailable()) continue;

      const results = await engine.search(query, maxResults).catch((err: unknown) => {
        this.logger.warn(`Engine "${id}" failed: ${String(err)}`);
        return [] as SearchResult[];
      });

      if (results.length > 0) {
        this.logger.log(`Engine "${id}" returned ${results.length} results for "${query}"`);
        return results;
      }
    }

    this.logger.log(`All engines returned 0 results for "${query}"`);
    return [];
  }
}
