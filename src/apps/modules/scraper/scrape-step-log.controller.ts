import { Controller, Get, Param, Query } from '@nestjs/common';
import { ScrapeStepLogService } from './scrape-step-log.service';

@Controller('scrape-step-logs')
export class ScrapeStepLogController {
  constructor(private readonly service: ScrapeStepLogService) {}

  @Get()
  findAll(
    @Query('entityId') entityId?: string,
    @Query('provider') provider?: string,
    @Query('limit') limit?: string,
  ) {
    if (entityId) return this.service.findByEntity(entityId, provider);
    if (provider) return this.service.findByProvider(provider, limit ? +limit : 100);
    return this.service.findRecent(limit ? +limit : 50);
  }

  @Get('entity/:entityId')
  findByEntity(@Param('entityId') entityId: string, @Query('provider') provider?: string) {
    return this.service.findByEntity(entityId, provider);
  }
}
