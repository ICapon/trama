import { Injectable, Logger } from '@nestjs/common';
import { SearchEngineBase, type SearchResult } from './search-engine.base';
import { BrowserService } from '../browser.service';

@Injectable()
export class DdgBrowserEngine extends SearchEngineBase {
  readonly id = 'ddg-browser' as const;
  readonly label = 'DuckDuckGo (Playwright stealth)';

  private readonly logger = new Logger(DdgBrowserEngine.name);

  constructor(private readonly browser: BrowserService) {
    super();
  }

  isAvailable(): boolean {
    return true;
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    this.logger.log(`DDG browser search: "${query}"`);
    return this.browser.search(query, maxResults);
  }
}
