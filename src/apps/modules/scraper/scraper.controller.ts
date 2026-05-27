import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScrapeResultService } from './scrape-result.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import { RunScrapeSchema, type RunScrapeDto } from '../../../libs/schemas/scraper.schema';

@Controller('scraper')
export class ScraperController {
  constructor(
    private readonly scraper: ScraperService,
    private readonly scrapeResults: ScrapeResultService,
  ) {}

  @Get('providers')
  listProviders() {
    return this.scraper.listProviders();
  }

  @Post('entity/:entityId/run')
  run(
    @Param('entityId') entityId: string,
    @Query('entityType') entityType: string = 'Person',
    @Body(new ZodValidationPipe(RunScrapeSchema)) dto: RunScrapeDto,
  ) {
    return this.scraper.runForEntity(entityId, entityType, dto);
  }

  @Get('entity/:entityId/jobs')
  getJobsByEntity(@Param('entityId') entityId: string) {
    return this.scraper.getJobsByEntity(entityId);
  }

  @Get('entity/:entityId/results')
  getResultsByEntity(@Param('entityId') entityId: string) {
    return this.scrapeResults.findByEntity(entityId);
  }

  @Get('jobs')
  listJobs() {
    return this.scraper.listJobs();
  }

  @Get('jobs/:id')
  getJobStatus(@Param('id') id: string) {
    return this.scraper.getJobStatus(id);
  }

  @Get('results/investigation/:investigationId')
  getResultsByInvestigation(@Param('investigationId') investigationId: string) {
    return this.scrapeResults.findByInvestigation(investigationId);
  }
}
