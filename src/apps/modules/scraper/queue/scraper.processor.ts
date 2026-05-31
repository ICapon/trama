import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { GraphService } from '../../graph/graph.service';
import { ScrapeJobService } from '../scrape-job.service';
import { ScrapeResultService } from '../scrape-result.service';
import { ScrapeResultStatus } from '../scrape-result.entity';
import { ProviderService } from '../../provider/provider.service';
import { SCRAPER_QUEUE, SCRAPE_PERSON_JOB } from './scraper.queue';
import { TramaProvider } from '../../../../libs/providers';
import { TRAMA_PROVIDERS_TOKEN } from '../providers/provider.registry';
import type { ScrapeJobPayload } from '../scraper.types';

@Processor(SCRAPER_QUEUE)
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    @Inject(TRAMA_PROVIDERS_TOKEN)
    private readonly providers: TramaProvider[],
    private readonly graph: GraphService,
    private readonly scrapeJobService: ScrapeJobService,
    private readonly scrapeResultService: ScrapeResultService,
    private readonly providerService: ProviderService,
  ) {
    super();
  }

  async process(job: Job<ScrapeJobPayload>): Promise<void> {
    if (job.name !== SCRAPE_PERSON_JOB) return;

    const { scrapeJobId, entityId, entityType, investigationId, source, seed, config } = job.data;
    const provider = this.providers.find((p) => p.source === source);

    if (!provider) {
      this.logger.warn(`No provider registered for source: ${source}`);
      await this.scrapeJobService.markFailed(scrapeJobId, `Unknown provider: ${source}`);
      return;
    }

    this.logger.log(`[${source}] Starting scrape for entity ${entityId}`);

    const executedAt = new Date();
    const startedAt = Date.now();
    const scrapeResultNodeId = randomUUID();
    const now = executedAt.toISOString();

    await this.graph.createEntity({
      id: scrapeResultNodeId,
      type: 'ScrapeResult',
      properties: { name: `${source} scrape`, source, scrapeStatus: 'running', createdAt: now },
    });

    await this.graph.createRelationship({
      fromId: entityId,
      toId: scrapeResultNodeId,
      type: 'HAS_EVIDENCE',
    });

    try {
      const result = await provider.execute({ entityId, entityType, seed, config });

      for (const node of result.nodes) {
        await this.graph.createEntity(node);
        await this.graph.createRelationship({
          fromId: node.id,
          toId: scrapeResultNodeId,
          type: 'FOUND_IN_SOURCE',
        });
      }

      for (const rel of result.relationships) {
        await this.graph.createRelationship(rel);
      }

      const neo4jNodeIds = result.nodes.map((n) => n.id);

      await this.graph.createEntity({
        id: scrapeResultNodeId,
        type: 'ScrapeResult',
        properties: {
          name: `${source} scrape`,
          source,
          scrapeStatus: 'completed',
          createdAt: now,
          updatedAt: new Date().toISOString(),
        },
      });

      await this.scrapeResultService.create({
        scrapeJobId,
        investigationId,
        entityId,
        source,
        sourceUrl: result.sourceUrl ?? null,
        status: ScrapeResultStatus.SUCCESS,
        confidence: result.confidence ?? null,
        rawData: result.rawData ?? null,
        summary: null,
        nodesCreated: result.nodes.length,
        relationshipsCreated: result.relationships.length,
        neo4jNodeIds,
        neo4jScrapeResultId: scrapeResultNodeId,
        executedAt,
        durationMs: Date.now() - startedAt,
      });

      await this.scrapeJobService.markCompleted(scrapeJobId);
      await this.providerService.recordRun(source, true, Date.now() - startedAt);

      this.logger.log(
        `[${source}] Done — ${result.nodes.length} nodes, ${result.relationships.length} rels`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.graph.createEntity({
        id: scrapeResultNodeId,
        type: 'ScrapeResult',
        properties: {
          name: `${source} scrape`,
          source,
          scrapeStatus: 'failed',
          createdAt: now,
          updatedAt: new Date().toISOString(),
        },
      });

      await this.scrapeResultService.create({
        scrapeJobId,
        investigationId,
        entityId,
        source,
        sourceUrl: null,
        status: ScrapeResultStatus.ERROR,
        confidence: null,
        rawData: null,
        summary: null,
        nodesCreated: 0,
        relationshipsCreated: 0,
        neo4jNodeIds: [],
        neo4jScrapeResultId: scrapeResultNodeId,
        executedAt,
        durationMs: Date.now() - startedAt,
      });

      await this.scrapeJobService.markFailed(scrapeJobId, errorMessage);
      await this.providerService.recordRun(source, false, Date.now() - startedAt, errorMessage);
      this.logger.error(`[${source}] Scrape failed for entity ${entityId}`, error);
      throw error;
    }
  }
}
