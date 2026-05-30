import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphModule } from '../graph/graph.module';
import { ProviderModule } from '../provider/provider.module';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './queue/scraper.processor';
import { ScrapeJobService } from './scrape-job.service';
import { ScrapeResultService } from './scrape-result.service';
import { ScrapeJob } from './scrape-job.entity';
import { ScrapeResult } from './scrape-result.entity';
import { CurpProvider } from './providers/curp.provider';
import { SatRfcProvider } from './providers/sat-rfc.provider';
import { XSocialProvider } from './providers/x-social.provider';
import { DorkProvider } from './providers/dork.provider';
import { BrowserService } from './browser/browser.service';
import { SCRAPER_QUEUE } from './queue/scraper.queue';
import { TRAMA_PROVIDERS_TOKEN } from './providers/provider.registry';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: SCRAPER_QUEUE }),
    TypeOrmModule.forFeature([ScrapeJob, ScrapeResult]),
    GraphModule,
    ProviderModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ScrapeJobService,
    ScrapeResultService,
    ScraperProcessor,
    BrowserService,
    CurpProvider,
    SatRfcProvider,
    XSocialProvider,
    DorkProvider,
    {
      provide: TRAMA_PROVIDERS_TOKEN,
      useFactory: (curp: CurpProvider, sat: SatRfcProvider, x: XSocialProvider, dork: DorkProvider) => [curp, sat, x, dork],
      inject: [CurpProvider, SatRfcProvider, XSocialProvider, DorkProvider],
    },
  ],
  exports: [ScrapeJobService, ScrapeResultService],
})
export class ScraperModule {}
