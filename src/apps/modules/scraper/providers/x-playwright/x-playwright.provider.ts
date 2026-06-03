import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TramaProvider, TramaProviderCategory } from '../../../../../libs/providers';
import { ProviderCredentialService } from '../../../provider-credential/provider-credential.service';
import { XPlaywrightScraper } from './x-playwright.scraper';
import type {
  TramaProviderContext,
  TramaProviderResult,
  TramaProviderSeed,
  TramaNodeType,
} from '../../../../../libs/providers';
import type {
  Cookie,
  XPlaywrightFollowEntry,
  XPlaywrightMode,
  XPlaywrightProfile,
  XPlaywrightTweet,
} from './x-playwright.types';

@Injectable()
export class XPlaywrightProvider extends TramaProvider {
  readonly source = 'x-playwright';
  readonly name = 'X / Twitter (Playwright)';
  readonly description =
    'Extrae perfil y posts de X mediante scraping con Playwright. ' +
    'Sin cuenta developer. Modo público o autenticado (cookies de sesión).';
  readonly category = TramaProviderCategory.SOCIAL;
  readonly countries: string[] = [];
  readonly supportedInputs: string[] = ['username', 'socialUrl'];
  readonly outputNodeTypes: TramaNodeType[] = [
    'SocialProfile',
    'Username',
    'Post',
    'Hashtag',
    'Media',
    'Location',
  ];

  private readonly logger = new Logger(XPlaywrightProvider.name);

  constructor(
    private readonly scraper: XPlaywrightScraper,
    private readonly credentialService: ProviderCredentialService,
  ) {
    super();
  }

  canHandle(seed: TramaProviderSeed): boolean {
    if (seed.username) return true;
    return !!seed.socialUrl?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
  }

  async execute(ctx: TramaProviderContext): Promise<TramaProviderResult> {
    const { entityId } = ctx;
    const username = this.resolveUsername(ctx.seed);
    if (!username) throw new Error('No se pudo resolver el username desde el seed');

    const [cookieJson, proxyUrl, xUsername, password] = await Promise.all([
      this.credentialService.getDecryptedValue(this.source, 'session_cookies'),
      this.credentialService.getDecryptedValue(this.source, 'proxy_url'),
      this.credentialService.getDecryptedValue(this.source, 'username'),
      this.credentialService.getDecryptedValue(this.source, 'password'),
    ]);

    this.logger.log(
      `Credenciales: session_cookies=${!!cookieJson} | username=${!!xUsername} | password=${!!password} | proxy=${!!proxyUrl}`,
    );

    // ── Prioridad de credenciales ─────────────────────────────────────────────
    // 1. session_cookies guardadas en DB    → ruta rápida, sin login
    // 2. username + password               → login automático, guarda cookies en DB
    // 3. ninguna                           → modo público (datos limitados)
    let cookies: Cookie[] | undefined = cookieJson ? (JSON.parse(cookieJson) as Cookie[]) : undefined;

    if (cookies?.length) {
      this.logger.log(`Usando session_cookies cacheadas (${cookies.length} cookies)`);
    } else if (xUsername && password) {
      cookies = await this.doLogin(xUsername, password, proxyUrl);
    } else {
      this.logger.log('Sin credenciales configuradas — modo público');
    }

    const mode: XPlaywrightMode = cookies?.length ? 'authenticated' : 'public';
    this.logger.log(`Scraping X/@${username} via Playwright [mode=${mode}]`);

    let raw = await this.scraper.scrape(username, { mode, cookies, proxyUrl: proxyUrl ?? undefined, entityId });

    // ── Auto-retry por cookies expiradas ──────────────────────────────────────
    // Si había cookies cacheadas pero la sesión llegó vacía (sin tweets ni followers),
    // probablemente expiraron. Re-login con usuario/contraseña si están disponibles.
    if (mode === 'authenticated' && !raw.tweets.length && !raw.followers.length && xUsername && password) {
      this.logger.warn('Posibles cookies expiradas — limpiando y re-autenticando...');
      await this.credentialService.upsert(this.source, 'session_cookies', 'Sesión X (auto-generada)', '[]');
      cookies = await this.doLogin(xUsername, password, proxyUrl);
      raw = await this.scraper.scrape(username, { mode: 'authenticated', cookies, proxyUrl: proxyUrl ?? undefined, entityId });
    }

    return this.mapToResult(entityId, raw);
  }

  private async doLogin(xUsername: string, password: string, proxyUrl: string | null): Promise<Cookie[]> {
    this.logger.log(`Iniciando login con usuario/contraseña para @${xUsername}...`);
    const cookies = await this.scraper.login(xUsername, password, proxyUrl ?? undefined);
    await this.credentialService.upsert(
      this.source,
      'session_cookies',
      'Sesión X (auto-generada)',
      JSON.stringify(cookies),
    );
    this.logger.log(`Login OK → ${cookies.length} cookies guardadas en DB`);
    return cookies;
  }

  // ── Mapping ────────────────────────────────────────────────────────────────

  private mapToResult(
    entityId: string,
    raw: Awaited<ReturnType<XPlaywrightScraper['scrape']>>,
  ): TramaProviderResult {
    const { profile, tweets, followers, following } = raw;
    const now = new Date().toISOString();
    const nodes: TramaProviderResult['nodes'] = [];
    const relationships: TramaProviderResult['relationships'] = [];

    // ── SocialProfile ──────────────────────────────────────────────────────
    const profileId = randomUUID();
    nodes.push({
      id: profileId,
      type: 'SocialProfile',
      properties: {
        value: `x.com/${profile.screen_name}`,
        normalizedValue: profile.screen_name.toLowerCase(),
        name: profile.name,
        description: profile.description ?? undefined,
        sourceId: profile.id,
        sourceUrl: `https://x.com/${profile.screen_name}`,
        source: this.source,
        status: profile.protected ? 'inactive' : 'active',
        confidence: 0.9,
        createdAt: now,
        followersCount: profile.followers_count,
        followingCount: profile.friends_count,
        tweetsCount: profile.statuses_count,
        verified: profile.verified,
        joinedAt: profile.created_at ? new Date(profile.created_at).toISOString() : undefined,
        avatarUrl: profile.profile_image_url_https ?? undefined,
      },
    });
    relationships.push({ fromId: entityId, toId: profileId, type: 'HAS_PROFILE' });

    // ── Username ───────────────────────────────────────────────────────────
    const usernameId = randomUUID();
    nodes.push({
      id: usernameId,
      type: 'Username',
      properties: {
        value: `@${profile.screen_name}`,
        normalizedValue: profile.screen_name.toLowerCase(),
        name: `@${profile.screen_name}`,
        sourceUrl: `https://x.com/${profile.screen_name}`,
        source: this.source,
        confidence: 0.9,
        createdAt: now,
      },
    });
    relationships.push({ fromId: profileId, toId: usernameId, type: 'HAS_USERNAME' });

    // ── Location ───────────────────────────────────────────────────────────
    if (profile.location?.trim()) {
      const locationId = randomUUID();
      nodes.push({
        id: locationId,
        type: 'Location',
        properties: {
          value: profile.location,
          normalizedValue: profile.location.toLowerCase().trim(),
          name: profile.location,
          description: 'Ubicación declarada en perfil de X',
          source: this.source,
          confidence: 0.5,
          createdAt: now,
        },
      });
      relationships.push({ fromId: profileId, toId: locationId, type: 'LOCATED_AT' });
    }

    // ── Posts ──────────────────────────────────────────────────────────────
    const hashtagMap = new Map<string, string>();
    const mentionMap = new Map<string, string>();

    for (const tweet of tweets) {
      this.mapTweet(tweet, profileId, profile, nodes, relationships, hashtagMap, mentionMap, now);
    }

    // ── Followers / Following (modo autenticado) ───────────────────────────
    if (raw.followers.length || raw.following.length) {
      this.mapConnections(raw.followers, raw.following, profileId, nodes, relationships, now);
    }

    return {
      nodes,
      relationships,
      rawData: raw,
      sourceUrl: `https://x.com/${profile.screen_name}`,
    };
  }

  private mapTweet(
    tweet: XPlaywrightTweet,
    profileId: string,
    profile: XPlaywrightProfile,
    nodes: TramaProviderResult['nodes'],
    relationships: TramaProviderResult['relationships'],
    hashtagMap: Map<string, string>,
    mentionMap: Map<string, string>,
    now: string,
  ): void {
    const postId = randomUUID();
    nodes.push({
      id: postId,
      type: 'Post',
      properties: {
        value: tweet.id_str,
        normalizedValue: tweet.id_str,
        name: tweet.full_text.substring(0, 100),
        description: tweet.full_text,
        sourceId: tweet.id_str,
        sourceUrl: `https://x.com/${profile.screen_name}/status/${tweet.id_str}`,
        source: this.source,
        confidence: 0.9,
        createdAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : now,
        likesCount: tweet.favorite_count,
        retweetsCount: tweet.retweet_count,
      },
    });
    relationships.push({ fromId: profileId, toId: postId, type: 'POSTED' });

    for (const { text } of tweet.entities.hashtags) {
      const tag = text.toLowerCase();
      if (!hashtagMap.has(tag)) {
        const id = randomUUID();
        hashtagMap.set(tag, id);
        nodes.push({
          id,
          type: 'Hashtag',
          properties: {
            value: `#${text}`,
            normalizedValue: tag,
            name: `#${text}`,
            source: this.source,
            confidence: 0.95,
            createdAt: now,
          },
        });
      }
      relationships.push({ fromId: postId, toId: hashtagMap.get(tag)!, type: 'HAS_HASHTAG' });
    }

    if (tweet.entities.media) {
      for (const media of tweet.entities.media) {
        const mediaId = randomUUID();
        nodes.push({
          id: mediaId,
          type: 'Media',
          properties: {
            value: media.media_url_https,
            normalizedValue: media.media_url_https,
            name: media.type,
            sourceUrl: media.media_url_https,
            source: this.source,
            confidence: 0.9,
            createdAt: now,
          },
        });
        relationships.push({ fromId: postId, toId: mediaId, type: 'CONTAINS_MEDIA' });
      }
    }

    for (const { screen_name } of tweet.entities.user_mentions) {
      const handle = screen_name.toLowerCase();
      if (!mentionMap.has(handle)) {
        const id = randomUUID();
        mentionMap.set(handle, id);
        nodes.push({
          id,
          type: 'Username',
          properties: {
            value: `@${screen_name}`,
            normalizedValue: handle,
            name: `@${screen_name}`,
            description: 'Mencionado en posts de X',
            sourceUrl: `https://x.com/${screen_name}`,
            source: this.source,
            confidence: 0.4,
            createdAt: now,
          },
        });
      }
      relationships.push({ fromId: postId, toId: mentionMap.get(handle)!, type: 'MENTIONS' });
    }
  }

  private mapConnections(
    followers: XPlaywrightFollowEntry[],
    following: XPlaywrightFollowEntry[],
    profileId: string,
    nodes: TramaProviderResult['nodes'],
    relationships: TramaProviderResult['relationships'],
    now: string,
  ): void {
    const profileNodeMap = new Map<string, string>();

    const ensureProfile = (entry: XPlaywrightFollowEntry): string => {
      const key = entry.screen_name.toLowerCase();
      if (!profileNodeMap.has(key)) {
        const id = randomUUID();
        profileNodeMap.set(key, id);
        nodes.push({
          id,
          type: 'SocialProfile',
          properties: {
            value: `x.com/${entry.screen_name}`,
            normalizedValue: key,
            name: entry.name,
            sourceId: entry.id,
            sourceUrl: `https://x.com/${entry.screen_name}`,
            source: this.source,
            confidence: 0.85,
            createdAt: now,
            avatarUrl: entry.profile_image_url_https ?? undefined,
            followersCount: entry.followers_count,
          },
        });
      }
      return profileNodeMap.get(key)!;
    };

    for (const f of followers) {
      if (!f.screen_name) continue;
      const id = ensureProfile(f);
      relationships.push({ fromId: id, toId: profileId, type: 'FOLLOWS' });
    }

    for (const f of following) {
      if (!f.screen_name) continue;
      const id = ensureProfile(f);
      relationships.push({ fromId: profileId, toId: id, type: 'FOLLOWS' });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveUsername(seed: TramaProviderSeed): string | null {
    if (seed.username) return seed.username.replace(/^@/, '').trim();
    const match = seed.socialUrl?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
    return match?.[1] ?? null;
  }
}
