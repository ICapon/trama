export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export type SearchEngineId = 'brave' | 'brave-browser' | 'searxng' | 'ddg-browser';

export abstract class SearchEngineBase {
  abstract readonly id: SearchEngineId;
  abstract readonly label: string;

  /** Retorna true si el engine tiene todo lo necesario para funcionar (API key, URL, etc.) */
  abstract isAvailable(): boolean;

  abstract search(query: string, maxResults: number): Promise<SearchResult[]>;
}
