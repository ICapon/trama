import type { TramaProviderSeed } from '../../../../libs/providers/trama-provider.types';

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

// ─── Social profile URL validators ───────────────────────────────────────────

type PathValidator = (pathname: string) => boolean;

const PROFILE_PATH_VALIDATORS: Partial<Record<string, PathValidator>> = {
  'linkedin.com':      (p) => /^\/in\/[^/]+\/?$/.test(p),
  'github.com':        (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(orgs|topics|collections|trending|explore|about|contact|pricing|features|marketplace)/.test(p),
  'twitter.com':       (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(i\/|hashtag\/|search|explore|home|notifications|messages)/.test(p),
  'x.com':             (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(i\/|hashtag\/|search|explore|home|notifications|messages)/.test(p),
  'facebook.com':      (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(groups|pages|watch|events|marketplace|gaming|ads|help|login)/.test(p),
  'instagram.com':     (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(explore|reels|tv|accounts|p\/)/.test(p),
  'tiktok.com':        (p) => /^\/@[^/]+\/?$/.test(p),
  'youtube.com':       (p) => /^\/@[^/]+\/?$/.test(p) || /^\/(channel|user)\/[^/]+\/?$/.test(p),
  'reddit.com':        (p) => /^\/(u|user)\/[^/]+\/?$/.test(p),
  'medium.com':        (p) => /^\/@[^/]+\/?$/.test(p),
  'stackoverflow.com': (p) => /^\/users\/\d+/.test(p),
  'pinterest.com':     (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(pin|board|explore|categories|topics)/.test(p),
  't.me':              (p) => /^\/[^/]+\/?$/.test(p) && !/^\/(joinchat|addstickers|s\/)/.test(p),
  'telegram.org':      (_p) => true,
};

/**
 * Validates that a URL path matches a real user profile on the given platform.
 * Returns true for platforms without a registered validator.
 */
export function isProfileUrl(url: string, hostname: string): boolean {
  const validator = PROFILE_PATH_VALIDATORS[hostname];
  if (!validator) return true;
  try {
    return validator(new URL(url).pathname);
  } catch {
    return false;
  }
}

// ─── Relevance scoring ────────────────────────────────────────────────────────

/**
 * Computes a 0–1 relevance score by matching the result's title/snippet
 * against the seed's identifying fields.
 *
 * Returns null when the seed has no identifiable fields (domain-only,
 * free-query, etc.) — callers should skip threshold filtering in that case.
 */
export function computeRelevance(result: SearchResult, seed: TramaProviderSeed): number | null {
  const text = `${result.title} ${result.snippet}`.toLowerCase();

  const fullName =
    seed.fullName ??
    (seed.firstName && seed.lastName ? `${seed.firstName} ${seed.lastName}` : undefined);

  if (!(fullName || seed.email || seed.username || seed.phone)) return null;

  let score = 0;

  if (fullName && text.includes(fullName.toLowerCase())) {
    score += 0.45;
  } else {
    if (seed.firstName && text.includes(seed.firstName.toLowerCase())) score += 0.15;
    if (seed.lastName && text.includes(seed.lastName.toLowerCase())) score += 0.15;
  }

  if (seed.email && text.includes(seed.email.toLowerCase())) score += 0.35;
  if (seed.username && text.includes(seed.username.toLowerCase())) score += 0.25;
  if (seed.phone) {
    const stripped = seed.phone.replace(/[\s\-().]/g, '');
    if (text.includes(stripped)) score += 0.35;
  }

  return Math.min(score, 1);
}
