import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphModule } from '../graph/graph.module';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './queue/scraper.processor';
import { ScrapeJobService } from './scrape-job.service';
import { ScrapeJob } from './scrape-job.entity';
import { CurpProvider } from './providers/curp.provider';
import { SatRfcProvider } from './providers/sat-rfc.provider';
import { SCRAPER_QUEUE } from './queue/scraper.queue';
import { SCRAPER_PROVIDERS_TOKEN } from './providers/provider.registry';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: SCRAPER_QUEUE }),
    TypeOrmModule.forFeature([ScrapeJob]),
    GraphModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ScrapeJobService,
    ScraperProcessor,
    CurpProvider,
    SatRfcProvider,
    {
      provide: SCRAPER_PROVIDERS_TOKEN,
      useFactory: (curp: CurpProvider, sat: SatRfcProvider) => [curp, sat],
      inject: [CurpProvider, SatRfcProvider],
    },
  ],
  exports: [ScrapeJobService],
})
export class ScraperModule {}
