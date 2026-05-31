import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TramaProvider, TramaProviderCategory } from '../../../../libs/providers';
import type {
  TramaProviderContext,
  TramaProviderResult,
  TramaProviderSeed,
  TramaNodeType,
} from '../../../../libs/providers';
import type { TramaRelationshipType } from '../../../modules/graph/graph.types';
import { SearchService } from '../browser/search.service';
import { DorkSearchConfigSchema, type DorkSearchConfig } from '../../../../libs/schemas/scraper.schema';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface DorkQuery {
  query: string;
  label: string;
}

// ─── Plataformas sociales conocidas ──────────────────────────────────────────

const SOCIAL_PLATFORMS: Record<string, string> = {
  'linkedin.com': 'linkedin',
  'github.com': 'github',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'reddit.com': 'reddit',
  'pinterest.com': 'pinterest',
  'medium.com': 'medium',
  'stackoverflow.com': 'stackoverflow',
  'telegram.org': 'telegram',
  't.me': 'telegram',
};

// ─── DDG Instant Answer ───────────────────────────────────────────────────────

interface DdgInfoboxItem {
  label: string;
  value: string | Record<string, unknown>;
}

interface DdgResponse {
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Image?: string;
  Entity?: string;
  Infobox?: { content?: DdgInfoboxItem[] };
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class DorkProvider extends TramaProvider {
  readonly source = 'dork-search';
  readonly name = 'Dork Search';
  readonly description =
    'Busca exposición pública del objetivo via Brave Search API, SearXNG o Playwright stealth; enriquece con DDG Instant Answer';
  readonly category = TramaProviderCategory.IDENTITY;
  readonly countries = [];
  readonly supportedInputs: string[] = ['fullName', 'firstName', 'email', 'username'];
  readonly outputNodeTypes: TramaNodeType[] = ['URL', 'Website', 'SocialProfile', 'Document', 'Source'];

  private readonly logger = new Logger(DorkProvider.name);

  constructor(private readonly search: SearchService) {
    super();
  }

  canHandle(seed: TramaProviderSeed): boolean {
    return !!(
      seed.fullName ||
      (seed.firstName && seed.lastName) ||
      seed.email ||
      seed.username ||
      seed.organization ||
      seed.domain ||
      seed.phone ||
      seed.query
    );
  }

  // ─── Query builder ─────────────────────────────────────────────────────────

  private buildQueries(seed: TramaProviderSeed, cfg: DorkSearchConfig): DorkQuery[] {
    const queries: DorkQuery[] = [];
    const max = cfg.maxQueries ?? 3;

    const fullName =
      seed.fullName ??
      (seed.firstName && seed.lastName ? `${seed.firstName} ${seed.lastName}` : null);

    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      const shortName = parts.length >= 3
        ? `${parts[0]} ${parts[parts.length - 1]}`
        : fullName;
      const mediumName = parts.length >= 4
        ? `${parts[0]} ${parts.slice(2).join(' ')}`
        : fullName;

      const baseTerms = cfg.keywords?.length
        ? `${fullName} ${cfg.keywords.join(' ')}`
        : fullName;

      if (cfg.searchMode === 'documents') {
        const types = cfg.fileTypes?.length ? cfg.fileTypes : ['pdf'];
        for (const ft of types) {
          queries.push({ query: `"${shortName}" filetype:${ft}`, label: `name-${ft}` });
        }
        if (cfg.fileTypes?.length) {
          // mediumName variant for formal documents
          queries.push({ query: `"${mediumName}" filetype:${types[0]}`, label: 'name-doc-medium' });
        }
      } else if (cfg.searchMode === 'identity') {
        const platforms = cfg.platforms?.length ? cfg.platforms : ['linkedin.com', 'github.com'];
        for (const p of platforms) {
          const site = p.includes('.') ? p : `${p}.com`;
          queries.push({ query: `"${shortName}" site:${site}`, label: `name-${p}` });
        }
        queries.push({ query: fullName, label: 'name-general' });
      } else {
        // general: broadest first
        queries.push({ query: baseTerms, label: 'name-general' });

        const platforms = cfg.platforms?.length
          ? cfg.platforms.map((p) => (p.includes('.') ? p : `${p}.com`))
          : ['linkedin.com', 'github.com'];
        for (const site of platforms) {
          queries.push({ query: `"${shortName}" site:${site}`, label: `name-${site.split('.')[0]}` });
        }

        if (cfg.fileTypes?.length) {
          for (const ft of cfg.fileTypes) {
            queries.push({ query: `"${mediumName}" filetype:${ft}`, label: `name-${ft}` });
          }
        } else {
          queries.push({ query: `"${mediumName}" filetype:pdf`, label: 'name-pdf' });
        }

        queries.push({ query: `"${fullName}"`, label: 'name-exact' });
      }
    }

    if (seed.email) {
      queries.push({ query: `"${seed.email}"`, label: 'email-exposure' });
    }

    if (seed.username) {
      queries.push(
        { query: `${seed.username} site:github.com`, label: 'username-github' },
        { query: `"${seed.username}"`, label: 'username-general' },
      );
    }

    // ── Organization ─────────────────────────────────────────────────────────
    if (seed.organization) {
      const org = seed.organization.trim();
      queries.push({ query: `"${org}"`, label: 'org-general' });
      queries.push({ query: `"${org}" site:linkedin.com`, label: 'org-linkedin' });

      if (cfg.searchMode === 'documents') {
        const types = cfg.fileTypes?.length ? cfg.fileTypes : ['pdf'];
        for (const ft of types) {
          queries.push({ query: `"${org}" filetype:${ft}`, label: `org-${ft}` });
        }
      } else if (cfg.searchMode === 'identity') {
        const platforms = cfg.platforms?.length ? cfg.platforms : ['linkedin.com', 'gob.mx'];
        for (const p of platforms) {
          const site = p.includes('.') ? p : `${p}.com`;
          queries.push({ query: `"${org}" site:${site}`, label: `org-${p}` });
        }
      } else {
        queries.push({ query: `"${org}" filetype:pdf`, label: 'org-docs' });
        if (cfg.keywords?.length) {
          queries.push({ query: `"${org}" ${cfg.keywords.join(' ')}`, label: 'org-keywords' });
        }
      }
    }

    // ── Domain ───────────────────────────────────────────────────────────────
    if (seed.domain) {
      const domain = seed.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      queries.push({ query: `site:${domain}`, label: 'domain-index' });
      queries.push({ query: `"${domain}"`, label: 'domain-exposure' });
      queries.push({ query: `site:${domain} filetype:pdf`, label: 'domain-docs' });
      if (cfg.keywords?.length) {
        queries.push({ query: `site:${domain} ${cfg.keywords.join(' ')}`, label: 'domain-keywords' });
      }
    }

    // ── Phone ────────────────────────────────────────────────────────────────
    if (seed.phone) {
      const phone = seed.phone.trim();
      const stripped = phone.replace(/[\s\-\(\)\.]/g, '');
      queries.push({ query: `"${phone}"`, label: 'phone-formatted' });
      if (stripped !== phone) {
        queries.push({ query: `"${stripped}"`, label: 'phone-stripped' });
      }
    }

    // ── Free-form query ──────────────────────────────────────────────────────
    if (seed.query) {
      const q = seed.query.trim();
      queries.push({ query: q, label: 'query-free' });
      if (cfg.keywords?.length) {
        queries.push({ query: `${q} ${cfg.keywords.join(' ')}`, label: 'query-keywords' });
      }
      if (cfg.platforms?.length) {
        for (const p of cfg.platforms.slice(0, 3)) {
          const site = p.includes('.') ? p : `${p}.com`;
          queries.push({ query: `${q} site:${site}`, label: `query-${site.split('.')[0]}` });
        }
      }
      if (cfg.fileTypes?.length) {
        for (const ft of cfg.fileTypes.slice(0, 2)) {
          queries.push({ query: `${q} filetype:${ft}`, label: `query-${ft}` });
        }
      }
    }

    return queries.slice(0, max);
  }

  // ─── Clasificación de URLs ─────────────────────────────────────────────────

  private classifyUrl(url: string, label: string): 'SocialProfile' | 'Document' | 'URL' {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      if (hostname in SOCIAL_PLATFORMS) return 'SocialProfile';
    } catch {
      // URL inválida
    }

    if (url.toLowerCase().endsWith('.pdf') || label.includes('pdf') || label.includes('doc')) {
      return 'Document';
    }

    return 'URL';
  }

  private detectPlatform(hostname: string): string | undefined {
    return SOCIAL_PLATFORMS[hostname];
  }

  private nodeRelType(nodeType: 'SocialProfile' | 'Document' | 'URL'): TramaRelationshipType {
    return nodeType === 'SocialProfile' ? 'HAS_PROFILE' : 'HAS_FINDING';
  }

  private nodeConfidence(nodeType: 'SocialProfile' | 'Document' | 'URL'): number {
    if (nodeType === 'SocialProfile') return 0.7;
    if (nodeType === 'Document') return 0.6;
    return 0.5;
  }

  // ─── Enriquecimiento: DDG Instant Answer ─────────────────────────────────

  private async enrichWithDdg(query: string): Promise<DdgResponse | null> {
    try {
      const params = new URLSearchParams({ q: query, format: 'json', no_html: '1', skip_disambig: '1' });
      const res = await fetch(`https://api.duckduckgo.com/?${params}`);
      if (!res.ok) return null;
      return await res.json() as DdgResponse;
    } catch {
      return null;
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  // ─── Execute ─────────────────────────────────────────────────────────────

  async execute(ctx: TramaProviderContext): Promise<TramaProviderResult> {
    const { entityId, config: rawConfig } = ctx;

    const cfgParsed = DorkSearchConfigSchema.safeParse(rawConfig ?? {});
    const cfg: DorkSearchConfig = cfgParsed.success ? cfgParsed.data : {};
    const delayMs = cfg.delayMs ?? 1200;
    const engine = cfg.engine ?? 'auto';

    const queries = this.buildQueries(ctx.seed, cfg);
    if (queries.length === 0) {
      throw new Error('No hay campos suficientes en el seed para generar dorks');
    }

    const now = new Date().toISOString();
    const nodes: TramaProviderResult['nodes'] = [];
    const relationships: TramaProviderResult['relationships'] = [];
    const urlSeen = new Set<string>();
    const domainMap = new Map<string, string>();

    // ── Búsquedas ────────────────────────────────────────────────────────────

    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await this.sleep(delayMs);
      const query = queries[i];
      this.logger.log(`[${query.label}] ${query.query}`);

      let results: { url: string; title: string; snippet: string }[] = [];

      try {
        results = await this.search.search(query.query, 10, engine);
      } catch (err) {
        this.logger.warn(`Query falló (${query.label}): ${String(err)}`);
        continue;
      }

      for (const result of results) {
        if (urlSeen.has(result.url)) continue;
        urlSeen.add(result.url);

        let hostname: string;
        try {
          hostname = new URL(result.url).hostname.replace(/^www\./, '');
        } catch {
          continue;
        }

        const nodeType = this.classifyUrl(result.url, query.label);
        const nodeId = randomUUID();
        const platform = nodeType === 'SocialProfile' ? this.detectPlatform(hostname) : undefined;

        nodes.push({
          id: nodeId,
          type: nodeType,
          properties: {
            value: result.url,
            normalizedValue: result.url.toLowerCase(),
            name: result.title || result.url,
            description: result.snippet || undefined,
            source: this.source,
            sourceUrl: result.url,
            confidence: this.nodeConfidence(nodeType),
            createdAt: now,
            dorkQuery: query.query,
            dorkLabel: query.label,
            ...(platform && { platform }),
            ...(nodeType === 'SocialProfile' && { profileUrl: result.url }),
            ...(nodeType === 'Document' && { fileUrl: result.url }),
          },
        });

        relationships.push({
          fromId: entityId,
          toId: nodeId,
          type: this.nodeRelType(nodeType),
        });

        if (!domainMap.has(hostname)) {
          const websiteId = randomUUID();
          domainMap.set(hostname, websiteId);
          nodes.push({
            id: websiteId,
            type: 'Website',
            properties: {
              value: hostname,
              normalizedValue: hostname,
              name: hostname,
              source: this.source,
              confidence: 0.6,
              createdAt: now,
            },
          });
        }

        relationships.push({
          fromId: nodeId,
          toId: domainMap.get(hostname)!,
          type: 'HOSTED_BY',
        });
      }
    }

    // ── Enriquecimiento con DDG Instant Answer ────────────────────────────────

    const name =
      ctx.seed.fullName ??
      (ctx.seed.firstName && ctx.seed.lastName
        ? `${ctx.seed.firstName} ${ctx.seed.lastName}`
        : ctx.seed.organization ??
          ctx.seed.domain ??
          ctx.seed.query ??
          ctx.seed.username ??
          null);

    if (name) {
      const ddg = await this.enrichWithDdg(name).catch(() => null);

      if (ddg?.AbstractText && ddg?.AbstractURL) {
        const sourceId = randomUUID();
        nodes.push({
          id: sourceId,
          type: 'Source',
          properties: {
            value: ddg.AbstractURL,
            normalizedValue: ddg.AbstractURL.toLowerCase(),
            name: `${ddg.AbstractSource ?? 'Wikipedia'}: ${name}`,
            description: ddg.AbstractText.slice(0, 500),
            source: this.source,
            sourceUrl: ddg.AbstractURL,
            confidence: 0.8,
            createdAt: now,
          },
        });
        relationships.push({ fromId: entityId, toId: sourceId, type: 'FOUND_IN_SOURCE' });

        if (ddg.Image) {
          const imgId = randomUUID();
          nodes.push({
            id: imgId,
            type: 'Media',
            properties: {
              value: `https://duckduckgo.com${ddg.Image}`,
              normalizedValue: `https://duckduckgo.com${ddg.Image}`.toLowerCase(),
              name: `Foto de perfil: ${name}`,
              source: this.source,
              confidence: 0.7,
              createdAt: now,
            },
          });
          relationships.push({ fromId: entityId, toId: imgId, type: 'CONTAINS_MEDIA' });
        }
      }
    }

    this.logger.log(
      `Dork completo: ${urlSeen.size} URLs, ${domainMap.size} dominios, engine: ${engine}, DDG: ${name ? 'sí' : 'no'}`,
    );
    return { nodes, relationships };
  }
}
