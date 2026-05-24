import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ZodValidationPipe } from '../../../libs/pipes/zod-validation.pipe';
import { RunScrapeSchema, type RunScrapeDto } from '../../../libs/schemas/scraper.schema';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraper: ScraperService) {}

  @Get('providers')
  listProviders() {
    return this.scraper.listProviders();
  }

  @Post('person/:personId/run')
  run(
    @Param('personId') personId: string,
    @Body(new ZodValidationPipe(RunScrapeSchema)) dto: RunScrapeDto,
  ) {
    return this.scraper.runForPerson(personId, dto);
  }

  @Get('person/:personId/jobs')
  getJobsByPerson(@Param('personId') personId: string) {
    return this.scraper.getJobsByPerson(personId);
  }

  @Get('jobs/:id')
  getJobStatus(@Param('id') id: string) {
    return this.scraper.getJobStatus(id);
  }
}
