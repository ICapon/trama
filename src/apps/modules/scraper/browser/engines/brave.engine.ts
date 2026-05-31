import { Injectable, Logger } from '@nestjs/common';
import { SearchEngineBase, type SearchResult } from './search-engine.base';

interface BraveWebResult {
  url: string;
  title: string;
  description?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

@Injectable()
export class BraveEngine extends SearchEngineBase {
  readonly id = 'brave' as const;
  readonly label = 'Brave Search API';

  private readonly logger = new Logger(BraveEngine.name);
  private readonly apiKey = process.env.BRAVE_API_KEY;

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.apiKey) return [];

    const params = new URLSearchParams({ q: query, count: String(maxResults) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!res.ok) {
      this.logger.warn(`Brave respondió ${res.status} para "${query}"`);
      return [];
    }

    const data: BraveResponse = await res.json();
    return (data.web?.results ?? [])
      .filter((r) => r.url?.startsWith('http'))
      .map((r) => ({ url: r.url, title: r.title ?? r.url, snippet: r.description ?? '' }));
  }
}
