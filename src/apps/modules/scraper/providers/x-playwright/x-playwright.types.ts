import type { Cookie } from 'playwright';

export type { Cookie };

export type XPlaywrightMode = 'public' | 'authenticated';

export interface XPlaywrightOptions {
  mode: XPlaywrightMode;
  cookies?: Cookie[];
  proxyUrl?: string;
  entityId?: string;
}

export interface XPlaywrightProfile {
  id: string;
  name: string;
  screen_name: string;
  description?: string;
  location?: string;
  followers_count: number;
  friends_count: number;
  statuses_count: number;
  created_at: string;
  profile_image_url_https?: string;
  verified: boolean;
  protected: boolean;
}

export interface XPlaywrightTweetEntities {
  hashtags: { text: string }[];
  urls: { expanded_url: string }[];
  media?: { media_url_https: string; type: string }[];
  user_mentions: { screen_name: string; id_str: string }[];
}

export interface XPlaywrightTweet {
  id_str: string;
  full_text: string;
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  entities: XPlaywrightTweetEntities;
  place?: { full_name: string };
}

export interface XPlaywrightFollowEntry {
  id: string;
  name: string;
  screen_name: string;
  profile_image_url_https?: string;
  followers_count?: number;
}

export interface XPlaywrightRawData {
  profile: XPlaywrightProfile;
  tweets: XPlaywrightTweet[];
  followers: XPlaywrightFollowEntry[];
  following: XPlaywrightFollowEntry[];
}
