import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TramaProvider, TramaProviderCategory } from '../../../../../libs/providers';
import { ProviderCredentialService } from '../../../provider-credential/provider-credential.service';
import type {
  TramaProviderContext,
  TramaProviderResult,
  TramaProviderSeed,
  TramaNodeType,
} from '../../../../../libs/providers';

// ─── X API v2 types ───────────────────────────────────────────────────────────

interface XV2User {
  id: string;
  name: string;
  username: string;
  description?: string;
  location?: string;
  url?: string;
  created_at?: string;
  verified?: boolean;
  protected?: boolean;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  entities?: {
    url?: { urls?: { expanded_url: string }[] };
    description?: { urls?: { expanded_url: string; display_url: string }[]; mentions?: { username: string }[]; hashtags?: { tag: string }[] };
  };
}

interface XV2TweetEntities {
  hashtags?: { tag: string }[];
  urls?: { expanded_url: string; display_url: string; unwound_url?: string }[];
  mentions?: { username: string; id: string }[];
  annotations?: { normalized_text: string; type: string; probability: number }[];
}

interface XV2TweetPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

interface XV2Tweet {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
  public_metrics?: XV2TweetPublicMetrics;
  entities?: XV2TweetEntities;
  referenced_tweets?: { type: 'retweeted' | 'quoted' | 'replied_to'; id: string }[];
  attachments?: { media_keys?: string[] };
  geo?: { place_id?: string };
}

interface XV2Media {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
}

interface XV2Response<T> {
  data?: T;
  includes?: { media?: XV2Media[]; users?: XV2User[]; tweets?: XV2Tweet[] };
  meta?: { result_count?: number; next_token?: string };
  errors?: { title: string; detail: string }[];
}

// ─── Analysis helpers ─────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function analyzeTimestamps(tweets: XV2Tweet[]): {
  topHours: number[];
  topDays: number[];
  avgTweetsPerDay: number;
} {
  if (!tweets.length) return { topHours: [], topDays: [], avgTweetsPerDay: 0 };

  const hourCounts = new Array<number>(24).fill(0);
  const dayCounts = new Array<number>(7).fill(0);

  for (const t of tweets) {
    if (!t.created_at) continue;
    const d = new Date(t.created_at);
    hourCounts[d.getUTCHours()]++;
    dayCounts[d.getUTCDay()]++;
  }

  const topHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .filter((x) => x.count > 0)
    .map((x) => x.hour);

  const topDays = dayCounts
    .map((count, day) => ({ day, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter((x) => x.count > 0)
    .map((x) => x.day);

  const dates = tweets
    .filter((t) => t.created_at)
    .map((t) => new Date(t.created_at!).getTime());

  let avgTweetsPerDay = 0;
  if (dates.length >= 2) {
    const spanDays = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
    avgTweetsPerDay = spanDays > 0 ? Math.round((tweets.length / spanDays) * 10) / 10 : tweets.length;
  }

  return { topHours, topDays, avgTweetsPerDay };
}

function topByFrequency<T extends string>(items: T[], limit = 10): T[] {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

@Injectable()
export class XDeveloperProvider extends TramaProvider {
  readonly source = 'x-developer';
  readonly name = 'X / Twitter (Developer API)';
  readonly description =
    'Análisis profundo de perfiles X usando la API oficial v2: perfil, tweets, seguidores, siguiendo, menciones, patrones temporales, redes de relación e indicadores de comportamiento.';
  readonly version = '1.0.0';
  readonly category = TramaProviderCategory.SOCIAL;
  readonly countries: string[] = [];
  readonly supportedInputs: string[] = ['username', 'socialUrl'];
  readonly outputNodeTypes: TramaNodeType[] = [
    'SocialProfile',
    'Username',
    'Post',
    'Hashtag',
    'URL',
    'Domain',
    'Media',
    'Location',
  ];

  private readonly logger = new Logger(XDeveloperProvider.name);
  private readonly baseUrl = 'https://api.twitter.com/2';

  constructor(private readonly credentialService: ProviderCredentialService) {
    super();
  }

  canHandle(seed: TramaProviderSeed): boolean {
    if (seed.username) return true;
    return !!seed.socialUrl?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
  }

  private resolveUsername(seed: TramaProviderSeed): string | null {
    if (seed.username) return seed.username.replace(/^@/, '').trim();
    const match = seed.socialUrl?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
    return match?.[1] ?? null;
  }

  private async getBearerToken(): Promise<string> {
    const token = await this.credentialService.getDecryptedValue(this.source, 'bearer_token');
    if (!token) throw new Error('X Developer bearer_token credential not configured. Add it via the provider credentials UI.');
    return token;
  }

  private async xFetch<T>(path: string, bearer: string): Promise<XV2Response<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        'User-Agent': 'Trama-OSINT/1.0',
      },
    });

    if (res.status === 429) {
      const reset = res.headers.get('x-rate-limit-reset');
      throw new Error(`X API rate limit hit. Resets at ${reset ? new Date(Number(reset) * 1000).toISOString() : 'unknown'}`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X API ${path} failed (${res.status}): ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<XV2Response<T>>;
  }

  private async fetchUser(username: string, bearer: string): Promise<XV2User> {
    const fields = [
      'id', 'name', 'username', 'description', 'location', 'url',
      'created_at', 'verified', 'protected', 'profile_image_url',
      'public_metrics', 'entities',
    ].join(',');

    const res = await this.xFetch<XV2User>(
      `/users/by/username/${encodeURIComponent(username)}?user.fields=${fields}`,
      bearer,
    );

    if (!res.data) throw new Error(`User @${username} not found`);
    return res.data;
  }

  private async fetchTweets(userId: string, bearer: string, maxResults = 100): Promise<{ tweets: XV2Tweet[]; media: XV2Media[] }> {
    const tweetFields = 'id,text,created_at,lang,public_metrics,entities,referenced_tweets,attachments,geo';
    const expansions = 'attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id';
    const mediaFields = 'media_key,type,url,preview_image_url';

    const url =
      `/users/${userId}/tweets` +
      `?max_results=${Math.min(maxResults, 100)}` +
      `&tweet.fields=${tweetFields}` +
      `&expansions=${expansions}` +
      `&media.fields=${mediaFields}` +
      `&exclude=replies`;

    try {
      const res = await this.xFetch<XV2Tweet[]>(url, bearer);
      return {
        tweets: res.data ?? [],
        media: res.includes?.media ?? [],
      };
    } catch (err) {
      this.logger.warn(`Tweets fetch failed for ${userId}: ${(err as Error).message}`);
      return { tweets: [], media: [] };
    }
  }

  private async fetchFollowers(userId: string, bearer: string, maxResults = 100): Promise<XV2User[]> {
    try {
      const res = await this.xFetch<XV2User[]>(
        `/users/${userId}/followers?max_results=${Math.min(maxResults, 100)}&user.fields=id,name,username,public_metrics,verified`,
        bearer,
      );
      return res.data ?? [];
    } catch (err) {
      this.logger.warn(`Followers fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchFollowing(userId: string, bearer: string, maxResults = 100): Promise<XV2User[]> {
    try {
      const res = await this.xFetch<XV2User[]>(
        `/users/${userId}/following?max_results=${Math.min(maxResults, 100)}&user.fields=id,name,username,public_metrics,verified`,
        bearer,
      );
      return res.data ?? [];
    } catch (err) {
      this.logger.warn(`Following fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchMentions(userId: string, bearer: string, maxResults = 50): Promise<XV2Tweet[]> {
    try {
      const res = await this.xFetch<XV2Tweet[]>(
        `/users/${userId}/mentions?max_results=${Math.min(maxResults, 100)}&tweet.fields=id,text,created_at,entities,public_metrics&expansions=author_id&user.fields=id,username`,
        bearer,
      );
      return res.data ?? [];
    } catch (err) {
      this.logger.warn(`Mentions fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  async execute(ctx: TramaProviderContext): Promise<TramaProviderResult> {
    const { entityId } = ctx;
    const username = this.resolveUsername(ctx.seed);
    if (!username) throw new Error('No se pudo resolver el username desde el seed');

    this.logger.log(`X Developer analysis: @${username}`);
    const bearer = await this.getBearerToken();

    // Fetch all data concurrently where possible
    const user = await this.fetchUser(username, bearer);
    const [{ tweets, media }, followers, following, mentions] = await Promise.all([
      this.fetchTweets(user.id, bearer, 100),
      this.fetchFollowers(user.id, bearer, 100),
      this.fetchFollowing(user.id, bearer, 100),
      this.fetchMentions(user.id, bearer, 50),
    ]);

    const now = new Date().toISOString();
    const nodes: TramaProviderResult['nodes'] = [];
    const relationships: TramaProviderResult['relationships'] = [];

    // ── Temporal analysis ────────────────────────────────────────────────────
    const temporal = analyzeTimestamps(tweets);
    this.logger.log({
      tweets,
      media,
      followers,
      following,
      mentions,
      temporal,
    })
    // ── Content analysis ─────────────────────────────────────────────────────
    const allHashtags = tweets.flatMap((t) => t.entities?.hashtags?.map((h) => h.tag.toLowerCase()) ?? []);
    const allUrls = tweets.flatMap((t) =>
      (t.entities?.urls ?? [])
        .map((u) => u.unwound_url ?? u.expanded_url)
        .filter((u): u is string => !!u && !u.includes('t.co')),
    );
    const allDomains = allUrls.map(extractDomain).filter(Boolean) as string[];
    const allMentionedUsernames = tweets.flatMap((t) => t.entities?.mentions?.map((m) => m.username.toLowerCase()) ?? []);
    const allLanguages = [...new Set(tweets.map((t) => t.lang).filter(Boolean))] as string[];

    const retweets = tweets.filter((t) => t.referenced_tweets?.some((r) => r.type === 'retweeted'));
    const quotes = tweets.filter((t) => t.referenced_tweets?.some((r) => r.type === 'quoted'));
    const replies = tweets.filter((t) => t.referenced_tweets?.some((r) => r.type === 'replied_to'));
    const originalTweets = tweets.filter((t) => !t.referenced_tweets?.length);

    // ── Account age ──────────────────────────────────────────────────────────
    const joinedAt = user.created_at ? new Date(user.created_at).toISOString() : undefined;
    const accountAgeDays = joinedAt
      ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const metrics = user.public_metrics;
    const followersCount = metrics?.followers_count ?? 0;
    const followingCount = metrics?.following_count ?? 0;
    const ratio = followingCount > 0 ? Math.round((followersCount / followingCount) * 100) / 100 : null;

    // ── SocialProfile node ───────────────────────────────────────────────────
    const profileId = randomUUID();
    nodes.push({
      id: profileId,
      type: 'SocialProfile',
      properties: {
        value: `x.com/${user.username}`,
        normalizedValue: user.username.toLowerCase(),
        name: user.name,
        description: user.description || undefined,
        sourceId: user.id,
        sourceUrl: `https://x.com/${user.username}`,
        source: this.source,
        status: user.protected ? 'inactive' : 'active',
        confidence: 0.95,
        createdAt: now,
        // Profile fields
        joinedAt,
        accountAgeDays,
        verified: user.verified ?? false,
        protected: user.protected ?? false,
        avatarUrl: user.profile_image_url,
        // Metrics
        followersCount,
        followingCount,
        tweetsCount: metrics?.tweet_count ?? 0,
        listedCount: metrics?.listed_count ?? 0,
        followRatio: ratio,
        // Temporal patterns
        avgTweetsPerDay: temporal.avgTweetsPerDay,
        topActiveHours: temporal.topHours,
        topActiveDays: temporal.topDays,
        // Content breakdown
        originalTweetsCount: originalTweets.length,
        retweetsCount: retweets.length,
        quotesCount: quotes.length,
        repliesCount: replies.length,
        contentOriginalPct: tweets.length > 0 ? Math.round((originalTweets.length / tweets.length) * 100) : null,
        // Top content
        topHashtags: topByFrequency(allHashtags, 10),
        topDomains: topByFrequency(allDomains, 10),
        topMentionedAccounts: topByFrequency(allMentionedUsernames, 10),
        // Languages
        languages: allLanguages,
        // Declared location
        declaredLocation: user.location || undefined,
      },
    });
    relationships.push({ fromId: entityId, toId: profileId, type: 'HAS_PROFILE' });

    // ── Username node ────────────────────────────────────────────────────────
    const usernameId = randomUUID();
    nodes.push({
      id: usernameId,
      type: 'Username',
      properties: {
        value: `@${user.username}`,
        normalizedValue: user.username.toLowerCase(),
        name: `@${user.username}`,
        sourceUrl: `https://x.com/${user.username}`,
        source: this.source,
        confidence: 0.95,
        createdAt: now,
      },
    });
    relationships.push({ fromId: profileId, toId: usernameId, type: 'HAS_USERNAME' });

    // ── Location node ────────────────────────────────────────────────────────
    if (user.location?.trim()) {
      const locationId = randomUUID();
      nodes.push({
        id: locationId,
        type: 'Location',
        properties: {
          value: user.location,
          normalizedValue: user.location.toLowerCase().trim(),
          name: user.location,
          description: 'Ubicación declarada en perfil de X',
          source: this.source,
          confidence: 0.4,
          createdAt: now,
        },
      });
      relationships.push({ fromId: profileId, toId: locationId, type: 'LOCATED_AT' });
    }

    // ── Profile URL link ─────────────────────────────────────────────────────
    const profileUrlExpanded = user.entities?.url?.urls?.[0]?.expanded_url;
    if (profileUrlExpanded) {
      const domain = extractDomain(profileUrlExpanded);
      if (domain) {
        const domainId = randomUUID();
        nodes.push({
          id: domainId,
          type: 'Domain',
          properties: {
            value: domain,
            normalizedValue: domain.toLowerCase(),
            name: domain,
            sourceUrl: profileUrlExpanded,
            source: this.source,
            confidence: 0.85,
            createdAt: now,
          },
        });
        relationships.push({ fromId: profileId, toId: domainId, type: 'CONTAINS_LINK' });
      }
    }

    // ── Posts with entities ──────────────────────────────────────────────────
    const mediaMap = new Map<string, XV2Media>(media.map((m) => [m.media_key, m]));
    const hashtagNodeMap = new Map<string, string>(); // tag → nodeId
    const urlNodeMap = new Map<string, string>();     // expanded_url → nodeId
    const domainNodeMap = new Map<string, string>();  // domain → nodeId
    const mentionNodeMap = new Map<string, string>(); // username_lower → nodeId

    for (const tweet of tweets) {
      const postId = randomUUID();
      const tweetType = tweet.referenced_tweets?.[0]?.type ?? 'original';

      nodes.push({
        id: postId,
        type: 'Post',
        properties: {
          value: tweet.id,
          normalizedValue: tweet.id,
          name: tweet.text.substring(0, 120),
          description: tweet.text,
          sourceId: tweet.id,
          sourceUrl: `https://x.com/${user.username}/status/${tweet.id}`,
          source: this.source,
          confidence: 0.95,
          createdAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : now,
          likesCount: tweet.public_metrics?.like_count ?? 0,
          retweetsCount: tweet.public_metrics?.retweet_count ?? 0,
          repliesCount: tweet.public_metrics?.reply_count ?? 0,
          quotesCount: tweet.public_metrics?.quote_count ?? 0,
          lang: tweet.lang,
          postType: tweetType,
        },
      });
      relationships.push({ fromId: profileId, toId: postId, type: 'POSTED' });

      // Hashtags
      for (const { tag } of tweet.entities?.hashtags ?? []) {
        const normalized = tag.toLowerCase();
        if (!hashtagNodeMap.has(normalized)) {
          const hId = randomUUID();
          hashtagNodeMap.set(normalized, hId);
          nodes.push({
            id: hId,
            type: 'Hashtag',
            properties: {
              value: `#${tag}`,
              normalizedValue: normalized,
              name: `#${tag}`,
              source: this.source,
              confidence: 0.95,
              createdAt: now,
            },
          });
        }
        relationships.push({ fromId: postId, toId: hashtagNodeMap.get(normalized)!, type: 'HAS_HASHTAG' });
      }

      // URLs and domains
      for (const urlEntity of tweet.entities?.urls ?? []) {
        const expanded = urlEntity.unwound_url ?? urlEntity.expanded_url;
        if (!expanded || expanded.includes('t.co') || expanded.includes('x.com/i/') || expanded.includes('twitter.com/i/')) continue;

        if (!urlNodeMap.has(expanded)) {
          const uId = randomUUID();
          urlNodeMap.set(expanded, uId);
          nodes.push({
            id: uId,
            type: 'URL',
            properties: {
              value: expanded,
              normalizedValue: expanded.toLowerCase(),
              name: urlEntity.display_url,
              sourceUrl: expanded,
              source: this.source,
              confidence: 0.9,
              createdAt: now,
            },
          });
        }
        relationships.push({ fromId: postId, toId: urlNodeMap.get(expanded)!, type: 'CONTAINS_LINK' });

        const domain = extractDomain(expanded);
        if (domain && !domainNodeMap.has(domain)) {
          const dId = randomUUID();
          domainNodeMap.set(domain, dId);
          nodes.push({
            id: dId,
            type: 'Domain',
            properties: {
              value: domain,
              normalizedValue: domain,
              name: domain,
              source: this.source,
              confidence: 0.9,
              createdAt: now,
            },
          });
        }
        if (domain) relationships.push({ fromId: postId, toId: domainNodeMap.get(domain)!, type: 'CONTAINS_LINK' });
      }

      // Mentions
      for (const { username: mentionedUsername } of tweet.entities?.mentions ?? []) {
        const handle = mentionedUsername.toLowerCase();
        if (!mentionNodeMap.has(handle)) {
          const mId = randomUUID();
          mentionNodeMap.set(handle, mId);
          nodes.push({
            id: mId,
            type: 'SocialProfile',
            properties: {
              value: `x.com/${mentionedUsername}`,
              normalizedValue: handle,
              name: `@${mentionedUsername}`,
              sourceUrl: `https://x.com/${mentionedUsername}`,
              source: this.source,
              confidence: 0.5,
              createdAt: now,
            },
          });
        }
        const relType = tweetType === 'replied_to' ? 'REPLIED_TO' : tweetType === 'retweeted' ? 'RETWEETED' : 'MENTIONS';
        relationships.push({ fromId: postId, toId: mentionNodeMap.get(handle)!, type: relType });
      }

      // Media
      for (const mediaKey of tweet.attachments?.media_keys ?? []) {
        const m = mediaMap.get(mediaKey);
        if (!m) continue;
        const mediaUrl = m.url ?? m.preview_image_url;
        if (!mediaUrl) continue;
        const mediaId = randomUUID();
        nodes.push({
          id: mediaId,
          type: 'Media',
          properties: {
            value: mediaUrl,
            normalizedValue: mediaUrl,
            name: m.type,
            sourceUrl: mediaUrl,
            source: this.source,
            confidence: 0.95,
            createdAt: now,
          },
        });
        relationships.push({ fromId: postId, toId: mediaId, type: 'CONTAINS_MEDIA' });
      }
    }

    // ── Followers ────────────────────────────────────────────────────────────
    for (const follower of followers) {
      const fHandle = follower.username.toLowerCase();
      if (!mentionNodeMap.has(fHandle)) {
        const fId = randomUUID();
        mentionNodeMap.set(fHandle, fId);
        nodes.push({
          id: fId,
          type: 'SocialProfile',
          properties: {
            value: `x.com/${follower.username}`,
            normalizedValue: fHandle,
            name: follower.name,
            sourceId: follower.id,
            sourceUrl: `https://x.com/${follower.username}`,
            source: this.source,
            confidence: 0.9,
            createdAt: now,
            followersCount: follower.public_metrics?.followers_count,
            followingCount: follower.public_metrics?.following_count,
            verified: follower.verified ?? false,
          },
        });
      }
      relationships.push({
        fromId: mentionNodeMap.get(fHandle)!,
        toId: profileId,
        type: 'FOLLOWS',
        properties: { sourceId: this.source, confidence: 0.95, createdAt: now },
      });
    }

    // ── Following ────────────────────────────────────────────────────────────
    for (const followed of following) {
      const fHandle = followed.username.toLowerCase();
      if (!mentionNodeMap.has(fHandle)) {
        const fId = randomUUID();
        mentionNodeMap.set(fHandle, fId);
        nodes.push({
          id: fId,
          type: 'SocialProfile',
          properties: {
            value: `x.com/${followed.username}`,
            normalizedValue: fHandle,
            name: followed.name,
            sourceId: followed.id,
            sourceUrl: `https://x.com/${followed.username}`,
            source: this.source,
            confidence: 0.9,
            createdAt: now,
            followersCount: followed.public_metrics?.followers_count,
            followingCount: followed.public_metrics?.following_count,
            verified: followed.verified ?? false,
          },
        });
      }
      relationships.push({
        fromId: profileId,
        toId: mentionNodeMap.get(fHandle)!,
        type: 'FOLLOWS',
        properties: { sourceId: this.source, confidence: 0.95, createdAt: now },
      });
    }

    // ── Mentions (who mentions this account) ─────────────────────────────────
    const mentionAuthors = new Map<string, { id: string; nodeId: string }>();
    for (const mention of mentions) {
      // mentions timeline items include author info via expansions if available
      // We track unique authors from mention tweets for relationship patterns
      const authorUsername = (mention as unknown as Record<string, unknown>)['author_username'] as string | undefined;
      if (!authorUsername) continue;
      const handle = authorUsername.toLowerCase();
      if (!mentionAuthors.has(handle)) {
        let nodeId = mentionNodeMap.get(handle);
        if (!nodeId) {
          nodeId = randomUUID();
          mentionNodeMap.set(handle, nodeId);
          nodes.push({
            id: nodeId,
            type: 'SocialProfile',
            properties: {
              value: `x.com/${authorUsername}`,
              normalizedValue: handle,
              name: `@${authorUsername}`,
              sourceUrl: `https://x.com/${authorUsername}`,
              source: this.source,
              confidence: 0.6,
              createdAt: now,
            },
          });
        }
        mentionAuthors.set(handle, { id: authorUsername, nodeId });
      }
      relationships.push({
        fromId: mentionAuthors.get(handle)!.nodeId,
        toId: profileId,
        type: 'MENTIONS',
        properties: { sourceId: this.source, confidence: 0.8, createdAt: now },
      });
    }

    this.logger.log(
      `@${username}: ${nodes.length} nodes, ${relationships.length} relationships — ` +
      `${tweets.length} tweets, ${followers.length} followers, ${following.length} following, ${mentions.length} mentions`,
    );

    return {
      nodes,
      relationships,
      rawData: { user, tweetsCount: tweets.length, followersCount: followers.length, followingCount: following.length },
      sourceUrl: `https://x.com/${user.username}`,
      confidence: 0.9,
    };
  }
}
