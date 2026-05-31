import { Injectable, Logger } from '@nestjs/common';
import { SearchEngineBase, type SearchResult } from './search-engine.base';
import { BrowserService } from '../browser.service';

@Injectable()
export class BraveBrowserEngine extends SearchEngineBase {
  readonly id = 'brave-browser' as const;
  readonly label = 'Brave Search (Playwright stealth)';

  private readonly logger = new Logger(BraveBrowserEngine.name);

  constructor(private readonly browser: BrowserService) {
    super();
  }

  isAvailable(): boolean {
    return true;
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    this.logger.log(`Brave browser search: "${query}"`);
    return this.browser.searchBrave(query, maxResults);
  }
}
