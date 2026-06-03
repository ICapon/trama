import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import { BrowserService } from '../../browser/browser.service';
import { ScrapeStepLogService } from '../../scrape-step-log.service';
import { ScrapeStepType } from '../../scrape-step-log.entity';
import type {
  Cookie,
  XPlaywrightFollowEntry,
  XPlaywrightOptions,
  XPlaywrightProfile,
  XPlaywrightRawData,
  XPlaywrightTweet,
  XPlaywrightTweetEntities,
} from './x-playwright.types';

const SOURCE = 'x-playwright';

@Injectable()
export class XPlaywrightScraper {
  private readonly logger = new Logger(XPlaywrightScraper.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly stepLog: ScrapeStepLogService,
  ) {}

  async scrape(username: string, options: XPlaywrightOptions): Promise<XPlaywrightRawData> {
    const context = await this.browserService.newIsolatedContext({
      cookies: options.cookies,
      proxyUrl: options.proxyUrl,
    });
    const { entityId } = options;

    try {
      const page = await context.newPage();

      // ── Paso 1: navegar a /followers ──────────────────────────────────────
      // /followers llama UserByScreenName + UserTweets (mejor perfil) y Followers si autenticado
      const profileCaptures: Promise<{ url: string; data: unknown } | null>[] = [];
      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/graphql/') && response.status() === 200) {
          profileCaptures.push(response.json().then((data) => ({ url, data })).catch(() => null));
        }
      });

      const navStart = Date.now();
      await page.goto(`https://x.com/${username}/followers`, { waitUntil: 'networkidle', timeout: 8_000 })
        .catch(() => {});
      const navDuration = Date.now() - navStart;

      // En modo autenticado, networkidle puede disparar rápido (2-3s) antes de que
      // lleguen las API calls. Extra buffer para capturar las respuestas tardías.
      if (navDuration < 5_000) {
        await new Promise((r) => setTimeout(r, 4_000));
      }

      const captured = (await Promise.all(profileCaptures)).filter(
        (c): c is { url: string; data: unknown } => c !== null,
      );

      this.logger.debug(`@${username}: navDuration=${navDuration}ms | endpoints=[${captured.map((c) => this.endpointName(c.url)).join(',')}]`);

      void this.stepLog.log({
        providerSource: SOURCE, entityId,
        stepType: ScrapeStepType.NAVIGATE,
        url: `https://x.com/${username}/followers`,
        durationMs: navDuration, success: true,
        extractedData: { navigate: { finalUrl: page.url(), capturedEndpoints: captured.map((c) => this.endpointName(c.url)) } },
      });

      // ── Paso 2: perfil ────────────────────────────────────────────────────
      // En modo autenticado X puede usar endpoints distintos — buscamos por nombre parcial
      const profileByName  = captured.find((c) => c.url.includes('UserByScreenName'));
      const tweetEntry     = captured.find((c) => c.url.includes('UserTweets'));
      const followersEntry = captured.find((c) => c.url.includes('Followers') && !c.url.includes('UserByScreenName'));

      let profile = profileByName ? this.parseProfile(profileByName.data)
                  : tweetEntry    ? this.parseProfile(tweetEntry.data)
                  : null;
      const profileApiUrl = profileByName?.url ?? tweetEntry?.url ?? null;

      if (profile) {
        void this.stepLog.log({
          providerSource: SOURCE, entityId,
          stepType: ScrapeStepType.API_CAPTURE,
          url: profileApiUrl, httpStatus: 200, success: true,
          extractedData: this.profileSummary(profile, profileByName ? 'UserByScreenName' : 'UserTweets'),
        });
      } else {
        this.logger.debug(`@${username}: API no dio perfil, intentando DOM`);
        const domStart = Date.now();
        profile = await this.scrapeProfileFromDom(page, username);
        void this.stepLog.log({
          providerSource: SOURCE, entityId,
          stepType: ScrapeStepType.DOM_SCRAPE,
          url: page.url(), durationMs: Date.now() - domStart,
          success: !!profile,
          extractedData: profile ? this.profileSummary(profile, 'dom') : null,
          errorMessage: profile ? null : 'No se encontró [data-testid="UserName"] en el DOM',
        });
      }

      if (!profile) {
        throw new Error(`No se pudo obtener el perfil de @${username}. Puede ser privado o requerir autenticación.`);
      }

      // Fallback de seguridad: si el screen_name viene vacío del API pero tenemos el username
      // del seed, lo usamos directamente para que el nodo quede bien formado.
      if (!profile.screen_name) {
        this.logger.warn(`@${username}: screen_name vacío en perfil parseado, usando username del seed`);
        profile = { ...profile, screen_name: username };
      }

      // ── Paso 3: tweets ────────────────────────────────────────────────────
      // En modo autenticado, /followers no llama UserTweets — navegamos al perfil principal
      let tweetsSourceUrl = tweetEntry?.url ?? null;
      let tweets = tweetEntry ? this.parseTweets(tweetEntry.data) : [];

      if (!tweetEntry) {
        this.logger.debug(`@${username}: UserTweets no capturado en /followers, navegando al perfil principal...`);
        const tweetsData = await this.captureGraphQL(page, `https://x.com/${username}`, 'UserTweets');
        if (tweetsData) {
          tweets = this.parseTweets(tweetsData);
          tweetsSourceUrl = `https://x.com/${username}`;
        }
      }

      if (tweets.length > 0 || tweetsSourceUrl) {
        const hashtags   = [...new Set(tweets.flatMap((t) => t.entities.hashtags.map((h) => `#${h.text}`)))];
        const mentions   = [...new Set(tweets.flatMap((t) => t.entities.user_mentions.map((m) => `@${m.screen_name}`)))];
        const mediaCount = tweets.reduce((n, t) => n + (t.entities.media?.length ?? 0), 0);
        void this.stepLog.log({
          providerSource: SOURCE, entityId,
          stepType: ScrapeStepType.API_CAPTURE,
          url: tweetsSourceUrl, httpStatus: 200, success: true,
          extractedData: {
            items: { count: tweets.length, samples: hashtags.slice(0, 5) },
            tags: [...hashtags.slice(0, 20), ...mentions.slice(0, 10)],
            metrics: { tweetCount: tweets.length, mediaCount, hashtagCount: hashtags.length, mentionCount: mentions.length },
          },
        });
      }

      // ── Paso 4: followers ─────────────────────────────────────────────────
      const followStart = Date.now();
      const followers = followersEntry
        ? this.parseUserList(followersEntry.data)
        : await this.scrapeUserListFromDom(page);
      void this.stepLog.log({
        providerSource: SOURCE, entityId,
        stepType: followersEntry ? ScrapeStepType.API_CAPTURE : ScrapeStepType.DOM_SCRAPE,
        url: followersEntry?.url ?? `https://x.com/${username}/followers`,
        httpStatus: followersEntry ? 200 : null,
        durationMs: followersEntry ? null : Date.now() - followStart,
        success: true,
        extractedData: { items: { count: followers.length, samples: followers.slice(0, 10).map((f) => `@${f.screen_name}`) } },
      });

      // ── Paso 5: following ─────────────────────────────────────────────────
      const followingStart = Date.now();
      const followingJson = await this.captureGraphQL(page, `https://x.com/${username}/following`, 'Following');
      const following = followingJson
        ? this.parseUserList(followingJson)
        : await this.scrapeUserListFromDom(page);
      void this.stepLog.log({
        providerSource: SOURCE, entityId,
        stepType: followingJson ? ScrapeStepType.API_CAPTURE : ScrapeStepType.DOM_SCRAPE,
        url: `https://x.com/${username}/following`,
        durationMs: Date.now() - followingStart, success: true,
        extractedData: { items: { count: following.length, samples: following.slice(0, 10).map((f) => `@${f.screen_name}`) } },
      });

      if (options.mode === 'public' && !followers.length && !following.length) {
        this.logger.log(`@${username}: followers/following requieren autenticación. Agrega session_cookies para habilitarlos.`);
      }

      this.logger.debug(`@${username}: ${tweets.length} tweets, ${followers.length} followers, ${following.length} following`);
      return { profile, tweets, followers, following };
    } finally {
      await context.close();
    }
  }

  private endpointName(url: string): string {
    return url.match(/\/graphql\/[^/]+\/([^?]+)/)?.[1] ?? url.split('/').pop()?.split('?')[0] ?? url;
  }

  private profileSummary(p: XPlaywrightProfile, source: string) {
    return {
      fields: {
        name: p.name,
        handle: p.screen_name,
        verified: p.verified,
        hasAvatar: !!p.profile_image_url_https,
        hasBio: !!p.description,
        hasLocation: !!p.location,
        source,
      },
      metrics: {
        followers: p.followers_count,
        following: p.friends_count,
        posts: p.statuses_count,
      },
    };
  }

  // ── captureGraphQL ────────────────────────────────────────────────────────
  // Navega a `url` con el mismo patrón networkidle/8s y retorna el primer response
  // GraphQL cuya URL contenga `endpointPattern`. Retorna null si no llega ninguno.

  private async captureGraphQL(page: Page, url: string, endpointPattern: string): Promise<unknown> {
    const allGraphql: string[] = [];
    const captures: Promise<unknown>[] = [];

    const listener = (response: import('playwright').Response) => {
      const rUrl = response.url();
      if (rUrl.includes('/graphql/') && response.status() === 200) {
        allGraphql.push(rUrl.substring(0, 120));
        if (rUrl.includes(endpointPattern)) {
          captures.push(response.json().catch(() => null));
        }
      }
    };

    page.on('response', listener);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 8_000 }).catch(() => {});
    page.off('response', listener);

    this.logger.debug(`captureGraphQL(${endpointPattern}): ${allGraphql.length} graphql URLs → ${allGraphql.join(' | ') || '(ninguna)'}`);

    const resolved = await Promise.all(captures);
    return resolved.find((r) => r !== null) ?? null;
  }

  private async scrapeUserListFromDom(page: Page): Promise<XPlaywrightFollowEntry[]> {
    try {
      // Esperar a que al menos un UserCell sea visible antes de scrapear
      await page.waitForSelector('[data-testid="UserCell"]', { timeout: 8_000 }).catch(() => {});

      const raw = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('[data-testid="UserCell"]'));
        const result: { screen_name: string; name: string; avatarUrl: string | null }[] = [];

        for (const cell of cells) {
          // ── Username ──────────────────────────────────────────────────────
          // Extraído del data-testid del contenedor del avatar.
          // Formato: data-testid="UserAvatar-Container-{username}"
          const avatarEl = cell.querySelector('[data-testid^="UserAvatar-Container-"]');
          const testId = avatarEl?.getAttribute('data-testid') ?? '';
          let screen_name = testId.replace('UserAvatar-Container-', '').trim();

          // Fallback: href del primer link de perfil con patrón /username
          if (!screen_name || screen_name === 'unknown') {
            const links = Array.from(cell.querySelectorAll('a[href^="/"]')) as HTMLAnchorElement[];
            const pl = links.find((a) => /^\/[A-Za-z0-9_]+$/.test(a.getAttribute('href') ?? ''));
            screen_name = pl?.getAttribute('href')?.replace('/', '') ?? '';
          }

          if (!screen_name) continue;

          // ── Nombre ────────────────────────────────────────────────────────
          // Estructura del UserCell (3 links con href="/username"):
          //   1. Avatar link  → aria-hidden="true"           (ignorar)
          //   2. Nombre link  → SIN aria-hidden NI tabindex="-1"  (este)
          //   3. Handle link  → tabindex="-1"                (ignorar)
          //
          // Dentro del link de nombre, el display name está en:
          //   a > div > div[dir="ltr"] (primero) > span (outer) > span:first (leaf con texto)
          //
          // El segundo div[dir="ltr"] contiene el badge de verificado (svg), lo ignoramos.
          const nameLink = cell.querySelector(
            `a[href="/${screen_name}"][role="link"]:not([aria-hidden="true"]):not([tabindex="-1"])`,
          );
          // Tomamos el primer div[dir="ltr"] dentro del link (el segundo es el badge verificado)
          const firstNameDiv = nameLink?.querySelector('div[dir="ltr"]');
          // Dentro del outer span, buscamos el primer span hoja con texto (el display name)
          const outerSpan = firstNameDiv?.querySelector('span');
          const nameSpan = Array.from(outerSpan?.querySelectorAll('span') ?? []).find(
            (s) => !s.querySelector('span') && !!s.textContent?.trim(),
          );
          const name = nameSpan?.textContent?.trim() ?? screen_name;

          // ── Avatar ────────────────────────────────────────────────────────
          const avatarImg = avatarEl?.querySelector('img') as HTMLImageElement | null;

          result.push({ screen_name, name, avatarUrl: avatarImg?.src ?? null });
        }

        return result;
      });

      this.logger.debug(`scrapeUserListFromDom: ${raw.length} cells, first="${raw[0]?.screen_name ?? 'none'}"`);

      return raw.map((u) => ({
        id: '',
        name: u.name,
        screen_name: u.screen_name,
        profile_image_url_https: u.avatarUrl ?? undefined,
      }));
    } catch (e) {
      this.logger.error(`scrapeUserListFromDom error: ${e}`);
      return [];
    }
  }

  // ── DOM scraping ──────────────────────────────────────────────────────────

  private async scrapeProfileFromDom(page: Page, username: string): Promise<XPlaywrightProfile | null> {
    try {
      const raw = await page.evaluate((handle: string) => {
        if (!document.querySelector('[data-testid="UserName"]')) return null;

        // ── Nombre ─────────────────────────────────────────────────────────────
        const nameEl   = document.querySelector('[data-testid="UserName"]');
        const nameSpan = Array.from(nameEl?.querySelectorAll('span') ?? [])
          .find((s) => s.textContent?.trim() && !s.querySelector('span'));
        const name = nameSpan?.textContent?.trim() ?? handle;

        // ── Bio / ubicación ────────────────────────────────────────────────────
        const bio      = document.querySelector('[data-testid="UserDescription"]')?.textContent?.trim() ?? null;
        const location = document.querySelector('[data-testid="UserLocation"]')?.textContent?.trim() ?? null;

        // ── Parseador de conteos "1,234" / "12.5K" / "1.2M" ──────────────────
        const parseCount = (text: string): number => {
          const t = (text ?? '').replace(/,/g, '').trim();
          if (t.endsWith('K')) return Math.round(parseFloat(t) * 1_000);
          if (t.endsWith('M')) return Math.round(parseFloat(t) * 1_000_000);
          return parseInt(t, 10) || 0;
        };
        const countOf = (el: Element | null): number => {
          if (!el) return 0;
          // Busca el span hoja (sin hijos span) con valor numérico
          for (const s of Array.from(el.querySelectorAll('span'))) {
            if (!s.querySelector('span')) {
              const n = parseCount(s.textContent ?? '');
              if (n > 0) return n;
            }
          }
          return 0;
        };

        // ── Followers / Following — usa a.href completa para matching robusto ──
        const handleLower = handle.toLowerCase();
        const allLinks    = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];

        const followingEl = allLinks.find((a) =>
          a.href.toLowerCase().includes(`/${handleLower}/following`),
        ) ?? null;
        const followersEl = allLinks.find((a) => {
          const h = a.href.toLowerCase();
          return h.includes(`/${handleLower}/followers`) || h.includes(`/${handleLower}/verified_followers`);
        }) ?? null;

        // ── Posts count: busca el header "343 posts" ───────────────────────────
        const postsSpan = Array.from(document.querySelectorAll('span')).find((s) =>
          /^\d[\d,.]*\s*(posts?|tweets?)$/i.test(s.textContent?.trim() ?? ''),
        );
        const postsCount = postsSpan
          ? parseCount((postsSpan.textContent?.trim() ?? '').replace(/\s*(posts?|tweets?)/i, ''))
          : 0;

        // ── Avatar ─────────────────────────────────────────────────────────────
        const avatarByPhoto  = document.querySelector(`a[href="/${handle}/photo"] img`) as HTMLImageElement | null;
        const avatarByTestId = document.querySelector('[data-testid^="UserAvatar"] img') as HTMLImageElement | null;
        const avatarUrl      = avatarByPhoto?.src ?? avatarByTestId?.src ?? null;

        // ── Verificado / protegido ─────────────────────────────────────────────
        const verified    = !!document.querySelector('[data-testid="UserVerifiedBadge"]');
        const isProtected = !!document.querySelector('[data-testid="UserProtected"]');

        return { name, bio, location, followersCount: countOf(followersEl), followingCount: countOf(followingEl), postsCount, avatarUrl, verified, isProtected };
      }, username);

      if (!raw) return null;

      this.logger.debug(
        `@${username} DOM: name="${raw.name}" followers=${raw.followersCount} following=${raw.followingCount} posts=${raw.postsCount} avatar=${!!raw.avatarUrl}`,
      );

      return {
        id: '',
        name: raw.name,
        screen_name: username,
        description: raw.bio ?? undefined,
        location: raw.location ?? undefined,
        followers_count: raw.followersCount,
        friends_count: raw.followingCount,
        statuses_count: raw.postsCount,
        created_at: '',
        profile_image_url_https: raw.avatarUrl ?? undefined,
        verified: raw.verified,
        protected: raw.isProtected,
      };
    } catch {
      return null;
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(xUsername: string, password: string, proxyUrl?: string): Promise<Cookie[]> {
    const context = await this.browserService.newIsolatedContext({ proxyUrl });
    const page = await context.newPage();

    try {
      this.logger.log('Iniciando flujo de login en X (JetFuel flow)...');

      // 'load' espera a que los scripts de React/JF estén listos antes de interactuar
      await page.goto('https://x.com/i/jf/onboarding/web?mode=login', {
        waitUntil: 'load', timeout: 30_000,
      });
      this.logger.log(`Login page: ${page.url()}`);

      // Monitor de la API JF — detecta bloqueos de X (rate limit, bot detection)
      let xBlockError: string | null = null;
      page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/jfapi/') && url.includes('begin_login')) {
          const body = await res.text().catch(() => '');
          // La respuesta es Protocol Buffers pero el texto de error es legible
          if (body.includes('temporarily limited') || body.includes('try again later')) {
            xBlockError = 'X bloqueó el login: "We\'ve temporarily limited your login. Please try again later."';
          }
        }
      });

      // La página JF renderiza el form 2 veces — esperamos el primero
      const usernameLocator = page.locator('input[name="username_or_email"]').first();
      await usernameLocator.waitFor({ state: 'visible', timeout: 15_000 });

      // 1. fill() de Playwright (dispara eventos React) + click nativo vía CDP en el botón correcto
      await usernameLocator.fill(xUsername);
      this.logger.log(`Username filled: "${await usernameLocator.inputValue()}"`);

      // Locator encadenado: botón submit dentro del form que tiene el username input
      const submitBtn = page.locator('form').filter({
        has: page.locator('input[name="username_or_email"]'),
      }).locator('button[type="submit"]').first();

      const urlBefore = page.url();
      await submitBtn.click();
      this.logger.log(`Submit clicked (CDP). Btn text: "${await submitBtn.textContent()}"`);

      // Esperar cambio de URL (hash = transición a paso contraseña)
      await page.waitForFunction(
        (prev: string) => location.href !== prev,
        urlBefore,
        { timeout: 10_000 },
      ).catch(() => this.logger.warn(`URL no cambió. Actual: ${page.url()}`));

      this.logger.log(`Después de submit username: ${page.url()}`);

      // Fail fast si X bloqueó el intento
      if (xBlockError) throw new Error(`${xBlockError}\n\nAlternativa: usa session_cookies en lugar de usuario/contraseña.`);

      // Paso 2: contraseña
      await page.locator('#jf-input-password').waitFor({ state: 'visible', timeout: 15_000 });
      await page.locator('#jf-input-password').fill(password);
      this.logger.log('Password filled');

      const pwSubmitBtn = page.locator('form').filter({
        has: page.locator('#jf-input-password'),
      }).locator('button[type="submit"]').first();
      await pwSubmitBtn.click();

      // Paso 3: esperar que X salga del flujo de login
      await page.waitForURL(
        (url) => {
          const s = url.toString();
          return !s.includes('/i/flow/') && !s.includes('/i/jf/') && !s.includes('/login');
        },
        { timeout: 25_000 },
      ).catch(() => {
        throw new Error(
          `Login falló — credenciales incorrectas, X bloqueó el acceso, o se requiere verificación. URL actual: ${page.url()}`,
        );
      });

      this.logger.log(`Login OK → ${page.url()}`);
      const cookies = await context.cookies();
      this.logger.log(`${cookies.length} cookies capturadas`);

      void this.stepLog.log({
        providerSource: SOURCE,
        stepType: ScrapeStepType.LOGIN,
        url: 'https://x.com/i/jf/onboarding/web?mode=login',
        success: true,
        extractedData: {
          fields: { finalUrl: page.url() },
          metrics: { cookiesCount: cookies.length },
        },
      });

      return cookies;
    } finally {
      await context.close();
    }
  }

  private async humanType(page: Page, selector: string, text: string): Promise<void> {
    // focus() en lugar de click() para evitar errores con elementos superpuestos
    await page.focus(selector);
    for (const char of text) {
      await page.keyboard.type(char, { delay: 40 + Math.random() * 80 });
    }
  }

  // ── Parsers ────────────────────────────────────────────────────────────────

  private parseProfile(json: unknown): XPlaywrightProfile | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (json as any)?.data?.user?.result;
      if (!result) return null;

      // Ruta A: UserByScreenName → legacy está directamente en result
      if (result.legacy) {
        const p = this.buildProfile(result.rest_id ?? '', result.legacy);
        this.logger.debug(`parseProfile (API): screen_name="${p.screen_name}" name="${p.name}" followers=${p.followers_count}`);
        return p;
      }

      // Ruta B: UserTweets → legacy está en el primer tweet del autor
      //   X usa "timeline" o "timeline_v2" dependiendo de la versión del endpoint
      const timelineRoot = result.timeline ?? result.timeline_v2;
      const instructions: unknown[] = timelineRoot?.timeline?.instructions ?? [];
      for (const instruction of instructions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const entry of (instruction as any)?.entries ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const userResult = (entry as any)?.content?.itemContent?.tweet_results?.result?.core?.user_results?.result;
          if (userResult?.legacy?.screen_name) {
            return this.buildProfile(userResult.rest_id ?? '', userResult.legacy);
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildProfile(id: string, l: any): XPlaywrightProfile {
    return {
      id,
      name: l.name ?? '',
      screen_name: l.screen_name ?? '',
      description: l.description || undefined,
      location: l.location || undefined,
      followers_count: l.followers_count ?? 0,
      friends_count: l.friends_count ?? 0,
      statuses_count: l.statuses_count ?? 0,
      created_at: l.created_at ?? '',
      profile_image_url_https: l.profile_image_url_https || undefined,
      verified: l.verified ?? false,
      protected: l.protected ?? false,
    };
  }

  private parseTweets(json: unknown): XPlaywrightTweet[] {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (json as any)?.data?.user?.result;
      const timelineRoot = result?.timeline ?? result?.timeline_v2;
      const instructions: unknown[] = timelineRoot?.timeline?.instructions ?? [];
      const tweets: XPlaywrightTweet[] = [];

      for (const instruction of instructions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries: unknown[] = (instruction as any)?.entries ?? [];
        for (const entry of entries) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legacy = (entry as any)?.content?.itemContent?.tweet_results?.result?.legacy;
          if (legacy?.id_str) {
            tweets.push({
              id_str: legacy.id_str,
              full_text: legacy.full_text ?? '',
              created_at: legacy.created_at ?? '',
              favorite_count: legacy.favorite_count ?? 0,
              retweet_count: legacy.retweet_count ?? 0,
              entities: this.parseEntities(legacy.entities),
              place: legacy.place ? { full_name: legacy.place.full_name } : undefined,
            });
          }
        }
      }

      return tweets;
    } catch {
      return [];
    }
  }

  private parseEntities(raw: unknown): XPlaywrightTweetEntities {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (raw as any) ?? {};
    return {
      hashtags: (r.hashtags ?? []).map((h: { text?: string }) => ({ text: h.text ?? '' })),
      urls: (r.urls ?? []).map((u: { expanded_url?: string }) => ({ expanded_url: u.expanded_url ?? '' })),
      media: r.media?.map((m: { media_url_https?: string; type?: string }) => ({
        media_url_https: m.media_url_https ?? '',
        type: m.type ?? '',
      })),
      user_mentions: (r.user_mentions ?? []).map((u: { screen_name?: string; id_str?: string }) => ({
        screen_name: u.screen_name ?? '',
        id_str: u.id_str ?? '',
      })),
    };
  }

  private parseUserList(json: unknown): XPlaywrightFollowEntry[] {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (json as any)?.data?.user?.result;
      // X usa "timeline" o "timeline_v2" — igual que en parseTweets
      const timelineRoot = result?.timeline ?? result?.timeline_v2;
      const instructions: unknown[] = timelineRoot?.timeline?.instructions ?? [];

      this.logger.debug(`parseUserList: instructions=${instructions.length}`);

      const users: XPlaywrightFollowEntry[] = [];

      for (const instruction of instructions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries: unknown[] = (instruction as any)?.entries ?? [];
        for (const entry of entries) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const userResult = (entry as any)?.content?.itemContent?.user_results?.result;
          if (!userResult?.legacy) continue;
          const l = userResult.legacy;
          if (!l.screen_name) continue;          // skip entries sin handle
          users.push({
            id: userResult.rest_id ?? '',
            name: l.name ?? '',
            screen_name: l.screen_name,
            profile_image_url_https: l.profile_image_url_https ?? undefined,
            followers_count: l.followers_count,
          });
        }
      }

      this.logger.debug(`parseUserList: ${users.length} users, first=${users[0]?.screen_name ?? 'none'}`);
      return users;
    } catch (e) {
      this.logger.error(`parseUserList error: ${e}`);
      return [];
    }
  }
}
