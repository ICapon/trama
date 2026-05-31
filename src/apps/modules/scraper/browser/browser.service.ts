import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium as chromiumExtra } from 'playwright-extra';
import type { Browser, BrowserContext, Page } from 'playwright';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromiumExtra.use(StealthPlugin());

export interface BrowserSearchResult {
  url: string;
  title: string;
  snippet: string;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);

  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;

  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private braveContext: BrowserContext | null = null;
  private bravePage: Page | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (
      chromiumExtra.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      }) as unknown as Promise<Browser>
    ).then((b) => {
      this.browser = b;
      this.launchPromise = null;
      this.logger.log('Chromium iniciado');
      return b;
    });

    return this.launchPromise;
  }

  private async getPage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;

    const browser = await this.getBrowser();

    this.context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    this.page = await this.context.newPage();

    // Bloquear imágenes y fuentes — no afectan el DOM de resultados
    await this.page.route(
      '**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}',
      (r) => r.abort(),
    );

    return this.page;
  }

  async onModuleDestroy() {
    await this.context?.close().catch(() => undefined);
    await this.braveContext?.close().catch(() => undefined);
    if (this.browser?.isConnected()) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Browser cerrado');
    }
  }

  private async getBravePage(): Promise<Page> {
    if (this.bravePage && !this.bravePage.isClosed()) return this.bravePage;

    const browser = await this.getBrowser();

    this.braveContext = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });

    this.bravePage = await this.braveContext.newPage();
    await this.bravePage.route(
      '**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}',
      (r) => r.abort(),
    );

    return this.bravePage;
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async search(query: string, maxResults = 10): Promise<BrowserSearchResult[]> {
    try {
      const page = await this.getPage();
      return await this.searchDdg(page, query, maxResults);
    } catch (err) {
      this.logger.error(`Browser search falló para "${query}": ${String(err)}`);
      this.page = null;
      return [];
    }
  }

  async searchBrave(query: string, maxResults = 10): Promise<BrowserSearchResult[]> {
    try {
      const page = await this.getBravePage();
      return await this.doSearchBrave(page, query, maxResults);
    } catch (err) {
      this.logger.error(`Brave browser search falló para "${query}": ${String(err)}`);
      this.bravePage = null;
      return [];
    }
  }

  // ── DuckDuckGo ─────────────────────────────────────────────────────────────
  // Va directo a la URL de búsqueda (más rápido que homepage + form).
  // Usa waitForSelector con .catch para manejar páginas sin resultados
  // sin bloquear el proceso completo del timeout.

  private async searchDdg(
    page: Page,
    query: string,
    maxResults: number,
  ): Promise<BrowserSearchResult[]> {
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const hasResults = await page
      .waitForSelector('[data-testid="result"]', { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      this.logger.log(`DDG: sin resultados para "${query}"`);
      return [];
    }

    return page.evaluate(
      ({ max }) =>
        Array.from(document.querySelectorAll('[data-testid="result"]'))
          .slice(0, max)
          .map((el) => {
            const a = el.querySelector(
              '[data-testid="result-title-a"]',
            ) as HTMLAnchorElement | null;
            const snip = el.querySelector('[data-result="snippet"]');
            return {
              url: a?.href ?? '',
              title: a?.textContent?.trim() ?? '',
              snippet: snip?.textContent?.trim() ?? '',
            };
          })
          .filter((r) => r.url.startsWith('http')),
      { max: maxResults },
    );
  }

  // ── Brave Search ───────────────────────────────────────────────────────────

  private async doSearchBrave(
    page: Page,
    query: string,
    maxResults: number,
  ): Promise<BrowserSearchResult[]> {
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const hasResults = await page
      .waitForSelector('.snippet', { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      this.logger.log(`Brave: sin resultados para "${query}"`);
      return [];
    }

    return page.evaluate(
      ({ max }) =>
        Array.from(document.querySelectorAll('.snippet'))
          .slice(0, max)
          .map((el) => {
            const a = el.querySelector('a.result-header') as HTMLAnchorElement | null;
            const snip = el.querySelector('.snippet-description');
            return {
              url: a?.href ?? '',
              title: a?.querySelector('.title')?.textContent?.trim() ?? a?.textContent?.trim() ?? '',
              snippet: snip?.textContent?.trim() ?? '',
            };
          })
          .filter((r) => r.url.startsWith('http')),
      { max: maxResults },
    );
  }
}
