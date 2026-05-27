import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Provider } from './provider.entity';
import { ScrapeJob } from '../scraper/scrape-job.entity';
import type { TramaProvider } from '../../../libs/providers';
import type { CreateProviderDto, UpdateProviderDto } from '../../../libs/schemas/provider.schema';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(Provider)
    private readonly repo: Repository<Provider>,
    @InjectRepository(ScrapeJob)
    private readonly scrapeJobRepo: Repository<ScrapeJob>,
  ) {}

  // Llamado al arrancar — hace upsert de cada provider registrado en código.
  // Los providers desactivados manualmente (isActive=false) no se reactivan.
  async syncFromCode(providers: TramaProvider[]): Promise<void> {
    for (const p of providers) {
      const meta = p.getMetadata();
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(Provider)
        .values({
          source: meta.source,
          name: meta.name,
          description: meta.description,
          version: meta.version,
          category: meta.category,
          countries: meta.countries,
          supportedInputs: meta.supportedInputs,
          outputNodeTypes: meta.outputNodeTypes,
          isActive: true,
        })
        .orUpdate(
          ['name', 'description', 'version', 'category', 'countries', 'supportedInputs', 'outputNodeTypes'],
          ['source'],
          { skipUpdateIfNoValuesChanged: true },
        )
        .execute();
    }
    this.logger.log(`Synced ${providers.length} provider(s) to DB`);
  }

  async recordRun(source: string, success: boolean, durationMs: number, error?: string): Promise<void> {
    const provider = await this.repo.findOneBy({ source });
    if (!provider) return;

    const newTotal = provider.totalRuns + 1;
    const newSuccess = provider.successCount + (success ? 1 : 0);
    const newFail = provider.failCount + (success ? 0 : 1);
    // Media móvil acumulada del tiempo de respuesta
    const newAvg = provider.avgDurationMs === null
      ? durationMs
      : Math.round((provider.avgDurationMs * provider.totalRuns + durationMs) / newTotal);

    await this.repo.update(provider.id, {
      totalRuns: newTotal,
      successCount: newSuccess,
      failCount: newFail,
      avgDurationMs: newAvg,
      lastRunAt: new Date(),
      lastError: success ? null : (error ?? null),
    });
  }

  async findActiveSources(): Promise<Set<string>> {
    const active = await this.repo.find({ where: { isActive: true }, select: { source: true } });
    return new Set(active.map((p) => p.source));
  }

  findAll(): Promise<Provider[]> {
    return this.repo.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  findBySource(source: string): Promise<Provider | null> {
    return this.repo.findOneBy({ source });
  }

  async setActive(source: string, isActive: boolean): Promise<void> {
    await this.repo.update({ source }, { isActive });
  }

  async create(dto: CreateProviderDto): Promise<Provider> {
    const exists = await this.repo.findOneBy({ source: dto.source });
    if (exists) throw new ConflictException(`Provider "${dto.source}" already exists`);
    const provider = this.repo.create(dto);
    return this.repo.save(provider);
  }

  async update(source: string, dto: UpdateProviderDto): Promise<Provider> {
    const provider = await this.repo.findOneBy({ source });
    if (!provider) throw new NotFoundException(`Provider "${source}" not found`);
    Object.assign(provider, dto);
    return this.repo.save(provider);
  }

  async remove(source: string): Promise<void> {
    const provider = await this.repo.findOneBy({ source });
    if (!provider) throw new NotFoundException(`Provider "${source}" not found`);
    await this.repo.remove(provider);
  }

  findRunsBySource(source: string, limit = 50): Promise<ScrapeJob[]> {
    return this.scrapeJobRepo.find({
      where: { source },
      order: { createdAt: 'DESC' },
      take: limit,
      select: {
        id: true,
        personId: true,
        source: true,
        status: true,
        createdNodeIds: true,
        errorMessage: true,
        bullJobId: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
  }
}
