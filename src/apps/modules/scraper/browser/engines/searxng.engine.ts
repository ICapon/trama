import { Injectable, Logger } from '@nestjs/common';
import { SearchEngineBase, type SearchResult } from './search-engine.base';

interface SearxResult {
  url: string;
  title?: string;
  content?: string;
}

interface SearxResponse {
  results?: SearxResult[];
}

@Injectable()
export class SearxngEngine extends SearchEngineBase {
  readonly id = 'searxng' as const;
  readonly label = 'SearXNG';

  private readonly logger = new Logger(SearxngEngine.name);
  private readonly baseUrl = process.env.SEARXNG_URL?.replace(/\/$/, '');

  isAvailable(): boolean {
    return !!this.baseUrl;
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.baseUrl) return [];

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      categories: 'general',
      pageno: '1',
    });

    const res = await fetch(`${this.baseUrl}/search?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      this.logger.warn(`SearXNG respondió ${res.status} para "${query}"`);
      return [];
    }

    const data: SearxResponse = await res.json();
    return (data.results ?? [])
      .slice(0, maxResults)
      .filter((r) => r.url?.startsWith('http'))
      .map((r) => ({ url: r.url, title: r.title ?? r.url, snippet: r.content ?? '' }));
  }
}
