import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Neo4jModule } from './apps/modules/neo4j/neo4j.module';
import { PersonModule } from './apps/modules/person/person.module';
import { PostgresModule } from './apps/modules/postgres/postgres.module';
import { InvestigationModule } from './apps/modules/investigation/investigation.module';
import { ScraperModule } from './apps/modules/scraper/scraper.module';
import { UploadModule } from './apps/modules/upload/upload.module';
import { CronModule } from './apps/modules/cron/cron.module';
import { ProviderCredentialModule } from './apps/modules/provider-credential/provider-credential.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    Neo4jModule,
    PersonModule,
    PostgresModule,
    InvestigationModule,
    ScraperModule,
    UploadModule,
    CronModule,
    ProviderCredentialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
