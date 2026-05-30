import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TramaProvider, TramaProviderCategory } from '../../../../libs/providers';
import type { TramaProviderContext, TramaProviderResult, TramaProviderSeed, TramaNodeType } from '../../../../libs/providers';

// Bearer token del cliente web de X — hardcodeado en su propio bundle JS, no es un secreto
const X_WEB_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Query IDs de los endpoints GraphQL internos de X.
// Cambian ocasionalmente cuando X actualiza su bundle — actualizar según sea necesario
// o sobreescribir con X_GQL_USER_ID / X_GQL_TWEETS_ID en env.
const GQL_USER_BY_SCREEN_NAME_ID =
  process.env.X_GQL_USER_ID ?? 'G3KGOASz96M-Qu0nwmGggg';
const GQL_USER_TWEETS_ID =
  process.env.X_GQL_TWEETS_ID ?? 'E3opETHurmVJflFsUBVuUQ';

// Features requeridas por los endpoints GraphQL — estables entre versiones
const GQL_USER_FEATURES = JSON.stringify({
  hidden_profile_likes_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  highlights_tweets_tab_ui_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
});

const GQL_TWEETS_FEATURES = JSON.stringify({
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  longform_notetweets_inline_media_enabled: true,
});

interface XUser {
  id_str: string;
  name: string;
  screen_name: string;
  description: string;
  location: string;
  followers_count: number;
  friends_count: number;
  statuses_count: number;
  created_at: string;
  profile_image_url_https: string;
  verified: boolean;
  protected: boolean;
  [key: string]: unknown;
}

interface XTweetEntities {
  hashtags: { text: string }[];
  urls: { expanded_url: string }[];
  media?: { media_url_https: string; type: string }[];
  user_mentions: { screen_name: string; id_str: string }[];
}

interface XTweet {
  id_str: string;
  full_text: string;
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  entities: XTweetEntities;
  place?: { full_name: string };
  [key: string]: unknown;
}

@Injectable()
export class XSocialProvider extends TramaProvider {
  readonly source = 'x-social';
  readonly name = 'X / Twitter';
  readonly description = 'Extrae perfil y posts públicos de X usando la API interna del cliente web (sin cuenta de desarrollador)';
  readonly category = TramaProviderCategory.SOCIAL;
  readonly countries = [];
  readonly supportedInputs: string[] = ['username', 'socialUrl'];
  readonly outputNodeTypes: TramaNodeType[] = [
    'SocialProfile',
    'Username',
    'Post',
    'Hashtag',
    'Media',
    'Location',
  ];

  private readonly logger = new Logger(XSocialProvider.name);
  private readonly baseUrl = 'https://api.twitter.com/1.1';

  canHandle(seed: TramaProviderSeed): boolean {
    if (seed.username) return true;
    return !!seed.socialUrl?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
  }

  private resolveUsername(seed: TramaProviderSeed): string | null {
    if (seed.username) return seed.username.replace(/^@/, '').trim();
    const match = seed.socialUrl?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/);
    return match?.[1] ?? null;
  }

  private async getGuestToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/guest/activate.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${X_WEB_BEARER}`,
        'User-Agent': 'Mozilla/5.0 (compatible; Trama-OSINT/1.0)',
      },
    });
    if (!res.ok) throw new Error(`Guest token request failed: ${res.status}`);
    const { guest_token } = (await res.json()) as { guest_token: string };
    return guest_token;
  }

  private buildHeaders(guestToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${X_WEB_BEARER}`,
      'x-guest-token': guestToken,
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
      'User-Agent': 'Mozilla/5.0 (compatible; Trama-OSINT/1.0)',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
  }

  private async fetchProfile(username: string, guestToken: string): Promise<{ user: XUser; userId: string }> {
    const variables = JSON.stringify({ screen_name: username, withSafetyModeUserFields: true });
    const url =
      `https://api.twitter.com/graphql/${GQL_USER_BY_SCREEN_NAME_ID}/UserByScreenName` +
      `?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(GQL_USER_FEATURES)}`;

    const res = await fetch(url, { headers: this.buildHeaders(guestToken) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X profile fetch failed (${res.status}) for @${username}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: { user?: { result?: { rest_id?: string; legacy?: XUser } } } };
    const result = json?.data?.user?.result;
    if (!result?.legacy) throw new Error(`User @${username} not found or suspended`);
    return { user: result.legacy, userId: result.rest_id ?? '' };
  }

  private async fetchTimeline(userId: string, username: string, guestToken: string): Promise<XTweet[]> {

    const variables = JSON.stringify({ userId, count: 20, includePromotedContent: false });
    const url =
      `https://api.twitter.com/graphql/${GQL_USER_TWEETS_ID}/UserTweets` +
      `?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(GQL_TWEETS_FEATURES)}`;

    const res = await fetch(url, { headers: this.buildHeaders(guestToken) });
    if (!res.ok) {
      this.logger.warn(`Timeline fetch failed (${res.status}) for @${username} — omitiendo posts`);
      return [];
    }

    const json = (await res.json()) as {
      data?: { user?: { result?: { timeline_v2?: { timeline?: { instructions?: unknown[] } } } } };
    };

    return this.extractTweetsFromTimeline(json?.data?.user?.result?.timeline_v2?.timeline?.instructions ?? []);
  }

  private extractTweetsFromTimeline(instructions: unknown[]): XTweet[] {
    const tweets: XTweet[] = [];
    for (const instruction of instructions) {
      const entries = (instruction as { entries?: unknown[] })?.entries ?? [];
      for (const entry of entries) {
        const legacy = (
          entry as { content?: { itemContent?: { tweet_results?: { result?: { legacy?: XTweet } } } } }
        )?.content?.itemContent?.tweet_results?.result?.legacy;
        if (legacy?.id_str) tweets.push(legacy);
      }
    }
    return tweets;
  }

  async execute(ctx: TramaProviderContext): Promise<TramaProviderResult> {
    const { entityId } = ctx;
    const username = this.resolveUsername(ctx.seed);
    if (!username) throw new Error('No se pudo resolver el username desde el seed');

    this.logger.log(`Scraping X profile: @${username}`);
    const guestToken = await this.getGuestToken();

    const { user, userId } = await this.fetchProfile(username, guestToken);
    const tweets = await this.fetchTimeline(userId, username, guestToken);

    const now = new Date().toISOString();
    const nodes: TramaProviderResult['nodes'] = [];
    const relationships: TramaProviderResult['relationships'] = [];

    // SocialProfile
    const profileId = randomUUID();
    nodes.push({
      id: profileId,
      type: 'SocialProfile',
      properties: {
        value: `x.com/${user.screen_name}`,
        normalizedValue: user.screen_name.toLowerCase(),
        name: user.name,
        description: user.description || undefined,
        sourceId: user.id_str,
        sourceUrl: `https://x.com/${user.screen_name}`,
        source: this.source,
        status: user.protected ? 'inactive' : 'active',
        confidence: 0.9,
        createdAt: now,
        followersCount: user.followers_count,
        followingCount: user.friends_count,
        tweetsCount: user.statuses_count,
        verified: user.verified,
        joinedAt: new Date(user.created_at).toISOString(),
        avatarUrl: user.profile_image_url_https,
      },
    });
    relationships.push({ fromId: entityId, toId: profileId, type: 'HAS_PROFILE' });

    // Username
    const usernameId = randomUUID();
    nodes.push({
      id: usernameId,
      type: 'Username',
      properties: {
        value: `@${user.screen_name}`,
        normalizedValue: user.screen_name.toLowerCase(),
        name: `@${user.screen_name}`,
        sourceUrl: `https://x.com/${user.screen_name}`,
        source: this.source,
        confidence: 0.9,
        createdAt: now,
      },
    });
    relationships.push({ fromId: profileId, toId: usernameId, type: 'HAS_USERNAME' });

    // Location (auto-declarada en bio — confianza baja)
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
          confidence: 0.5,
          createdAt: now,
        },
      });
      relationships.push({ fromId: profileId, toId: locationId, type: 'LOCATED_AT' });
    }

    // Posts con sus entidades
    // Deduplicar hashtags y menciones entre todos los posts
    const hashtagMap = new Map<string, string>(); // normalized → nodeId
    const mentionMap = new Map<string, string>();  // screen_name lower → nodeId

    for (const tweet of tweets) {
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
          sourceUrl: `https://x.com/${user.screen_name}/status/${tweet.id_str}`,
          source: this.source,
          confidence: 0.9,
          createdAt: new Date(tweet.created_at).toISOString(),
          likesCount: tweet.favorite_count,
          retweetsCount: tweet.retweet_count,
        },
      });
      relationships.push({ fromId: profileId, toId: postId, type: 'POSTED' });

      for (const { text } of tweet.entities.hashtags) {
        const tag = text.toLowerCase();
        if (!hashtagMap.has(tag)) {
          const hashtagId = randomUUID();
          hashtagMap.set(tag, hashtagId);
          nodes.push({
            id: hashtagId,
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

      // Menciones como leads OSINT — confidence baja porque solo sabemos que coexisten
      for (const { screen_name } of tweet.entities.user_mentions) {
        const handle = screen_name.toLowerCase();
        if (!mentionMap.has(handle)) {
          const mentionId = randomUUID();
          mentionMap.set(handle, mentionId);
          nodes.push({
            id: mentionId,
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

    return {
      nodes,
      relationships,
      rawData: { user, tweets },
      sourceUrl: `https://x.com/${user.screen_name}`,
    };
  }
}
