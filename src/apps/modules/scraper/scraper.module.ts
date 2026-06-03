import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphModule } from '../graph/graph.module';
import { ProviderModule } from '../provider/provider.module';
import { ProviderCredentialModule } from '../provider-credential/provider-credential.module';
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
import { XDeveloperProvider } from './providers/x/x-developer.provider';
import { DorkProvider } from './providers/dork.provider';
import { BrowserService } from './browser/browser.service';
import { BraveEngine } from './browser/engines/brave.engine';
import { SearxngEngine } from './browser/engines/searxng.engine';
import { DdgBrowserEngine } from './browser/engines/ddg-browser.engine';
import { BraveBrowserEngine } from './browser/engines/brave-browser.engine';
import { SearchService, SEARCH_ENGINES_TOKEN } from './browser/search.service';
import { SCRAPER_QUEUE } from './queue/scraper.queue';
import { TRAMA_PROVIDERS_TOKEN } from './providers/provider.registry';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPER_QUEUE }),
    TypeOrmModule.forFeature([ScrapeJob, ScrapeResult]),
    GraphModule,
    ProviderModule,
    ProviderCredentialModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ScrapeJobService,
    ScrapeResultService,
    ScraperProcessor,
    BrowserService,
    BraveEngine,
    BraveBrowserEngine,
    SearxngEngine,
    DdgBrowserEngine,
    {
      provide: SEARCH_ENGINES_TOKEN,
      useFactory: (brave: BraveEngine, braveBrowser: BraveBrowserEngine, searxng: SearxngEngine, ddg: DdgBrowserEngine) => [brave, braveBrowser, searxng, ddg],
      inject: [BraveEngine, BraveBrowserEngine, SearxngEngine, DdgBrowserEngine],
    },
    SearchService,
    CurpProvider,
    SatRfcProvider,
    XSocialProvider,
    XDeveloperProvider,
    DorkProvider,
    {
      provide: TRAMA_PROVIDERS_TOKEN,
      useFactory: (curp: CurpProvider, sat: SatRfcProvider, xSocial: XSocialProvider, xDev: XDeveloperProvider, dork: DorkProvider) => [curp, sat, xSocial, xDev, dork],
      inject: [CurpProvider, SatRfcProvider, XSocialProvider, XDeveloperProvider, DorkProvider],
    },
  ],
  exports: [ScrapeJobService, ScrapeResultService],
})
export class ScraperModule {}
